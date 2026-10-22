import { expect, Locator, Page } from "@playwright/test";
import { Credentials } from "../utils/testData";
import { getLoginOtp } from "../utils/gmail";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginBtn: Locator;
  readonly otpInput: Locator;
  readonly verifyOtpBtn: Locator;
  readonly errorAlert: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByRole("textbox", { name: "Email or Phone Number" });
    this.passwordInput = page.getByRole("textbox", { name: "Password" });
    this.loginBtn = page.getByRole("button", { name: "Login →" });
    this.otpInput = page.getByRole("textbox", { name: "Enter 4-Digit OTP" });
    this.verifyOtpBtn = page.getByRole("button", { name: "Verify OTP →" });
    this.errorAlert = page.getByRole("alert").filter({ hasText: /\S/ });
    this.forgotPasswordLink = page.getByText("Forgot password?");
  }

  async goto() {
    await this.page.goto("/login");
  }

  /** Submits email + password. Returns the time the request was sent (for OTP lookup). */
  async submitCredentials(user: Credentials): Promise<number> {
    await this.goto();
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
    const sentAt = Date.now();
    await this.loginBtn.click();
    return sentAt;
  }

  /** Logs in without OTP (Admin / System). */
  async login(user: Credentials) {
    await this.submitCredentials(user);
    await expect(this.page).toHaveURL(/\/profile/);
  }

  /** Logs in with password, then reads the OTP from Gmail and verifies it. */
  async loginWithOtp(user: Credentials) {
    const sentAt = await this.submitCredentials(user);
    await expect(this.otpInput).toBeVisible();
    const otp = await getLoginOtp(sentAt);
    await this.otpInput.fill(otp);
    await this.verifyOtpBtn.click();
    await expect(this.page).toHaveURL(/\/profile/);
  }
}
