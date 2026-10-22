import { expect, Locator, Page } from "@playwright/test";

export class AdminUsersPage {
  readonly page: Page;
  readonly searchType: Locator;
  readonly emailSearchInput: Locator;
  readonly searchBtn: Locator;
  readonly rows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchType = page.getByRole("combobox").first();
    this.emailSearchInput = page.getByRole("textbox", { name: "Enter Email" });
    this.searchBtn = page.getByRole("button", { name: "Search", exact: true });
    this.rows = page.locator("table tbody tr");
  }

  async goto() {
    await this.page.goto("/admin/users");
    await expect(this.rows.first()).toBeVisible();
  }

  async searchByEmail(email: string): Promise<Locator> {
    await this.searchType.click();
    await this.page.getByRole("option", { name: "Search by Email" }).click();
    await this.emailSearchInput.fill(email);
    await this.searchBtn.click();
    const row = this.rows.filter({ hasText: email });
    await expect(row).toHaveCount(1);
    return row;
  }

  /** Column order: ID, Name, Email, Phone, Balance, Role, Status, Registered Date, Action */
  async getCell(row: Locator, column: "ID" | "Phone" | "Role" | "Status" | "Balance"): Promise<string> {
    const index = { ID: 0, Phone: 3, Balance: 4, Role: 5, Status: 6 }[column];
    return (await row.locator("td").nth(index).innerText()).trim();
  }

  async searchByRole(role: "Admin" | "Agent" | "Customer" | "Merchant") {
    await this.searchType.click();
    await this.page.getByRole("option", { name: "Search by Role" }).click();
    await this.page.getByRole("combobox").nth(1).click();
    await this.page.getByRole("option", { name: role, exact: true }).click();
    await this.searchBtn.click();
    await expect(this.rows.filter({ hasText: role }).first()).toBeVisible();
  }

  /**
   * Returns the ID and phone of an existing customer with a valid local phone number.
   * Note: the role search does not return a user's status, so check it on the details page.
   */
  async findExistingCustomer(): Promise<{ id: string; phone: string }> {
    await this.goto();
    await this.searchByRole("Customer");
    const customer = this.rows.filter({ has: this.page.locator("td", { hasText: /^01\d{9}$/ }) }).first();
    await expect(customer).toBeVisible();
    return { id: await this.getCell(customer, "ID"), phone: await this.getCell(customer, "Phone") };
  }
}
