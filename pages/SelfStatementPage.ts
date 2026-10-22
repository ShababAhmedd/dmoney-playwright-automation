import { expect, Locator, Page } from "@playwright/test";
import { todayStamp } from "../utils/csv";

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
  readonly menuLink: Locator;
  readonly fromDateInput: Locator;
  readonly toDateInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.table = page.getByRole("main").getByRole("table");
    this.headerCells = this.table.locator("thead th");
    this.bodyRows = this.table.locator("tbody tr");
    this.nextPageBtn = page.getByRole("button", { name: "Go to next page" });
    this.currentBalanceHeading = page.getByRole("heading", { name: /Current Balance/ });
    // the left menu also renders a hidden mobile drawer, so only the visible link counts
    this.menuLink = page.getByRole("navigation").getByRole("link", { name: "Self Statement" }).filter({ visible: true });
    this.fromDateInput = page.getByLabel("From Date");
    this.toDateInput = page.getByLabel("To Date");
  }

  /** Opens the Self Statement section from the left menu. */
  async goto() {
    if (!this.page.url().startsWith("http")) await this.page.goto("/profile");
    await this.menuLink.click();
    await expect(this.page).toHaveURL(/\/agent\/self-statement/);
    await expect(this.headerCells.first()).toBeVisible();
    // the page defaults the filter to the UTC date, which hides today's rows
    // between local midnight and UTC midnight, so set it to the local date
    const today = todayStamp();
    await this.toDateInput.fill(today);
    await this.fromDateInput.fill(today);
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
