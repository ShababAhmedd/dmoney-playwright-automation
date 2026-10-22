import { expect, Locator, Page } from "@playwright/test";

export class Header {
  readonly page: Page;
  readonly avatar: Locator;
  readonly logoutItem: Locator;

  constructor(page: Page) {
    this.page = page;
    this.avatar = page.getByRole("banner").locator(".MuiAvatar-root");
    this.logoutItem = page.getByRole("menuitem", { name: /Logout/ });
  }

  async logout() {
    await this.avatar.click();
    await this.logoutItem.click();
    await expect(this.page).toHaveURL(/\/login/);
  }
}
