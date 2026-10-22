import { Locator, Page } from "@playwright/test";
import { NewUser } from "../utils/testData";

export class RegisterPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly phoneInput: Locator;
  readonly nidInput: Locator;
  readonly roleSelect: Locator;
  readonly createAccountBtn: Locator;
  readonly alert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.getByRole("textbox", { name: "Full Name" });
    this.emailInput = page.getByRole("textbox", { name: "Email Address" });
    this.passwordInput = page.getByRole("textbox", { name: "Password" });
    this.phoneInput = page.getByRole("textbox", { name: "Phone Number" });
    this.nidInput = page.getByRole("textbox", { name: "National ID (NID)" });
    this.roleSelect = page.getByRole("combobox");
    this.createAccountBtn = page.getByRole("button", { name: "Create Account →" });
    this.alert = page.getByRole("alert").filter({ hasText: /\S/ });
  }

  /** Opens the portal home page and follows the "Sign Up" link. */
  async openFromHome() {
    await this.page.goto("/");
    await this.page.getByRole("banner").getByRole("link", { name: "Sign Up" }).click();
    await this.page.waitForURL(/\/register/);
  }

  async register(user: NewUser) {
    await this.nameInput.fill(user.name);
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
    await this.phoneInput.fill(user.phone);
    await this.nidInput.fill(user.nid);
    await this.roleSelect.click();
    await this.page.getByRole("option", { name: user.role }).click();
    await this.createAccountBtn.click();
  }
}
