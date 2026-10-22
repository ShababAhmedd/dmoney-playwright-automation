import { test, expect, Page } from "@playwright/test";
import { SUITES } from "../utils/suites";
import { ADMIN, LOGIN_FAILED, gmailAlias } from "../utils/testData";
import { JourneyState, loadJourney, saveJourney } from "../utils/journeyState";
import { LoginPage } from "../pages/LoginPage";
import { Header } from "../pages/Header";
import { ProfilePage } from "../pages/ProfilePage";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import { UserDetailsPage } from "../pages/UserDetailsPage";

let page: Page;
let state: JourneyState;

test.describe("Admin journey", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    state = loadJourney();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("Admin pages redirect to login when not logged in", { tag: SUITES.negative }, async () => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login/);
  });

  test("Login fails for an unregistered email", { tag: SUITES.negative }, async () => {
    const loginPage = new LoginPage(page);
    await loginPage.submitCredentials({ email: gmailAlias(`nobody${Date.now()}`), password: "1234" });
    await expect(loginPage.errorAlert).toHaveText("User not found");
    await expect(loginPage.otpInput).toBeHidden();
    await expect(page).toHaveURL(/\/login/);
  });

  test("Admin cannot log in with a wrong password", { tag: SUITES.negative }, async () => {
    const loginPage = new LoginPage(page);
    await loginPage.submitCredentials({ email: ADMIN.email, password: "9999" });
    await expect(loginPage.errorAlert).toHaveText(LOGIN_FAILED);
    await expect(page).toHaveURL(/\/login/);
  });

  test("Admin login is successful", { tag: SUITES.smoke }, async () => {
    await new LoginPage(page).login(ADMIN);
    await expect(new ProfilePage(page).roleInput).toHaveValue("Admin");
  });

  test("Newly created Agent appears in the Admin user list", { tag: SUITES.smoke }, async () => {
    const usersPage = new AdminUsersPage(page);
    await usersPage.goto();
    const row = await usersPage.searchByEmail(state.agent.email);
    expect(await usersPage.getCell(row, "Phone")).toBe(state.agent.phone);
    expect(await usersPage.getCell(row, "Role")).toBe("Agent");
    state = saveJourney({ agentId: await usersPage.getCell(row, "ID") });
  });

  test("Newly created Agent is initially inactive", { tag: SUITES.smoke }, async () => {
    const details = new UserDetailsPage(page);
    await details.goto(state.agentId!);
    await expect(details.statusBadge).toHaveText("PENDING");
  });

  test("Admin can activate the Agent", { tag: SUITES.smoke }, async () => {
    const details = new UserDetailsPage(page);
    const response = page.waitForResponse((r) => r.request().method() !== "GET" && r.url().includes(state.agentId!));
    await details.setStatus("Active");
    expect((await response).ok()).toBeTruthy();
    await expect(details.statusBadge).toHaveText("ACTIVE");
  });

  test("Agent remains active after page reload", { tag: SUITES.smoke }, async () => {
    const details = new UserDetailsPage(page);
    await page.reload();
    await expect(details.statusBadge).toHaveText("ACTIVE");
  });

  test("Admin can find an existing Customer", { tag: SUITES.smoke }, async () => {
    const customer = await new AdminUsersPage(page).findExistingCustomer();
    expect(customer.phone).toMatch(/^01\d{9}$/);
    state = saveJourney({ customerId: customer.id, customerPhone: customer.phone });
  });

  test("Existing Customer is active", { tag: SUITES.smoke }, async () => {
    const details = new UserDetailsPage(page);
    await details.goto(state.customerId!);
    // the customer must be active to receive the agent's deposit later on
    if ((await details.statusBadge.innerText()) !== "ACTIVE") await details.setStatus("Active");
    await expect(details.statusBadge).toHaveText("ACTIVE");
  });

  test("Admin logout works successfully", { tag: SUITES.smoke }, async () => {
    await new Header(page).logout();
  });

  test("Admin pages are not accessible after logout", { tag: SUITES.negative }, async () => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login/);
  });
});
