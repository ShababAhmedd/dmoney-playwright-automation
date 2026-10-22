import { expect, Locator, Page } from "@playwright/test";

export class UserDetailsPage {
  readonly page: Page;
  readonly editBtn: Locator;
  readonly saveBtn: Locator;
  readonly statusSelect: Locator;
  readonly statusBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.editBtn = page.getByRole("button", { name: "Edit User" });
    this.saveBtn = page.getByRole("button", { name: "Save Changes" });
    // second combobox on the page: Role, then Account Status
    this.statusSelect = page.getByRole("main").getByRole("combobox").nth(1);
    this.statusBadge = page.getByRole("main").getByText(/^(ACTIVE|PENDING|SUSPENDED)$/);
  }

  async goto(userId: string) {
    await this.page.goto(`/admin/users/${userId}`);
    await expect(this.editBtn).toBeVisible();
  }

  async setStatus(status: "Active" | "Pending" | "Suspended") {
    await this.editBtn.click();
    await this.statusSelect.click();
    await this.page.getByRole("option", { name: status, exact: true }).click();
    await this.saveBtn.click();
  }
}
