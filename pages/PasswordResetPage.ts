import { Locator, Page } from "@playwright/test";

export class ForgotPasswordPage {
  readonly page: Page;
  readonly identifierInput: Locator;
  readonly sendLinkBtn: Locator;
  readonly alert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.identifierInput = page.getByRole("textbox", { name: "Email or Phone Number" });
    this.sendLinkBtn = page.getByRole("button", { name: "Send Reset Link →" });
    this.alert = page.getByRole("alert").filter({ hasText: /\S/ });
  }

  /** Requests a reset link. Returns the time the request was sent (for email lookup). */
  async requestReset(emailOrPhone: string): Promise<number> {
    await this.page.goto("/forgot-password");
    await this.identifierInput.fill(emailOrPhone);
    const sentAt = Date.now();
    await this.sendLinkBtn.click();
    return sentAt;
  }
}

export class ResetPasswordPage {
  readonly page: Page;
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly resetBtn: Locator;
  readonly alert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newPasswordInput = page.getByRole("textbox", { name: "New Password", exact: true });
    this.confirmPasswordInput = page.getByRole("textbox", { name: "Confirm New Password" });
    this.resetBtn = page.getByRole("button", { name: /Reset Password/ });
    this.alert = page.getByRole("alert").filter({ hasText: /\S/ });
  }

  async resetPassword(link: string, newPassword: string, confirmPassword = newPassword) {
    await this.page.goto(link);
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.resetBtn.click();
  }
}
