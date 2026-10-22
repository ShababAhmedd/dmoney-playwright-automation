import { test, expect, Page } from "@playwright/test";
import { SUITES } from "../utils/suites";
import { CUSTOMER_DEPOSIT, newAgent } from "../utils/testData";
import { JourneyState, startJourney } from "../utils/journeyState";
import { RegisterPage } from "../pages/RegisterPage";
import { LoginPage } from "../pages/LoginPage";
import { ProfilePage } from "../pages/ProfilePage";
import { CashInPage } from "../pages/CashInPage";

let page: Page;
let state: JourneyState;

test.describe("Registration journey", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    state = startJourney();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("Registration rejects an empty form", { tag: SUITES.negative }, async () => {
    const registerPage = new RegisterPage(page);
    await registerPage.openFromHome();
    await registerPage.createAccountBtn.click();
    await expect(registerPage.alert).toHaveText("All fields are required.");
    await expect(page).toHaveURL(/\/register/);
  });

  test("Registration rejects a non-Gmail email address", { tag: SUITES.negative }, async () => {
    const registerPage = new RegisterPage(page);
    await registerPage.openFromHome();
    await registerPage.register({ ...state.agent, email: `agent${Date.now()}@yahoo.com` });
    await expect(registerPage.alert).toHaveText("Only Gmail addresses (@gmail.com) are allowed for registration.");
    await expect(page).toHaveURL(/\/register/);
  });

  test("Registration rejects a phone number that is not 11 digits", { tag: SUITES.negative }, async () => {
    const registerPage = new RegisterPage(page);
    await registerPage.openFromHome();
    await registerPage.register({ ...state.agent, phone: "01712345" });
    await expect(registerPage.alert).toHaveText("Phone number must be exactly 11 digits.");
    await expect(page).toHaveURL(/\/register/);
  });

  test("Agent registration is successful", { tag: SUITES.smoke }, async () => {
    const registerPage = new RegisterPage(page);
    await registerPage.openFromHome();
    const response = page.waitForResponse((r) => r.url().endsWith("/user/register"));
    await registerPage.register(state.agent);
    expect((await response).status()).toBe(201);
    await expect(page.getByText(/Registration successful/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  // these need the account above to exist, so they run after the positive case
  test("Registration rejects an email that is already registered", { tag: SUITES.negative }, async () => {
    const registerPage = new RegisterPage(page);
    await registerPage.openFromHome();
    await registerPage.register({ ...newAgent(), email: state.agent.email });
    await expect(registerPage.alert).toHaveText("An account with this email already exists");
    await expect(page).toHaveURL(/\/register/);
  });

  test("Registration rejects a phone number that is already registered", { tag: SUITES.negative }, async () => {
    const registerPage = new RegisterPage(page);
    await registerPage.openFromHome();
    await registerPage.register({ ...newAgent(), phone: state.agent.phone });
    await expect(registerPage.alert).toHaveText("An account with this phone number already exists");
    await expect(page).toHaveURL(/\/register/);
  });

  // a pending agent may log in by design, but must not be able to transact
  test("Pending Agent cannot perform transactions", { tag: SUITES.negative }, async () => {
    await new LoginPage(page).loginWithOtp(state.agent);
    await expect(new ProfilePage(page).statusBanner).toContainText("You cannot perform transactions");
    const cashIn = new CashInPage(page);
    // SYSTEM always exists, so the request gets past the account lookup to the status check
    await cashIn.cashIn("SYSTEM", CUSTOMER_DEPOSIT);
    await expect(cashIn.errorAlert).toHaveText("From account is not active. Please contact admin.");
    await expect(cashIn.successMessage).toBeHidden();
  });
});
