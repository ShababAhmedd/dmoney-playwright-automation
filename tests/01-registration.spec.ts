import { test, expect, Page } from "@playwright/test";
import { SUITES } from "../utils/suites";
import { newAgent } from "../utils/testData";
import { JourneyState, startJourney } from "../utils/journeyState";
import { RegisterPage } from "../pages/RegisterPage";

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

  // needs the account above to exist, so it runs after the positive case
  test("Registration rejects an email that is already registered", { tag: SUITES.negative }, async () => {
    const registerPage = new RegisterPage(page);
    await registerPage.openFromHome();
    await registerPage.register({ ...newAgent(), email: state.agent.email });
    await expect(registerPage.alert).toHaveText("An account with this email already exists");
    await expect(page).toHaveURL(/\/register/);
  });
});
