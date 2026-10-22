import { test, expect, Page } from "@playwright/test";
import { SUITES } from "../utils/suites";
import { LOGIN_FAILED, gmailAlias } from "../utils/testData";
import { AGENT_AUTH_FILE, JourneyState, loadJourney, saveJourney } from "../utils/journeyState";
import { getPasswordResetLink } from "../utils/gmail";
import { LoginPage } from "../pages/LoginPage";
import { ProfilePage } from "../pages/ProfilePage";
import { ForgotPasswordPage, ResetPasswordPage } from "../pages/PasswordResetPage";

const NEW_PASSWORD = "5678";

let page: Page;
let state: JourneyState;

test.describe("Password reset journey", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    state = loadJourney();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("Reset link cannot be requested for an unregistered email", { tag: SUITES.negative }, async () => {
    const forgot = new ForgotPasswordPage(page);
    await forgot.requestReset(gmailAlias(`nobody${Date.now()}`));
    await expect(forgot.alert).toHaveText("Please input registered phone number or email.");
  });

  test("Password reset rejects an invalid reset token", { tag: SUITES.negative }, async () => {
    const reset = new ResetPasswordPage(page);
    await reset.resetPassword("/reset-password?token=invalid-token", NEW_PASSWORD);
    await expect(reset.alert).toHaveText("Invalid or expired password reset link. Please request a new one.");
  });

  test("Password reset rejects mismatched passwords", { tag: SUITES.negative }, async () => {
    const forgot = new ForgotPasswordPage(page);
    const sentAt = await forgot.requestReset(state.agent.email);
    await expect(forgot.alert).toContainText(/reset link has been sent/i);
    const link = await getPasswordResetLink(state.agent.email, sentAt);
    const reset = new ResetPasswordPage(page);
    await reset.resetPassword(link, NEW_PASSWORD, "0000");
    await expect(reset.alert).toHaveText("Passwords do not match.");
  });

  test("Agent password reset works successfully", { tag: SUITES.smoke }, async () => {
    const forgot = new ForgotPasswordPage(page);
    const sentAt = await forgot.requestReset(state.agent.email);
    await expect(forgot.alert).toContainText(/reset link has been sent/i);
    const link = await getPasswordResetLink(state.agent.email, sentAt);
    const reset = new ResetPasswordPage(page);
    await reset.resetPassword(link, NEW_PASSWORD);
    await expect(reset.alert).toContainText(/reset successfully/i);
    state = saveJourney({ agent: { ...state.agent, password: NEW_PASSWORD } });
  });

  // only meaningful once the password has been changed
  test("Login with the old password fails after password reset", { tag: SUITES.negative }, async () => {
    const loginPage = new LoginPage(page);
    await loginPage.submitCredentials({ email: state.agent.email, password: state.initialPassword });
    await expect(loginPage.errorAlert).toHaveText(LOGIN_FAILED);
    await expect(loginPage.otpInput).toBeHidden();
    await expect(page).toHaveURL(/\/login/);
  });

  test("Login with the new password succeeds", { tag: SUITES.smoke }, async () => {
    await new LoginPage(page).loginWithOtp(state.agent);
    await expect(new ProfilePage(page).emailInput).toHaveValue(state.agent.email);
    // hand the logged-in session to the self statement journey
    await page.context().storageState({ path: AGENT_AUTH_FILE });
  });
});
