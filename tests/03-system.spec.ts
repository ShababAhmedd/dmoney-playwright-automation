import { test, expect, Page } from "@playwright/test";
import { SUITES } from "../utils/suites";
import { LOGIN_FAILED, NON_EXISTENT_PHONE, SYSTEM, SYSTEM_DEPOSIT } from "../utils/testData";
import { JourneyState, loadJourney, saveJourney } from "../utils/journeyState";
import { LoginPage } from "../pages/LoginPage";
import { Header } from "../pages/Header";
import { ProfilePage } from "../pages/ProfilePage";
import { CashInPage } from "../pages/CashInPage";
import { SelfStatementPage } from "../pages/SelfStatementPage";

let page: Page;
let state: JourneyState;

test.describe("System journey", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    state = loadJourney();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("System cannot log in with a wrong password", { tag: SUITES.negative }, async () => {
    const loginPage = new LoginPage(page);
    await loginPage.submitCredentials({ email: SYSTEM.email, password: "9999" });
    await expect(loginPage.errorAlert).toHaveText(LOGIN_FAILED);
    await expect(page).toHaveURL(/\/login/);
  });

  test("System login is successful", { tag: SUITES.smoke }, async () => {
    await new LoginPage(page).login(SYSTEM);
    await expect(new ProfilePage(page).emailInput).toHaveValue(SYSTEM.email);
  });

  test("System cannot deposit to a non-existent account", { tag: SUITES.negative }, async () => {
    const cashIn = new CashInPage(page);
    await cashIn.cashIn(NON_EXISTENT_PHONE, SYSTEM_DEPOSIT);
    await expect(cashIn.errorAlert).toHaveText("To Account does not exist");
    await expect(cashIn.successMessage).toBeHidden();
  });

  test("System cannot deposit a zero amount to the Agent", { tag: SUITES.negative }, async () => {
    const result = await new CashInPage(page).submitBlockedByValidation(state.agent.phone, 0);
    expect(result.validationMessage).not.toBe("");
    expect(result.requested).toBe(false);
  });

  test("System can deposit 2000 Tk to the Agent", { tag: SUITES.smoke }, async () => {
    const cashIn = new CashInPage(page);
    const response = page.waitForResponse((r) => r.url().endsWith("/transaction/deposit"));
    await cashIn.cashIn(state.agent.phone, SYSTEM_DEPOSIT);
    expect((await response).ok()).toBeTruthy();
    const receipt = await cashIn.getReceipt();
    expect(receipt.message).toBe("SYSTEM deposit to Agent successful");
    expect(receipt.totalAmount).toBe(SYSTEM_DEPOSIT);
    expect(receipt.transactionId).toMatch(/^TXN\w+$/);
    state = saveJourney({ systemDepositTxnId: receipt.transactionId });
  });

  test("System deposit creates the correct transaction record", { tag: SUITES.smoke }, async () => {
    const statement = new SelfStatementPage(page);
    await statement.goto();
    const record = statement.bodyRows.filter({ hasText: state.systemDepositTxnId! });
    await expect(record).toHaveCount(1);
    const cells = (await record.locator("td").allInnerTexts()).map((c) => c.trim());
    expect(cells[0]).toBe(state.systemDepositTxnId);
    expect(cells[1]).toBe("SYSTEM");
    expect(cells[2]).toBe(state.agent.phone);
    expect(cells[3]).toBe("System Deposit to Agent");
    expect(Number(cells[4])).toBe(SYSTEM_DEPOSIT);
  });

  test("System logout works successfully", { tag: SUITES.smoke }, async () => {
    await new Header(page).logout();
  });

  test("Cash in is not accessible after System logout", { tag: SUITES.negative }, async () => {
    await page.goto("/agent/cash-in");
    await expect(page).toHaveURL(/\/login/);
  });
});
