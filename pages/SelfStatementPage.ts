import { expect, Locator, Page } from "@playwright/test";

export interface StatementRow {
  transactionId: string;
  sender: string;
  receiver: string;
  type: string;
  debit: string;
  credit: string;
  balance: string;
  date: string;
}

export class SelfStatementPage {
  readonly page: Page;
  readonly table: Locator;
  readonly headerCells: Locator;
  readonly bodyRows: Locator;
  readonly nextPageBtn: Locator;
  readonly currentBalanceHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.table = page.getByRole("main").getByRole("table");
    this.headerCells = this.table.locator("thead th");
    this.bodyRows = this.table.locator("tbody tr");
    this.nextPageBtn = page.getByRole("button", { name: "Go to next page" });
    this.currentBalanceHeading = page.getByRole("heading", { name: /Current Balance/ });
  }

  async goto() {
    await this.page.goto("/agent/self-statement");
    await expect(this.headerCells.first()).toBeVisible();
    await this.page.waitForLoadState("networkidle");
  }

  async getHeaders(): Promise<string[]> {
    return (await this.headerCells.allInnerTexts()).map((h) => h.trim());
  }

  /** Reads every row on every page of the statement table. */
  async getAllRows(): Promise<string[][]> {
    const rows: string[][] = [];
    while (true) {
      for (const row of await this.bodyRows.all()) {
        const cells = (await row.locator("td").allInnerTexts()).map((c) => c.trim());
        if (cells.length > 1) rows.push(cells); // skip "no data" placeholder rows
      }
      if (!(await this.nextPageBtn.isVisible()) || (await this.nextPageBtn.isDisabled())) break;
      const firstRow = await this.bodyRows.first().innerText();
      await this.nextPageBtn.click();
      await expect(this.bodyRows.first()).not.toHaveText(firstRow);
    }
    return rows;
  }

  static toStatementRow([transactionId, sender, receiver, type, debit, credit, balance, date]: string[]): StatementRow {
    return { transactionId, sender, receiver, type, debit, credit, balance, date };
  }
}
