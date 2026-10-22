import fs from "fs";
import { test, expect, Page } from "@playwright/test";
import { SUITES } from "../utils/suites";
import { AGENT_COMMISSION_RATE, CUSTOMER_DEPOSIT, SYSTEM_DEPOSIT } from "../utils/testData";
import { AGENT_AUTH_FILE, JourneyState, loadJourney } from "../utils/journeyState";
import { parseCsv, saveSelfStatementCsv } from "../utils/csv";
import { SelfStatementPage } from "../pages/SelfStatementPage";

let page: Page;
let state: JourneyState;
let csvHeaders: string[] = [];
let csvRows: string[][] = [];

test.describe("Self Statement journey", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    state = loadJourney();
    // reuse the agent session from the password reset journey (logged in with the new password)
    const context = await browser.newContext({ storageState: AGENT_AUTH_FILE });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("Self Statement contains the expected transaction data", { tag: SUITES.smoke }, async () => {
    const statement = new SelfStatementPage(page);
    await statement.goto();
    csvHeaders = await statement.getHeaders();
    expect(csvHeaders).toEqual([
      "Transaction ID", "Sender Account", "Receiver Account", "Type", "Debit", "Credit", "Balance", "Date",
    ]);
    csvRows = await statement.getAllRows();
    const transactions = csvRows.map(SelfStatementPage.toStatementRow);
    expect(transactions).toHaveLength(2);

    const commission = CUSTOMER_DEPOSIT * AGENT_COMMISSION_RATE;
    const balanceAfterDeposit = SYSTEM_DEPOSIT - CUSTOMER_DEPOSIT + commission;

    expect(transactions.find((t) => t.sender === "SYSTEM")).toMatchObject({
      receiver: state.agent.phone,
      type: "Top-up from SYSTEM",
      debit: "-",
      credit: SYSTEM_DEPOSIT.toFixed(2),
      balance: SYSTEM_DEPOSIT.toFixed(2),
    });
    expect(transactions.find((t) => t.receiver === state.customerPhone)).toMatchObject({
      sender: state.agent.phone,
      type: "Deposit Commission",
      debit: CUSTOMER_DEPOSIT.toFixed(2),
      credit: commission.toFixed(2),
      balance: balanceAfterDeposit.toFixed(2),
    });
    await expect(statement.currentBalanceHeading).toHaveText(`Current Balance: BDT ${balanceAfterDeposit.toFixed(2)}`);
    for (const t of transactions) expect(t.transactionId).toMatch(/^TXN\w+$/);
  });

  test("Self Statement data is saved into the required CSV file", { tag: SUITES.smoke }, async () => {
    expect(csvRows.length).toBeGreaterThan(0);
    const filePath = saveSelfStatementCsv(csvHeaders, csvRows);
    expect(filePath).toMatch(/self_statement_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(fs.existsSync(filePath)).toBeTruthy();
    const saved = parseCsv(fs.readFileSync(filePath, "utf8"));
    expect(saved[0]).toEqual(csvHeaders);
    expect(saved.slice(1)).toEqual(csvRows);
    await test.info().attach("self-statement.csv", { path: filePath, contentType: "text/csv" });
  });
});
