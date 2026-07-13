# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: portfolio/funding.spec.ts >> Portfolio Funding Page >> TC-F01: Login with valid credentials lands on the home page @smoke @sanity
- Location: tests/portfolio/funding.spec.ts:56:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  1   | import { test, expect } from '../../src/fixtures/pagefixtures';
  2   | import { LoginPage } from '../../src/pages/LoginPage';
  3   | import { PortfolioFundingPage } from '../../src/pages/portfolio/funding';
  4   | import { PortfolioSpotPage } from '../../src/pages/portfolio/spot';
  5   | import { CsvHelper } from '../../src/utils/CsvHelper';
  6   | import type { Browser, BrowserContext, Page } from '@playwright/test';
  7   | 
  8   | // Every row here becomes its own independent set of per-currency tests below — add or remove a row
  9   | // and the suite scales automatically, no test code changes needed.
  10  | const currencies = CsvHelper.readCsv('src/data/fundingTransferData.csv');
  11  | const actions = ['Deposit', 'Withdraw', 'Transfer'] as const;
  12  | 
  13  | // The Transfer flow below runs against exactly ONE currency — to test BTC/ETH/BNB instead, just
  14  | // edit this row (coin/symbol/network/amounts), no test code changes needed. Kept separate from
  15  | // `currencies` above so it doesn't affect the Deposit/Withdraw/search tests, which still cover
  16  | // every row in fundingTransferData.csv.
  17  | const transferCurrency = CsvHelper.readCsv('src/data/fundingTransferSingleData.csv')[0];
  18  | 
  19  | let browser:      Browser;
  20  | let context:      BrowserContext;
  21  | let page:         Page;
  22  | let loginPage:    LoginPage;
  23  | let fundingPage:  PortfolioFundingPage;
  24  | let spotPage:     PortfolioSpotPage;
  25  | 
  26  | // Single shared login (one browser/context/page for the whole file) — logging in fresh per test
  27  | // would mean 55 real logins hammering the same staging account, the exact resource/rate-limit
  28  | // problem every other spec in this suite already works around the same way.
  29  | test.describe('Portfolio Funding Page', () => {
  30  |     // serial: forces every test in this file onto one worker/one browser session in file order —
  31  |     // no risk of fullyParallel splitting these 55 tests across multiple workers, which would mean
  32  |     // multiple browsers hitting the same real staging account concurrently (a very plausible cause
  33  |     // of the confusing, inconsistent balance reads seen in an earlier run of this suite). Tests are
  34  |     // also laid out below in strict TC-F01 → TC-F22 numeric order (each per-coin TC gets its own
  35  |     // loop over every currency before moving to the next TC number), not grouped by coin. TC-F09
  36  |     // through TC-F19 are the Transfer flow, which runs against a single CSV-configured currency
  37  |     // rather than looping over every row.
  38  |     test.describe.configure({ mode: 'serial', timeout: 60000 });
  39  | 
  40  |     test.beforeAll(async ({ playwright }, testInfo) => {
  41  |         browser     = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
  42  |         context     = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
  43  |         page        = await context.newPage();
  44  |         loginPage   = new LoginPage(page);
  45  |         fundingPage = new PortfolioFundingPage(page);
  46  |         spotPage    = new PortfolioSpotPage(page);
  47  |         await loginPage.goToLoginPage();
  48  |         await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!);
  49  |     });
  50  | 
  51  |     test.afterAll(async () => { await browser.close(); });
  52  | 
  53  |     // ─── TC-F01 ───────────────────────────────────────────────────────────────────
  54  |     // Checked against the shared beforeAll login (not a second independent login) — repeating a
  55  |     // full login per test would mean 55 real "Get OTP" clicks against the same account.
  56  |     test('TC-F01: Login with valid credentials lands on the home page @smoke @sanity', async () => {
> 57  |         expect(await loginPage.isUserOnHomePage()).toBe(true);
      |                                                    ^ Error: expect(received).toBe(expected) // Object.is equality
  58  |     });
  59  | 
  60  |     // Every test below is independent: its own beforeEach re-navigates Portfolio > Spot > Funding
  61  |     // fresh, so no test depends on another's leftover state (open modal, active search, checkbox).
  62  |     test.describe('Funding tab', () => {
  63  |         // TC-F02 does its own navigation (via Spot) as the whole point of the test — navigating
  64  |         // here first as well would just log/perform the same trip twice for no reason.
  65  |         test.beforeEach(async ({}, testInfo) => {
  66  |             if (!testInfo.title.startsWith('TC-F02')) {
  67  |                 await fundingPage.goToFundingTab();
  68  |             }
  69  |         });
  70  | 
  71  |         // ─── TC-F02 ─────────────────────────────────────────────────────────────
  72  |         // The only test that actually exercises the Spot hop — beforeEach uses the direct Funding
  73  |         // path for every other test (see goToFundingTab()'s comment in the page object for why).
  74  |         test('TC-F02: Navigate Portfolio > Spot > Funding tab loads the Funding table @smoke @sanity', async () => {
  75  |             await fundingPage.goToFundingTabViaSpot();
  76  |             expect(await fundingPage.isFundingTabVisible()).toBe(true);
  77  |             expect(await fundingPage.getVisibleRowCount()).toBeGreaterThan(0);
  78  |         });
  79  | 
  80  |         // ─── TC-F03 ─────────────────────────────────────────────────────────────
  81  |         test('TC-F03: Top balance section shows Estimated Balance and equals the sum of all coins @sanity', async () => {
  82  |             expect.soft(await fundingPage.isEstimatedBalanceLabelVisible(), 'Estimated Balance label should be visible').toBe(true);
  83  |             expect.soft(await fundingPage.isEstimatedBalanceAmountVisible(), 'Estimated Balance amount should be visible').toBe(true);
  84  |             expect.soft(await fundingPage.isEstimatedBalanceUsdValueVisible(), 'Estimated Balance $ value should be visible').toBe(true);
  85  | 
  86  |             const balances  = await fundingPage.getAllCoinBalances();
  87  |             const sum       = balances.reduce((total, b) => total + b.totalUsd, 0);
  88  |             const estimated = await fundingPage.getEstimatedBalanceAmount(sum);
  89  |             expect.soft(estimated, `Estimated Balance (${estimated}) should equal the sum of all coin rows (${sum.toFixed(4)})`).toBeCloseTo(sum, 1);
  90  |         });
  91  | 
  92  |         // ─── TC-F04 ─────────────────────────────────────────────────────────────
  93  |         test('TC-F04: Eye icon masks and reveals the Estimated Balance @sanity', async () => {
  94  |             expect.soft(await fundingPage.isBalanceMasked(), 'Balance should start revealed').toBe(false);
  95  |             await fundingPage.clickBalanceToggle();
  96  |             expect.soft(await fundingPage.isBalanceMasked(), 'Balance should be masked after clicking the eye icon').toBe(true);
  97  |             await fundingPage.clickBalanceToggle();
  98  |             expect.soft(await fundingPage.isBalanceMasked(), 'Balance should be revealed again after clicking the eye icon a second time').toBe(false);
  99  |         });
  100 | 
  101 |         // ─── TC-F05 ─────────────────────────────────────────────────────────────
  102 |         test('TC-F05: Funding table headers are all visible @sanity', async () => {
  103 |             const headers = ['Coin', 'Funding Balance', 'In Order', 'Total', 'Action'] as const;
  104 |             for (const header of headers) {
  105 |                 expect.soft(await fundingPage.isTableHeaderVisible(header), `"${header}" header should be visible`).toBe(true);
  106 |             }
  107 |         });
  108 | 
  109 |         // =========================================================================
  110 |         // Per-currency tests — one independent test per row in fundingTransferData.csv, run in
  111 |         // strict TC-number order (every coin's TC-F06 first, then every coin's TC-F07, etc.).
  112 |         // Adding/removing a currency row scales this suite automatically.
  113 |         // =========================================================================
  114 | 
  115 |         // ─── TC-F06 ─────────────────────────────────────────────────────────────
  116 |         for (const row of currencies) {
  117 |             test(`TC-F06 [${row.coin}]: row shows numeric, self-consistent balances and all 3 actions @sanity`, async () => {
  118 |                 expect.soft(await fundingPage.isCoinRowVisible(row.coin), `${row.coin} row should exist`).toBe(true);
  119 | 
  120 |                 const { fundingBalanceNative, inOrderNative, totalNative } = await fundingPage.getCoinRowData(row.coin);
  121 |                 expect.soft(fundingBalanceNative, `${row.coin} Funding Balance should be a valid number`).toBeGreaterThanOrEqual(0);
  122 |                 expect.soft(inOrderNative, `${row.coin} In Order should be a valid number`).toBeGreaterThanOrEqual(0);
  123 |                 expect.soft(totalNative, `${row.coin} Total should equal Funding Balance + In Order`)
  124 |                     .toBeCloseTo(fundingBalanceNative + inOrderNative, 6);
  125 | 
  126 |                 for (const action of actions) {
  127 |                     expect.soft(await fundingPage.isActionButtonVisible(row.coin, action), `${action} action should be visible for ${row.coin}`).toBe(true);
  128 |                 }
  129 |             });
  130 |         }
  131 | 
  132 |         // ─── TC-F07 ─────────────────────────────────────────────────────────────
  133 |         for (const row of currencies) {
  134 |             test(`TC-F07 [${row.coin}]: Deposit modal is bound to the correct coin and network @sanity`, async () => {
  135 |                 await fundingPage.clickDepositAction(row.coin);
  136 |                 expect.soft(await fundingPage.isDepositModalVisible(), 'Deposit modal should be visible').toBe(true);
  137 |                 expect.soft(await fundingPage.getDepositAssetText(), `Deposit Asset should show ${row.coin}`).toContain(row.coin);
  138 |                 expect.soft(await fundingPage.getDepositNetworkText(), `Deposit Network should show ${row.network}`).toContain(row.network);
  139 |                 expect.soft(await fundingPage.isDepositQrVisible(), 'Deposit QR code should be visible').toBe(true);
  140 |                 expect.soft(await fundingPage.isDepositImportantSectionVisible(), 'Deposit "Important" notes should be visible').toBe(true);
  141 |                 expect.soft(await fundingPage.getDepositAddressText(), 'Deposit address should not be empty').not.toBe('');
  142 |                 expect.soft(await fundingPage.isDepositCopyIconVisible(), 'Copy icon should be visible next to the deposit address').toBe(true);
  143 |                 await fundingPage.closeModal();
  144 |                 expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the modal should return to the Funding tab').toBe(true);
  145 |             });
  146 |         }
  147 | 
  148 |         // ─── TC-F08 ─────────────────────────────────────────────────────────────
  149 |         // Only verifies the modal's fields/notices — never clicks Continue, since that would
  150 |         // attempt a real withdrawal (2FA + email confirmation) against a live account.
  151 |         for (const row of currencies) {
  152 |             test(`TC-F08 [${row.coin}]: Withdraw modal is bound to the correct coin and network @sanity`, async () => {
  153 |                 await fundingPage.clickWithdrawAction(row.coin);
  154 |                 expect.soft(await fundingPage.isWithdrawModalVisible(), 'Withdraw modal should be visible').toBe(true);
  155 |                 expect.soft(await fundingPage.getWithdrawAssetText(), `Withdraw Asset should show ${row.coin}`).toContain(row.coin);
  156 |                 expect.soft(await fundingPage.getWithdrawNetworkText(), `Withdraw Network should show ${row.network}`).toContain(row.network);
  157 |                 expect.soft(await fundingPage.getWithdrawAvailableBalanceText(), 'Available balance text should be shown').toContain('Avl Bal');
```