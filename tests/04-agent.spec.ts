import { test, expect, Page } from "@playwright/test";
import { SUITES } from "../utils/suites";
import {
  AGENT_COMMISSION_RATE, CUSTOMER_DEPOSIT, DEPOSIT_LIMIT_ERROR, MAX_DEPOSIT, MIN_DEPOSIT, NON_EXISTENT_PHONE,
  SYSTEM_DEPOSIT,
} from "../utils/testData";
import { JourneyState, loadJourney, saveJourney } from "../utils/journeyState";
import { getLoginOtp } from "../utils/gmail";
import { LoginPage } from "../pages/LoginPage";
import { Header } from "../pages/Header";
import { ProfilePage } from "../pages/ProfilePage";
import { CashInPage } from "../pages/CashInPage";
import { SelfStatementPage } from "../pages/SelfStatementPage";

let page: Page;
let state: JourneyState;
let balanceBeforeCustomerDeposit = 0;

test.describe("Agent journey", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    state = loadJourney();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("Agent cannot log in with an invalid OTP", { tag: SUITES.negative }, async () => {
    const loginPage = new LoginPage(page);
    const sentAt = await loginPage.submitCredentials(state.agent);
    await expect(loginPage.otpInput).toBeVisible();
    // read the real OTP so the wrong one is guaranteed to differ (and this email is never reused);
    // never use 0000, which local setups accept as a dev bypass OTP
    const realOtp = await getLoginOtp(sentAt);
    await loginPage.otpInput.fill(realOtp === "1111" ? "2222" : "1111");
    await loginPage.verifyOtpBtn.click();
    await expect(loginPage.errorAlert).toHaveText("Invalid OTP. Please try again.");
    await expect(page).toHaveURL(/\/login/);
  });

  test("Agent can log in after activation", { tag: SUITES.smoke }, async () => {
    await new LoginPage(page).loginWithOtp(state.agent);
    await expect(new ProfilePage(page).roleInput).toHaveValue("Agent");
  });

  test("Agent balance is exactly 2000 Tk", { tag: SUITES.smoke }, async () => {
    balanceBeforeCustomerDeposit = await new ProfilePage(page).getBalance();
    expect(balanceBeforeCustomerDeposit).toBe(SYSTEM_DEPOSIT);
  });

  test("Agent cannot deposit less than the minimum amount", { tag: SUITES.negative }, async () => {
    const cashIn = new CashInPage(page);
    await cashIn.cashIn(state.customerPhone!, MIN_DEPOSIT - 1);
    await expect(cashIn.errorAlert).toHaveText(DEPOSIT_LIMIT_ERROR);
    await expect(cashIn.successMessage).toBeHidden();
  });

  test("Agent cannot deposit more than the maximum amount", { tag: SUITES.negative }, async () => {
    const cashIn = new CashInPage(page);
    await cashIn.cashIn(state.customerPhone!, MAX_DEPOSIT + 1);
    await expect(cashIn.errorAlert).toHaveText(DEPOSIT_LIMIT_ERROR);
    await expect(cashIn.successMessage).toBeHidden();
  });

  // within the per-transaction limits, so the request reaches the balance check
  test("Agent cannot deposit more than the available balance", { tag: SUITES.negative }, async () => {
    const cashIn = new CashInPage(page);
    await cashIn.cashIn(state.customerPhone!, SYSTEM_DEPOSIT + 1);
    await expect(cashIn.errorAlert).toHaveText("Insufficient balance");
    await expect(cashIn.successMessage).toBeHidden();
    expect(await new ProfilePage(page).getBalance()).toBe(SYSTEM_DEPOSIT);
  });

  test("Agent cannot deposit a negative amount", { tag: SUITES.negative }, async () => {
    const cashIn = new CashInPage(page);
    const result = await cashIn.submitBlockedByValidation(state.customerPhone!, -CUSTOMER_DEPOSIT);
    await expect(cashIn.amountError).toHaveText("Amount must be greater than 0.");
    expect(result.requested).toBe(false);
  });

  test("Agent cannot deposit to a non-existent account", { tag: SUITES.negative }, async () => {
    const cashIn = new CashInPage(page);
    await cashIn.cashIn(NON_EXISTENT_PHONE, CUSTOMER_DEPOSIT);
    await expect(cashIn.errorAlert).toHaveText("To Account does not exist");
    await expect(cashIn.successMessage).toBeHidden();
  });

  test("Agent cannot deposit to their own account", { tag: SUITES.negative }, async () => {
    const cashIn = new CashInPage(page);
    await cashIn.cashIn(state.agent.phone, CUSTOMER_DEPOSIT);
    await expect(cashIn.errorAlert).toHaveText("From account and to account cannot be the same");
    await expect(cashIn.successMessage).toBeHidden();
  });

  test("Agent can deposit 500 Tk to an existing Customer", { tag: SUITES.smoke }, async () => {
    const cashIn = new CashInPage(page);
    const response = page.waitForResponse((r) => r.url().endsWith("/transaction/deposit"));
    await cashIn.cashIn(state.customerPhone!, CUSTOMER_DEPOSIT);
    expect((await response).ok()).toBeTruthy();
    const receipt = await cashIn.getReceipt();
    expect(receipt.message).toMatch(/successful/i);
    expect(receipt.totalAmount).toBe(CUSTOMER_DEPOSIT);
    expect(receipt.transactionId).toMatch(/^TXN\w+$/);
    state = saveJourney({ customerDepositFee: receipt.serviceFee });
  });

  test("Agent balance is updated correctly after the transaction", { tag: SUITES.smoke }, async () => {
    const balance = await new ProfilePage(page).getBalance();
    const commission = CUSTOMER_DEPOSIT * AGENT_COMMISSION_RATE;
    expect(balance).toBe(balanceBeforeCustomerDeposit - CUSTOMER_DEPOSIT - state.customerDepositFee! + commission);
  });

  test("Customer deposit appears in the Agent's Self Statement", { tag: SUITES.smoke }, async () => {
    const statement = new SelfStatementPage(page);
    await statement.goto();
    const record = statement.bodyRows.filter({ hasText: state.customerPhone! }).first();
    await expect(record).toBeVisible();
    const cells = (await record.locator("td").allInnerTexts()).map((c) => c.trim());
    expect(cells[1]).toBe(state.agent.phone);
    expect(cells[2]).toBe(state.customerPhone);
    expect(cells[3]).toBe("Deposit Commission");
    expect(cells[4]).toBe(CUSTOMER_DEPOSIT.toFixed(2));
  });

  test("Agent logout works successfully", { tag: SUITES.smoke }, async () => {
    await new Header(page).logout();
  });

  test("Agent pages are not accessible after logout", { tag: SUITES.negative }, async () => {
    await page.goto("/agent/self-statement");
    await expect(page).toHaveURL(/\/login/);
  });
});
