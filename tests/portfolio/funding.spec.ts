import { test, expect } from '../../src/fixtures/pagefixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { PortfolioFundingPage } from '../../src/pages/portfolio/funding';
import { PortfolioSpotPage } from '../../src/pages/portfolio/spot';
import { CsvHelper } from '../../src/utils/CsvHelper';
import type { Browser, BrowserContext, Page } from '@playwright/test';

// Every row here becomes its own independent set of per-currency tests below — add or remove a row
// and the suite scales automatically, no test code changes needed.
const currencies = CsvHelper.readCsv('src/data/fundingTransferData.csv');
const actions = ['Deposit', 'Withdraw', 'Transfer'] as const;

// The Transfer flow below runs against exactly ONE currency — to test BTC/ETH/BNB instead, just
// edit this row (coin/symbol/network/amounts), no test code changes needed. Kept separate from
// `currencies` above so it doesn't affect the Deposit/Withdraw/search tests, which still cover
// every row in fundingTransferData.csv.
const transferCurrency = CsvHelper.readCsv('src/data/fundingTransferSingleData.csv')[0];

let browser:      Browser;
let context:      BrowserContext;
let page:         Page;
let loginPage:    LoginPage;
let fundingPage:  PortfolioFundingPage;
let spotPage:     PortfolioSpotPage;

// Single shared login (one browser/context/page for the whole file) — logging in fresh per test
// would mean 55 real logins hammering the same staging account, the exact resource/rate-limit
// problem every other spec in this suite already works around the same way.
test.describe('Portfolio Funding Page', () => {
    // serial: forces every test in this file onto one worker/one browser session in file order —
    // no risk of fullyParallel splitting these 55 tests across multiple workers, which would mean
    // multiple browsers hitting the same real staging account concurrently (a very plausible cause
    // of the confusing, inconsistent balance reads seen in an earlier run of this suite). Tests are
    // also laid out below in strict TC-F01 → TC-F22 numeric order (each per-coin TC gets its own
    // loop over every currency before moving to the next TC number), not grouped by coin. TC-F09
    // through TC-F19 are the Transfer flow, which runs against a single CSV-configured currency
    // rather than looping over every row.
    test.describe.configure({ mode: 'serial', timeout: 60000 });

    test.beforeAll(async ({ playwright }, testInfo) => {
        browser     = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context     = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
        page        = await context.newPage();
        loginPage   = new LoginPage(page);
        fundingPage = new PortfolioFundingPage(page);
        spotPage    = new PortfolioSpotPage(page);
        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!);
    });

    test.afterAll(async () => { await browser.close(); });

    // ─── TC-F01 ───────────────────────────────────────────────────────────────────
    // Checked against the shared beforeAll login (not a second independent login) — repeating a
    // full login per test would mean 55 real "Get OTP" clicks against the same account.
    test('TC-F01: Login with valid credentials lands on the home page @smoke @sanity', async () => {
        expect(await loginPage.isUserOnHomePage()).toBe(true);
    });

    // Every test below is independent: its own beforeEach re-navigates Portfolio > Spot > Funding
    // fresh, so no test depends on another's leftover state (open modal, active search, checkbox).
    test.describe('Funding tab', () => {
        // TC-F02 does its own navigation (via Spot) as the whole point of the test — navigating
        // here first as well would just log/perform the same trip twice for no reason.
        test.beforeEach(async ({}, testInfo) => {
            if (!testInfo.title.startsWith('TC-F02')) {
                await fundingPage.goToFundingTab();
            }
        });

        // ─── TC-F02 ─────────────────────────────────────────────────────────────
        // The only test that actually exercises the Spot hop — beforeEach uses the direct Funding
        // path for every other test (see goToFundingTab()'s comment in the page object for why).
        test('TC-F02: Navigate Portfolio > Spot > Funding tab loads the Funding table @smoke @sanity', async () => {
            await fundingPage.goToFundingTabViaSpot();
            expect(await fundingPage.isFundingTabVisible()).toBe(true);
            expect(await fundingPage.getVisibleRowCount()).toBeGreaterThan(0);
        });

        // ─── TC-F03 ─────────────────────────────────────────────────────────────
        test('TC-F03: Top balance section shows Estimated Balance and equals the sum of all coins @sanity', async () => {
            expect.soft(await fundingPage.isEstimatedBalanceLabelVisible(), 'Estimated Balance label should be visible').toBe(true);
            expect.soft(await fundingPage.isEstimatedBalanceAmountVisible(), 'Estimated Balance amount should be visible').toBe(true);
            expect.soft(await fundingPage.isEstimatedBalanceUsdValueVisible(), 'Estimated Balance $ value should be visible').toBe(true);

            const balances  = await fundingPage.getAllCoinBalances();
            const sum       = balances.reduce((total, b) => total + b.totalUsd, 0);
            const estimated = await fundingPage.getEstimatedBalanceAmount(sum);
            expect.soft(estimated, `Estimated Balance (${estimated}) should equal the sum of all coin rows (${sum.toFixed(4)})`).toBeCloseTo(sum, 1);
        });

        // ─── TC-F04 ─────────────────────────────────────────────────────────────
        test('TC-F04: Eye icon masks and reveals the Estimated Balance @sanity', async () => {
            expect.soft(await fundingPage.isBalanceMasked(), 'Balance should start revealed').toBe(false);
            await fundingPage.clickBalanceToggle();
            expect.soft(await fundingPage.isBalanceMasked(), 'Balance should be masked after clicking the eye icon').toBe(true);
            await fundingPage.clickBalanceToggle();
            expect.soft(await fundingPage.isBalanceMasked(), 'Balance should be revealed again after clicking the eye icon a second time').toBe(false);
        });

        // ─── TC-F05 ─────────────────────────────────────────────────────────────
        test('TC-F05: Funding table headers are all visible @sanity', async () => {
            const headers = ['Coin', 'Funding Balance', 'In Order', 'Total', 'Action'] as const;
            for (const header of headers) {
                expect.soft(await fundingPage.isTableHeaderVisible(header), `"${header}" header should be visible`).toBe(true);
            }
        });

        // =========================================================================
        // Per-currency tests — one independent test per row in fundingTransferData.csv, run in
        // strict TC-number order (every coin's TC-F06 first, then every coin's TC-F07, etc.).
        // Adding/removing a currency row scales this suite automatically.
        // =========================================================================

        // ─── TC-F06 ─────────────────────────────────────────────────────────────
        for (const row of currencies) {
            test(`TC-F06 [${row.coin}]: row shows numeric, self-consistent balances and all 3 actions @sanity`, async () => {
                expect.soft(await fundingPage.isCoinRowVisible(row.coin), `${row.coin} row should exist`).toBe(true);

                const { fundingBalanceNative, inOrderNative, totalNative } = await fundingPage.getCoinRowData(row.coin);
                expect.soft(fundingBalanceNative, `${row.coin} Funding Balance should be a valid number`).toBeGreaterThanOrEqual(0);
                expect.soft(inOrderNative, `${row.coin} In Order should be a valid number`).toBeGreaterThanOrEqual(0);
                expect.soft(totalNative, `${row.coin} Total should equal Funding Balance + In Order`)
                    .toBeCloseTo(fundingBalanceNative + inOrderNative, 6);

                for (const action of actions) {
                    expect.soft(await fundingPage.isActionButtonVisible(row.coin, action), `${action} action should be visible for ${row.coin}`).toBe(true);
                }
            });
        }

        // ─── TC-F07 ─────────────────────────────────────────────────────────────
        for (const row of currencies) {
            test(`TC-F07 [${row.coin}]: Deposit modal is bound to the correct coin and network @sanity`, async () => {
                await fundingPage.clickDepositAction(row.coin);
                expect.soft(await fundingPage.isDepositModalVisible(), 'Deposit modal should be visible').toBe(true);
                expect.soft(await fundingPage.getDepositAssetText(), `Deposit Asset should show ${row.coin}`).toContain(row.coin);
                expect.soft(await fundingPage.getDepositNetworkText(), `Deposit Network should show ${row.network}`).toContain(row.network);
                expect.soft(await fundingPage.isDepositQrVisible(), 'Deposit QR code should be visible').toBe(true);
                expect.soft(await fundingPage.isDepositImportantSectionVisible(), 'Deposit "Important" notes should be visible').toBe(true);
                expect.soft(await fundingPage.getDepositAddressText(), 'Deposit address should not be empty').not.toBe('');
                expect.soft(await fundingPage.isDepositCopyIconVisible(), 'Copy icon should be visible next to the deposit address').toBe(true);
                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the modal should return to the Funding tab').toBe(true);
            });
        }

        // ─── TC-F08 ─────────────────────────────────────────────────────────────
        // Only verifies the modal's fields/notices — never clicks Continue, since that would
        // attempt a real withdrawal (2FA + email confirmation) against a live account.
        for (const row of currencies) {
            test(`TC-F08 [${row.coin}]: Withdraw modal is bound to the correct coin and network @sanity`, async () => {
                await fundingPage.clickWithdrawAction(row.coin);
                expect.soft(await fundingPage.isWithdrawModalVisible(), 'Withdraw modal should be visible').toBe(true);
                expect.soft(await fundingPage.getWithdrawAssetText(), `Withdraw Asset should show ${row.coin}`).toContain(row.coin);
                expect.soft(await fundingPage.getWithdrawNetworkText(), `Withdraw Network should show ${row.network}`).toContain(row.network);
                expect.soft(await fundingPage.getWithdrawAvailableBalanceText(), 'Available balance text should be shown').toContain('Avl Bal');
                expect.soft(await fundingPage.isWithdrawImportantSectionVisible(), 'Withdraw "Important" notes should be visible').toBe(true);
                expect.soft(await fundingPage.isEnable2FAVisible(), '"Enable 2FA" link should be visible').toBe(true);
                expect.soft(await fundingPage.isWithdrawContinueButtonVisible(), 'Continue button should be visible').toBe(true);
                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the modal should return to the Funding tab').toBe(true);
            });
        }

        // ─── TC-F09 through TC-F19 (Transfer) ────────────────────────────────────
        // Runs against exactly ONE currency (transferCurrency, from fundingTransferSingleData.csv) —
        // to test a different coin, edit that CSV row, no test code changes needed. Split into 11
        // independent tests (one per step) rather than one mega-test: each test re-navigates/reopens
        // whatever it needs at its own start (same "every test is independent" convention as the rest
        // of this file), and only the numeric balance snapshots from Step 1 are shared across tests
        // via the `let`s below — the same pattern this file already uses for the shared login.
        test.describe(`TC-F09–F19 [${transferCurrency.coin}]: Transfer flow`, () => {
            let fundingBalanceNative: number;
            let spotBalanceNative:    number;

            // ─── Step 1 ─────────────────────────────────────────────────────────────
            test('TC-F09: snapshot the Funding and Spot Wallet balances', async () => {
                const funding = await fundingPage.getCoinRowData(transferCurrency.coin);
                fundingBalanceNative = funding.fundingBalanceNative;

                await spotPage.goToSpotTab();
                const spot = await spotPage.getCoinRowData(transferCurrency.coin);
                spotBalanceNative = spot.spotBalanceNative;
                await fundingPage.goToFundingTab();
            });

            // ─── Step 2 ─────────────────────────────────────────────────────────────
            test('TC-F10: Transfer modal opens, closes on (X), and reopens @sanity', async () => {
                await fundingPage.clickTransferAction(transferCurrency.coin);
                expect.soft(await fundingPage.isTransferModalVisible(), 'Transfer modal should be visible').toBe(true);
                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing (X) should return to the Funding tab').toBe(true);
                await fundingPage.clickTransferAction(transferCurrency.coin);
                expect.soft(await fundingPage.isTransferModalVisible(), 'Reopening Transfer should show the modal again').toBe(true);

                // Every test here is independent and reopens the modal itself — leaving it open would
                // block the next test's beforeEach from navigating back to the Funding tab.
                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the modal at the end of this test should return to the Funding tab').toBe(true);
            });

            // ─── Step 3 ─────────────────────────────────────────────────────────────
            // Quantity is read precisely (Avlb = Spot's balance, P2P = Funding's balance — confirmed
            // live that mapping is fixed to wallet identity, not to whichever wallet is currently in
            // the From slot), so swapping changes the From/To labels but each wallet's own quantity
            // reading stays the same.
            test('TC-F11: From/To default to Funding/Spot, swap exchanges them, and wallet balances stay correct @sanity', async () => {
                await fundingPage.clickTransferAction(transferCurrency.coin);
                expect.soft(await fundingPage.getTransferFromText('Funding'), 'From should default to Funding').toContain('Funding');
                expect.soft(await fundingPage.getTransferToText('Spot'), 'To should default to Spot').toContain('Spot');

                await fundingPage.swapTransferDirection();
                expect.soft(await fundingPage.getTransferFromText('Spot'), 'After swapping, From should show Spot').toContain('Spot');
                expect.soft(await fundingPage.getTransferToText('Funding'), 'After swapping, To should show Funding').toContain('Funding');
                const walletQtyAfterSwap = await fundingPage.getTransferWalletQuantities(spotBalanceNative, fundingBalanceNative);
                expect.soft(walletQtyAfterSwap.spotQty, `After swapping, the Spot wallet quantity shown (${walletQtyAfterSwap.spotQty}) should equal the Spot balance (${spotBalanceNative})`).toBeCloseTo(spotBalanceNative, 4);
                expect.soft(walletQtyAfterSwap.fundingQty, `After swapping, the Funding wallet quantity shown (${walletQtyAfterSwap.fundingQty}) should equal the Funding balance (${fundingBalanceNative})`).toBeCloseTo(fundingBalanceNative, 4);

                await fundingPage.swapTransferDirection();
                expect.soft(await fundingPage.getTransferFromText('Funding'), 'Swapping back should restore From to Funding').toContain('Funding');
                expect.soft(await fundingPage.getTransferToText('Spot'), 'Swapping back should restore To to Spot').toContain('Spot');

                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the modal at the end of this test should return to the Funding tab').toBe(true);
            });

            // ─── Step 4 ─────────────────────────────────────────────────────────────
            test('TC-F12: Coin field shows the opened currency, with a clickable dropdown @sanity', async () => {
                await fundingPage.clickTransferAction(transferCurrency.coin);
                expect.soft(await fundingPage.getTransferCoinText(transferCurrency.coin), `Coin field should show ${transferCurrency.coin}`).toContain(transferCurrency.coin);
                expect.soft(await fundingPage.isTransferCoinDropdownVisible(), 'Coin dropdown icon should be visible').toBe(true);

                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the modal at the end of this test should return to the Funding tab').toBe(true);
            });

            // ─── Step 5 ─────────────────────────────────────────────────────────────
            test('TC-F13: Select Coin panel — close/back navigation, a full currency search sweep, and reselecting the coin @sanity', async () => {
                await fundingPage.clickTransferAction(transferCurrency.coin);

                // Popup opens → close (X) → back on Funding tab → reopen Transfer → reopen popup
                await fundingPage.clickTransferCoinDropdown();
                expect.soft(await fundingPage.isSelectCoinPanelVisible(), 'Select Coin panel should open').toBe(true);
                await fundingPage.closeSelectCoinPanel();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing (X) should exit back to the Funding tab').toBe(true);

                await fundingPage.clickTransferAction(transferCurrency.coin);
                await fundingPage.clickTransferCoinDropdown();
                expect.soft(await fundingPage.isSelectCoinPanelVisible(), 'Select Coin panel should open again').toBe(true);

                // Back button returns to Transfer without closing the whole flow
                await fundingPage.goBackFromSelectCoin();
                expect.soft(await fundingPage.isTransferModalVisible(), 'Back should return to the Transfer modal, not close it').toBe(true);

                // Reopen the popup and verify its structure
                await fundingPage.clickTransferCoinDropdown();
                expect.soft(await fundingPage.isSelectCoinPanelVisible(), 'Select Coin panel title should be visible').toBe(true);
                expect.soft(await fundingPage.isSelectCoinSearchFieldVisible(), 'Select Coin search field should be visible').toBe(true);
                // No separate search-icon check here — confirmed live (screenshot) that this panel's
                // search box has no distinct icon element to find, unlike the main Funding table's.
                const allCoinsCount = await fundingPage.getSelectCoinVisibleCoinCount();
                expect.soft(allCoinsCount, `All ${currencies.length} CSV currencies should be visible before any search`).toBeGreaterThanOrEqual(currencies.length);

                // Search sweep across every CSV currency (BTC, BNB, ETH, USDT — from fundingTransferData.csv,
                // not hardcoded). Only asserts the target coin appears — confirmed live (screenshot) that
                // searching "ETH" legitimately also matches "Tether USDT" (the app searches the full coin
                // name, and "Tether" contains the letters "ETH"), so a strict single-row count would fail
                // on real, correct app behavior, not a test bug.
                for (const sweepRow of currencies) {
                    await fundingPage.searchCoinInSelectPanel(sweepRow.symbol);
                    expect.soft(await fundingPage.getSelectCoinVisibleCoinCount(), `Searching "${sweepRow.symbol}" should return at least ${sweepRow.coin}`).toBeGreaterThanOrEqual(1);
                    expect.soft(await fundingPage.isCoinVisibleInSelectPanel(sweepRow.coin), `${sweepRow.coin} should appear when searching "${sweepRow.symbol}"`).toBe(true);
                    await fundingPage.clearCoinSearchInSelectPanel();
                }

                // Finally search this test's own currency and verify its balance/USD value against the
                // Spot Wallet page balance for the same coin (from Step 1's snapshot) — confirmed live
                // that the Select Coin panel always shows the Spot balance here, not Funding.
                await fundingPage.searchCoinInSelectPanel(transferCurrency.symbol);
                expect.soft(await fundingPage.isCoinVisibleInSelectPanel(transferCurrency.coin), `${transferCurrency.coin} row should appear when searching "${transferCurrency.symbol}"`).toBe(true);
                expect.soft(await fundingPage.isCoinIconVisibleInSelectPanel(transferCurrency.coin), `${transferCurrency.coin} row should show a coin icon`).toBe(true);
                const { balanceText } = await fundingPage.getSelectCoinRowData(transferCurrency.coin, spotBalanceNative);
                const panelBalance = parseFloat(balanceText) || 0;
                expect.soft(panelBalance, `Select Coin panel balance (${panelBalance}) should match the Spot Wallet page balance (${spotBalanceNative}) for ${transferCurrency.coin}`).toBeCloseTo(spotBalanceNative, 4);

                await fundingPage.selectCoinFromPanel(transferCurrency.coin);
                expect.soft(await fundingPage.isTransferModalVisible(), 'Selecting a coin should return to the Transfer modal').toBe(true);
                expect.soft(await fundingPage.getTransferCoinText(transferCurrency.coin), `Coin field should now show ${transferCurrency.coin}`).toContain(transferCurrency.coin);
                expect.soft(await fundingPage.isTransferAmountCurrencyLabelVisible(transferCurrency.symbol), `Amount currency label should refresh to "${transferCurrency.symbol}"`).toBe(true);

                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the modal at the end of this test should return to the Funding tab').toBe(true);
            });

            // ─── Step 6 ─────────────────────────────────────────────────────────────
            test('TC-F14: Transfer modal quantity matches both wallet balances @sanity', async () => {
                await fundingPage.clickTransferAction(transferCurrency.coin);
                const walletQty = await fundingPage.getTransferWalletQuantities(spotBalanceNative, fundingBalanceNative);
                expect.soft(walletQty.spotQty, `Spot wallet quantity shown (${walletQty.spotQty}) should match the Spot Wallet page balance (${spotBalanceNative})`).toBeCloseTo(spotBalanceNative, 4);
                expect.soft(walletQty.fundingQty, `Funding wallet quantity shown (${walletQty.fundingQty}) should match the Funding Wallet page balance (${fundingBalanceNative})`).toBeCloseTo(fundingBalanceNative, 4);

                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the modal at the end of this test should return to the Funding tab').toBe(true);
            });

            // ─── Step 7 ─────────────────────────────────────────────────────────────
            test('TC-F15: Amount field has the "Amount" placeholder, the currency label, and a MAX button @sanity', async () => {
                await fundingPage.clickTransferAction(transferCurrency.coin);
                expect.soft(await fundingPage.getTransferAmountPlaceholder(), 'Amount field placeholder should read "Amount"').toBe('Amount');
                expect.soft(await fundingPage.isTransferAmountCurrencyLabelVisible(transferCurrency.symbol), `Amount field should show the "${transferCurrency.symbol}" currency label`).toBe(true);
                expect.soft(await fundingPage.isTransferMaxVisible(), 'MAX control should be visible').toBe(true);

                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the modal at the end of this test should return to the Funding tab').toBe(true);
            });

            // ─── Step 8 ─────────────────────────────────────────────────────────────
            test('TC-F16: MAX fills the available balance of the active (From) wallet, both directions @sanity', async () => {
                await fundingPage.clickTransferAction(transferCurrency.coin);

                await fundingPage.clickTransferMax();
                const fundingMax = await fundingPage.getTransferAmountValue(fundingBalanceNative.toFixed(8));
                expect.soft(Number(fundingMax), `MAX should fill the Funding wallet's available balance (${fundingBalanceNative})`).toBeCloseTo(fundingBalanceNative, 4);

                await fundingPage.swapTransferDirection();
                await fundingPage.clickTransferMax();
                const spotMax = await fundingPage.getTransferAmountValue(spotBalanceNative.toFixed(8));
                expect.soft(Number(spotMax), `MAX should fill the Spot wallet's available balance (${spotBalanceNative})`).toBeCloseTo(spotBalanceNative, 4);

                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the modal at the end of this test should return to the Funding tab').toBe(true);
            });

            // ─── Step 9 ─────────────────────────────────────────────────────────────
            // fillTransferAmount() already waits out the app's async auto-clamp.
            test('TC-F17: An over-limit amount auto-clamps down to the available balance, both directions @sanity', async () => {
                await fundingPage.clickTransferAction(transferCurrency.coin);

                const overLimitFunding = (fundingBalanceNative * 2 + 1).toFixed(8);
                await fundingPage.fillTransferAmount(overLimitFunding);
                expect.soft(Number(await fundingPage.getTransferAmountValue(fundingBalanceNative.toFixed(8))), `Typing an over-limit amount (${overLimitFunding}) should clamp down to the Funding balance (${fundingBalanceNative})`).toBeCloseTo(fundingBalanceNative, 4);

                await fundingPage.swapTransferDirection();
                const overLimitSpot = (spotBalanceNative * 2 + 1).toFixed(8);
                await fundingPage.fillTransferAmount(overLimitSpot);
                expect.soft(Number(await fundingPage.getTransferAmountValue(spotBalanceNative.toFixed(8))), `Typing an over-limit amount (${overLimitSpot}) should clamp down to the Spot balance (${spotBalanceNative})`).toBeCloseTo(spotBalanceNative, 4);

                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the modal at the end of this test should return to the Funding tab').toBe(true);
            });

            // ─── Step 10 ────────────────────────────────────────────────────────────
            test('TC-F18: "0" amount is rejected in both directions, and the Amount field clears on swap @sanity', async () => {
                await fundingPage.clickTransferAction(transferCurrency.coin);

                await fundingPage.fillTransferAmount('0');
                await fundingPage.clickTransferConfirm();
                expect.soft(await fundingPage.isTransferAmountValidationVisible(), 'Confirming a "0" amount (Funding → Spot) should show a validation message').toBe(true);

                const safeAmountBeforeSwap = fundingBalanceNative > 0 ? (fundingBalanceNative / 4).toFixed(8) : '0';
                await fundingPage.fillTransferAmount(safeAmountBeforeSwap);
                await fundingPage.swapTransferDirection();
                expect.soft(await fundingPage.getTransferAmountValue(''), 'Swapping direction should clear the Amount field').toBe('');

                await fundingPage.fillTransferAmount('0');
                await fundingPage.clickTransferConfirm();
                expect.soft(await fundingPage.isTransferAmountValidationVisible(), 'Confirming a "0" amount (Spot → Funding) should show a validation message').toBe(true);

                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the modal after the "0" validation checks should return to the Funding tab').toBe(true);
            });

            // ─── Step 11 ────────────────────────────────────────────────────────────
            // Two real transfers, each verified by exact native-balance arithmetic rather than the
            // account-wide Estimated Balance (USD) total. Confirmed live that the USD total is not a
            // reliable check here — it can read short by exactly the transferred amount's USD value
            // right after a transfer (an aggregate-widget refresh lag), even though the individual
            // Funding/Spot rows already reflect the transfer correctly. Amount is the fixed, CSV-
            // configured native amount (not a balance percentage) — skips cleanly rather than failing
            // when the live balance is below that configured amount.
            test('TC-F19: a real Funding → Spot then Spot → Funding transfer updates both wallet balances exactly', async () => {
                const fundingBefore1 = await fundingPage.getCoinRowData(transferCurrency.coin);
                const fundingToSpotAmount = parseFloat(transferCurrency.fundingToSpotAmount);
                test.skip(fundingBefore1.fundingBalanceNative < fundingToSpotAmount, `${transferCurrency.coin} Funding balance (${fundingBefore1.fundingBalanceNative}) is below the configured transfer amount (${fundingToSpotAmount}) — skipping the real transfer`);
                await spotPage.goToSpotTab();
                const spotBefore1 = await spotPage.getCoinRowData(transferCurrency.coin);
                await fundingPage.goToFundingTab();

                // ─── Leg 1: Funding → Spot ─────────────────────────────────────────────
                const transferAmount1 = fundingToSpotAmount.toFixed(8);
                await fundingPage.clickTransferAction(transferCurrency.coin);
                await fundingPage.fillTransferAmount(transferAmount1);
                await fundingPage.clickTransferConfirm();
                expect.soft(await fundingPage.isTransferSuccessMessageVisible(), `Transferring ${transferAmount1} ${transferCurrency.symbol} from Funding to Spot should succeed`).toBe(true);
                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the success modal should redirect to the Funding tab').toBe(true);

                await fundingPage.goToFundingTab();
                const fundingAfter1 = await fundingPage.getCoinRowData(transferCurrency.coin);
                await spotPage.goToSpotTab();
                const spotAfter1 = await spotPage.getCoinRowData(transferCurrency.coin);
                await fundingPage.goToFundingTab();

                expect.soft(fundingAfter1.fundingBalanceNative, `Funding balance (${fundingBefore1.fundingBalanceNative}) should decrease by ${transferAmount1} to ${(fundingBefore1.fundingBalanceNative - fundingToSpotAmount).toFixed(8)}`).toBeCloseTo(fundingBefore1.fundingBalanceNative - fundingToSpotAmount, 6);
                expect.soft(spotAfter1.spotBalanceNative, `Spot balance (${spotBefore1.spotBalanceNative}) should increase by ${transferAmount1} to ${(spotBefore1.spotBalanceNative + fundingToSpotAmount).toFixed(8)}`).toBeCloseTo(spotBefore1.spotBalanceNative + fundingToSpotAmount, 6);
                expect.soft(fundingAfter1.inOrderNative, 'Funding In Order should stay unchanged by a balance-only transfer').toBe(fundingBefore1.inOrderNative);
                expect.soft(spotAfter1.inOrderNative, 'Spot In Order should stay unchanged by a balance-only transfer').toBe(spotBefore1.inOrderNative);

                // ─── Leg 2: Spot → Funding (reverse direction) ─────────────────────────
                const spotToFundingAmount = parseFloat(transferCurrency.spotToFundingAmount);
                test.skip(spotAfter1.spotBalanceNative < spotToFundingAmount, `${transferCurrency.coin} Spot balance (${spotAfter1.spotBalanceNative}) is below the configured transfer amount (${spotToFundingAmount}) — skipping the reverse leg`);
                const transferAmount2 = spotToFundingAmount.toFixed(8);
                await fundingPage.clickTransferAction(transferCurrency.coin);
                await fundingPage.swapTransferDirection();
                await fundingPage.fillTransferAmount(transferAmount2);
                await fundingPage.clickTransferConfirm();
                expect.soft(await fundingPage.isTransferSuccessMessageVisible(), `Transferring ${transferAmount2} ${transferCurrency.symbol} from Spot to Funding should succeed`).toBe(true);
                await fundingPage.closeModal();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing the success modal should redirect to the Funding tab').toBe(true);

                await fundingPage.goToFundingTab();
                const fundingAfter2 = await fundingPage.getCoinRowData(transferCurrency.coin);
                await spotPage.goToSpotTab();
                const spotAfter2 = await spotPage.getCoinRowData(transferCurrency.coin);
                await fundingPage.goToFundingTab();

                expect.soft(fundingAfter2.fundingBalanceNative, `Funding balance (${fundingAfter1.fundingBalanceNative}) should increase by ${transferAmount2} to ${(fundingAfter1.fundingBalanceNative + spotToFundingAmount).toFixed(8)}`).toBeCloseTo(fundingAfter1.fundingBalanceNative + spotToFundingAmount, 6);
                expect.soft(spotAfter2.spotBalanceNative, `Spot balance (${spotAfter1.spotBalanceNative}) should decrease by ${transferAmount2} to ${(spotAfter1.spotBalanceNative - spotToFundingAmount).toFixed(8)}`).toBeCloseTo(spotAfter1.spotBalanceNative - spotToFundingAmount, 6);
                expect.soft(fundingAfter2.inOrderNative, 'Funding In Order should stay unchanged by a balance-only transfer').toBe(fundingBefore1.inOrderNative);
                expect.soft(spotAfter2.inOrderNative, 'Spot In Order should stay unchanged by a balance-only transfer').toBe(spotBefore1.inOrderNative);
            });
        });

        // ─── TC-F20 ─────────────────────────────────────────────────────────────
        test('TC-F20: Hide Zero Balance hides zero-total rows and restores them on uncheck @sanity', async () => {
            const baseline = await fundingPage.getAllCoinBalances();

            await fundingPage.setHideZeroBalance(true);
            const filtered = await fundingPage.getAllCoinBalances();
            for (const b of filtered) {
                expect.soft(b.totalUsd, `${b.coin} should not be visible while Hide Zero Balance is enabled`).toBeGreaterThan(0);
            }
            const nonZeroBaselineCount = baseline.filter(b => b.totalUsd > 0).length;
            expect.soft(filtered.length, 'Only the non-zero-balance rows from the baseline should remain').toBe(nonZeroBaselineCount);

            await fundingPage.setHideZeroBalance(false);
            const restored = await fundingPage.getAllCoinBalances();
            expect.soft(restored.length, 'Unchecking Hide Zero Balance should restore every baseline row').toBe(baseline.length);
        });

        // ─── TC-F21 ─────────────────────────────────────────────────────────────
        // Checks both Hide Zero Balance states inside one test — this TC is about search
        // filtering behavior across both states, not two unrelated things, so it stays one
        // self-contained, independent test per coin rather than splitting further.
        for (const row of currencies) {
            test(`TC-F21 [${row.coin}]: search currency filters correctly with Hide Zero Balance on and off @sanity`, async () => {
                expect.soft(await fundingPage.isSearchFieldVisible(), 'Search currency field should be visible').toBe(true);
                expect.soft(await fundingPage.isSearchIconVisible(), 'Search icon should be visible').toBe(true);

                const { totalUsd } = await fundingPage.getCoinRowData(row.coin);

                for (const hideZero of [false, true]) {
                    await fundingPage.setHideZeroBalance(hideZero);

                    await fundingPage.searchCurrency(row.symbol);
                    if (hideZero && totalUsd === 0) {
                        expect.soft(await fundingPage.isNoDataVisible(), `${row.coin} has a zero balance, so it should be hidden by Hide Zero Balance even when searched (Hide Zero Balance ${hideZero})`).toBe(true);
                    } else {
                        expect.soft(await fundingPage.isCoinRowVisible(row.coin), `Searching "${row.symbol}" should show ${row.coin} (Hide Zero Balance ${hideZero})`).toBe(true);
                    }
                    await fundingPage.clearSearch();

                    await fundingPage.searchCurrency('zzz-no-such-coin-999');
                    expect.soft(await fundingPage.isNoDataVisible(), `Searching a non-existent symbol should show "No data" (Hide Zero Balance ${hideZero})`).toBe(true);
                    await fundingPage.clearSearch();
                }

                await fundingPage.setHideZeroBalance(false);
            });
        }

        // ─── TC-F22 ─────────────────────────────────────────────────────────────
        test('TC-F22: Footer is visible @sanity', async () => {
            expect(await fundingPage.isFooterVisible()).toBe(true);
        });
    });

});
