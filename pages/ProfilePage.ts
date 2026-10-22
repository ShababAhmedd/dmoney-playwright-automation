import { expect, Locator, Page } from "@playwright/test";

export class ProfilePage {
  readonly page: Page;
  readonly balanceInput: Locator;
  readonly roleInput: Locator;
  readonly emailInput: Locator;
  readonly statusBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.balanceInput = page.getByRole("textbox", { name: "Current Balance (BDT)" });
    this.roleInput = page.getByRole("textbox", { name: "Role" });
    this.emailInput = page.getByRole("textbox", { name: "Email Address" });
    // shown only while the account is not active
    this.statusBanner = page.getByRole("main").getByRole("alert").filter({ hasText: /account is/i });
  }

  async goto() {
    await this.page.goto("/profile");
  }

  async getBalance(): Promise<number> {
    await this.goto();
    // wait until the profile has loaded real data
    await expect(this.emailInput).not.toHaveValue("");
    return Number(await this.balanceInput.inputValue());
  }
}
