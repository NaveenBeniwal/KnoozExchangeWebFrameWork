import { test, expect } from '../../src/fixtures/pagefixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { PortfolioOverviewPage } from '../../src/pages/portfolio/overview';
import { CsvHelper } from '../../src/utils/CsvHelper';
import type { Browser, BrowserContext, Page } from '@playwright/test';

const portfolioData = CsvHelper.readCsv('src/data/portfolioValidationData.csv');
const walletItems   = portfolioData.filter(r => r.type === 'wallet');
const coinItems     = portfolioData.filter(r => r.type === 'coin');

let browser:      Browser;
let context:      BrowserContext;
let page:         Page;
let loginPage:    LoginPage;
let portfolioPage: PortfolioOverviewPage;

// Single shared login (one browser/context/page for the whole file) instead of re-logging in
// fresh before every test — 27 fresh logins across 4 parallel workers were hammering the same
// staging account/server concurrently, which pushed the beforeEach hook past its 30s timeout on
// most tests and even caused visible-element false negatives under the resulting load.
// mode: 'default' (not .serial()) keeps all tests in this one worker/login but lets every test
// run independently: one test failing does not skip the rest.
test.describe('Portfolio Overview Page', () => {
    test.describe.configure({ mode: 'default' });

    test.beforeAll(async ({ playwright }, testInfo) => {
        test.setTimeout(60000);
        browser      = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context      = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
        page         = await context.newPage();
        loginPage    = new LoginPage(page);
        portfolioPage = new PortfolioOverviewPage(page);
        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!);
        await portfolioPage.goToPortfolio();
    });

    test.afterAll(async () => { await browser.close(); });

// ─── Header ──────────────────────────────────────────────────────────────────

test('back button is visible on portfolio page @smoke @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isBackButtonVisible();
    // Assert
    expect(isVisible).toBe(true);
});

test('Deposit & Withdraw button is visible on portfolio page @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isDepositWithdrawButtonVisible();
    // Assert
    expect(isVisible).toBe(true);
});

// ─── Estimated Balance ────────────────────────────────────────────────────────

test('estimated balance label is visible @smoke @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isEstimatedBalanceVisible();
    // Assert
    expect(isVisible).toBe(true);
});

test('balance amount contains USDT @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const balanceText = await portfolioPage.getBalanceText();
    // Assert
    expect(balanceText).toContain('USDT');
});

test('balance toggle icon is visible @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isBalanceToggleIconVisible();
    // Assert
    expect(isVisible).toBe(true);
});

// ─── Tabs ────────────────────────────────────────────────────────────────────

test('Overview tab is visible @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isTabVisible('Overview');
    // Assert
    expect(isVisible).toBe(true);
});

test('Spot tab is visible @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isTabVisible('Spot');
    // Assert
    expect(isVisible).toBe(true);
});

test('Funding tab is visible @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isTabVisible('Funding');
    // Assert
    expect(isVisible).toBe(true);
});

test('Grid tab is visible @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isTabVisible('Grid');
    // Assert
    expect(isVisible).toBe(true);
});

test('Copy tab is visible @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isTabVisible('Copy');
    // Assert
    expect(isVisible).toBe(true);
});

// ─── My Assets ───────────────────────────────────────────────────────────────

test('My Assets heading is visible @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isMyAssetsVisible();
    // Assert
    expect(isVisible).toBe(true);
});

// ─── Wallet Section ──────────────────────────────────────────────────────────

test('Wallet section heading is visible @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isWalletSectionVisible();
    // Assert
    expect(isVisible).toBe(true);
});

test('Wallet section shows Spot row @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isWalletRowVisible('Spot');
    // Assert
    expect(isVisible).toBe(true);
});

test('Wallet section shows Funding row @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isWalletRowVisible('Funding');
    // Assert
    expect(isVisible).toBe(true);
});

test('Wallet section shows Grid row @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isWalletRowVisible('Grid');
    // Assert
    expect(isVisible).toBe(true);
});

test('Wallet section shows Copy row @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isWalletRowVisible('Copy');
    // Assert
    expect(isVisible).toBe(true);
});

// ─── Coin View Section ───────────────────────────────────────────────────────

test('Coin View section heading is visible @sanity @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isCoinViewSectionVisible();
    // Assert
    expect(isVisible).toBe(true);
});

test('Coin View shows Tether USDT @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isCoinVisible('Tether USDT');
    // Assert
    expect(isVisible).toBe(true);
});

test('Coin View shows Ethereum @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isCoinVisible('Ethereum');
    // Assert
    expect(isVisible).toBe(true);
});

test('Coin View shows Bitcoin @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const isVisible = await portfolioPage.isCoinVisible('Bitcoin');
    // Assert
    expect(isVisible).toBe(true);
});

// ─── Estimated Balance Verification ──────────────────────────────────────────

test('estimated balance is a valid positive number @regression', async () => {
    // Arrange — portfolio page loaded in beforeEach
    // Act
    const balance = await portfolioPage.getEstimatedBalanceAmount();
    // Assert
    expect(balance).toBeGreaterThan(0);
});

// ─── Wallet Amount Verification ───────────────────────────────────────────────

test('wallet section shows valid non-negative amounts for all rows @regression', async () => {
    // Arrange
    const estimatedBalance = await portfolioPage.getEstimatedBalanceAmount();

    for (const item of walletItems) {
        // Act
        const { amount } = await portfolioPage.getWalletRowData(item.name);
        // Assert
        expect.soft(amount, `${item.name}: amount should be >= 0`).toBeGreaterThanOrEqual(0);
        expect.soft(amount, `${item.name}: amount should not exceed estimated balance`).toBeLessThanOrEqual(estimatedBalance + 1);
    }
});

// ─── Wallet Ratio Verification ────────────────────────────────────────────────

test('wallet ratios are mathematically correct relative to estimated balance @regression', async () => {
    const estimatedBalance = await portfolioPage.getEstimatedBalanceAmount();

    for (const item of walletItems) {
        const { amount, displayedRatio } = await portfolioPage.getWalletRowData(item.name);
        const expectedRatio = portfolioPage.calculateExpectedRatio(amount, estimatedBalance);
        const tolerance     = parseInt(item.tolerance);
        const inRange       = Math.abs(displayedRatio - expectedRatio) <= tolerance;
        expect.soft(
            inRange ? `${expectedRatio}%` : `${displayedRatio}%`,
            `${item.name} Ratio  |  calculated: round(${amount} / ${estimatedBalance} × 100) = ${expectedRatio}%  |  tolerance ±${tolerance}%`
        ).toBe(`${expectedRatio}%`);
    }
});

// ─── Wallet Sum Verification ──────────────────────────────────────────────────

test('sum of all wallet amounts equals estimated balance @regression', async () => {
    const estimatedBalance = await portfolioPage.getEstimatedBalanceAmount();
    let walletTotal = 0;
    const parts: { name: string; amount: number }[] = [];

    for (const item of walletItems) {
        const { amount } = await portfolioPage.getWalletRowData(item.name);
        walletTotal += amount;
        parts.push({ name: item.name, amount });
    }

    const equation = parts.map(p => `${p.name}(${p.amount})`).join(' + ');
    console.log(
        `[Portfolio] Balance check:\n` +
        `  Estimated balance : ${estimatedBalance.toFixed(8)} USDT\n` +
        `  Wallet breakdown  : ${equation} = ${walletTotal.toFixed(8)} USDT`
    );

    // Expected = estimated balance shown on screen
    // Received = sum of all wallet amounts — they must match (rounded to 4dp to absorb fp noise)
    expect(
        `${walletTotal.toFixed(4)} USDT`,
        `Sum of all wallets (${equation}) should equal the Estimated Balance`
    ).toBe(`${estimatedBalance.toFixed(4)} USDT`);
});

// ─── Coin View Amount Verification ───────────────────────────────────────────

test('coin view shows valid non-negative USD values for all coins @regression', async () => {
    const estimatedBalance = await portfolioPage.getEstimatedBalanceAmount();

    for (const item of coinItems) {
        const { usdValue } = await portfolioPage.getCoinRowData(item.name);
        expect.soft(usdValue, `${item.name}: USD value should be >= 0`).toBeGreaterThanOrEqual(0);
        expect.soft(usdValue, `${item.name}: USD value should not exceed estimated balance`).toBeLessThanOrEqual(estimatedBalance + 1);
    }
});

// ─── Coin View Ratio Verification ─────────────────────────────────────────────

test('coin view ratios are mathematically correct relative to estimated balance @regression', async () => {
    const estimatedBalance = await portfolioPage.getEstimatedBalanceAmount();

    for (const item of coinItems) {
        const { usdValue, displayedRatio } = await portfolioPage.getCoinRowData(item.name);
        const expectedRatio = portfolioPage.calculateExpectedRatio(usdValue, estimatedBalance);
        const tolerance     = parseInt(item.tolerance);
        const inRange       = Math.abs(displayedRatio - expectedRatio) <= tolerance;
        expect.soft(
            inRange ? `${expectedRatio}%` : `${displayedRatio}%`,
            `${item.name} Ratio  |  calculated: round($${usdValue} / ${estimatedBalance} × 100) = ${expectedRatio}%  |  tolerance ±${tolerance}%`
        ).toBe(`${expectedRatio}%`);
    }
});

// ─── Coin View Sum Verification ───────────────────────────────────────────────

test('sum of all coin USD values equals estimated balance @regression', async () => {
    const estimatedBalance = await portfolioPage.getEstimatedBalanceAmount();
    let coinTotal = 0;
    const parts: { name: string; usdValue: number }[] = [];

    for (const item of coinItems) {
        const { usdValue } = await portfolioPage.getCoinRowData(item.name);
        coinTotal += usdValue;
        parts.push({ name: item.name, usdValue });
    }

    const equation = parts.map(p => `${p.name}($${p.usdValue})`).join(' + ');
    console.log(
        `[Portfolio] Coin balance check:\n` +
        `  Estimated balance : ${estimatedBalance.toFixed(4)} USDT\n` +
        `  Coin breakdown    : ${equation} = $${coinTotal.toFixed(4)}`
    );

    // Expected = estimated balance  |  Received = sum of coin USD values
    // Small buffer (0.3% of the estimated balance) absorbs penny-level rounding drift from
    // summing individually-rounded per-coin USD values against the balance rounded once as a
    // whole, without masking a genuine mismatch.
    const tolerance = estimatedBalance * 0.003;
    const inRange    = Math.abs(coinTotal - estimatedBalance) <= tolerance;
    expect(
        inRange ? `$${estimatedBalance.toFixed(2)}` : `$${coinTotal.toFixed(2)}`,
        `Sum of all coin USD values (${equation}) should equal the Estimated Balance (±0.3% tolerance)`
    ).toBe(`$${estimatedBalance.toFixed(2)}`);
});

});
