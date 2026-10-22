import { expect, Locator, Page } from "@playwright/test";

export interface CashInReceipt {
  message: string;
  transactionId: string;
  totalAmount: number;
  serviceFee: number;
}

/** Cash In screen — used by SYSTEM (deposit to agent) and Agent (deposit to customer). */
export class CashInPage {
  readonly page: Page;
  readonly phoneInput: Locator;
  readonly amountInput: Locator;
  readonly cashInBtn: Locator;
  readonly errorAlert: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.phoneInput = page.getByRole("textbox", { name: "Customer Phone Number" });
    this.amountInput = page.getByRole("spinbutton", { name: "Amount (BDT)" });
    this.cashInBtn = page.getByRole("button", { name: "Cash In →" });
    this.errorAlert = page.getByRole("main").getByRole("alert");
    this.successMessage = page.getByRole("main").getByText(/successful/i);
  }

  async goto() {
    await this.page.goto("/agent/cash-in");
  }

  async cashIn(phone: string, amount: number | string) {
    await this.goto();
    await this.phoneInput.fill(phone);
    await this.amountInput.fill(String(amount));
    await this.cashInBtn.click();
  }

  /**
   * Submits a cash in that the browser's own validation should block (e.g. amount 0, min=1).
   * Returns the native validation message and whether a deposit request was sent anyway.
   */
  async submitBlockedByValidation(phone: string, amount: number | string) {
    let requested = false;
    const onRequest = (r: { url(): string }) => {
      if (r.url().endsWith("/transaction/deposit")) requested = true;
    };
    this.page.on("request", onRequest);
    await this.cashIn(phone, amount);
    const validationMessage = await this.amountInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    await expect(this.successMessage).toBeHidden();
    this.page.off("request", onRequest);
    return { validationMessage, requested };
  }

  /** Reads the receipt shown after a successful cash in. */
  async getReceipt(): Promise<CashInReceipt> {
    await expect(this.successMessage).toBeVisible();
    const main = this.page.getByRole("main");
    const valueAfter = (label: string) =>
      main.getByText(label, { exact: true }).locator("xpath=following-sibling::*[1]").innerText();
    const money = (text: string) => Number(text.replace(/[^\d.]/g, ""));
    return {
      message: (await this.successMessage.innerText()).trim(),
      transactionId: (await valueAfter("Transaction ID")).trim(),
      totalAmount: money(await valueAfter("Total Amount")),
      serviceFee: money(await valueAfter("Service Fee")),
    };
  }
}
