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
    // also laid out below in strict TC-F01 → TC-F19 numeric order (each per-coin TC gets its own
    // loop over every currency before moving to the next TC number), not grouped by coin.
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
    test('TC-F01: Login with valid credentials lands on the home page', async () => {
        expect(await loginPage.isUserOnHomePage()).toBe(true);
    });

    // Every test below is independent: its own beforeEach re-navigates Portfolio > Spot > Funding
    // fresh, so no test depends on another's leftover state (open modal, active search, checkbox).
    test.describe('Funding tab', () => {
        test.beforeEach(async () => {
            await fundingPage.goToFundingTab();
        });

        // ─── TC-F02 ─────────────────────────────────────────────────────────────
        // The only test that actually exercises the Spot hop — beforeEach uses the direct Funding
        // path for every other test (see goToFundingTab()'s comment in the page object for why).
        test('TC-F02: Navigate Portfolio > Spot > Funding tab loads the Funding table', async () => {
            await fundingPage.goToFundingTabViaSpot();
            expect(await fundingPage.isFundingTabVisible()).toBe(true);
            expect(await fundingPage.getVisibleRowCount()).toBeGreaterThan(0);
        });

        // ─── TC-F03 ─────────────────────────────────────────────────────────────
        test('TC-F03: Top balance section shows Estimated Balance and equals the sum of all coins', async () => {
            expect.soft(await fundingPage.isEstimatedBalanceLabelVisible(), 'Estimated Balance label should be visible').toBe(true);
            expect.soft(await fundingPage.isEstimatedBalanceAmountVisible(), 'Estimated Balance amount should be visible').toBe(true);
            expect.soft(await fundingPage.isEstimatedBalanceUsdValueVisible(), 'Estimated Balance $ value should be visible').toBe(true);

            const estimated = await fundingPage.getEstimatedBalanceAmount();
            const balances  = await fundingPage.getAllCoinBalances();
            const sum       = balances.reduce((total, b) => total + b.totalUsd, 0);
            expect.soft(estimated, `Estimated Balance (${estimated}) should equal the sum of all coin rows (${sum.toFixed(4)})`).toBeCloseTo(sum, 1);
        });

        // ─── TC-F04 ─────────────────────────────────────────────────────────────
        test('TC-F04: Eye icon masks and reveals the Estimated Balance', async () => {
            expect.soft(await fundingPage.isBalanceMasked(), 'Balance should start revealed').toBe(false);
            await fundingPage.clickBalanceToggle();
            expect.soft(await fundingPage.isBalanceMasked(), 'Balance should be masked after clicking the eye icon').toBe(true);
            await fundingPage.clickBalanceToggle();
            expect.soft(await fundingPage.isBalanceMasked(), 'Balance should be revealed again after clicking the eye icon a second time').toBe(false);
        });

        // ─── TC-F05 ─────────────────────────────────────────────────────────────
        test('TC-F05: Funding table headers are all visible', async () => {
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
            test(`TC-F06 [${row.coin}]: row shows numeric, self-consistent balances and all 3 actions`, async () => {
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
            test(`TC-F07 [${row.coin}]: Deposit modal is bound to the correct coin and network`, async () => {
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
            test(`TC-F08 [${row.coin}]: Withdraw modal is bound to the correct coin and network`, async () => {
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

        // ─── TC-F09 through TC-F16 (Transfer) ────────────────────────────────────
        // One continuous test per currency: click Transfer once for the coin, run every Transfer
        // check in a single unbroken session (structure, quantity, swap, amount validation, MAX,
        // Select Coin back/close/search, and finally a real transfer), then move to the next coin —
        // usdt, then btc, then eth, then bnb.
        for (const row of currencies) {
            test(`TC-F09–F16 [${row.coin}]: full Transfer flow in one continuous session — structure, quantity, swap, amount, MAX, Select Coin, and a real transfer`, async () => {
                const { fundingBalanceNative } = await fundingPage.getCoinRowData(row.coin);
                await spotPage.goToSpotTab();
                const { spotBalanceNative } = await spotPage.getCoinRowData(row.coin);
                await fundingPage.goToFundingTab();

                // TC-F09 — structure
                await fundingPage.clickTransferAction(row.coin);
                expect.soft(await fundingPage.isTransferModalVisible(), 'Transfer modal should be visible').toBe(true);
                expect.soft(await fundingPage.getTransferFromText(), 'From should default to Funding').toContain('Funding');
                expect.soft(await fundingPage.getTransferToText(), 'To should default to Spot').toContain('Spot');
                expect.soft(await fundingPage.getTransferCoinText(), `Coin field should show ${row.coin}`).toContain(row.coin);

                // TC-F10 — quantity reflects both wallets (checked as a set; see method comment on why
                // not a fixed From/To position), including after swapping.
                const quantityNumbers = await fundingPage.getTransferQuantityNumbers();
                const matchesBothWallets = [fundingBalanceNative, spotBalanceNative].every(balance =>
                    quantityNumbers.some(n => Math.abs(n - balance) < 0.0001)
                );
                expect.soft(matchesBothWallets, `Quantity numbers [${quantityNumbers.join(', ')}] should include both the Funding (${fundingBalanceNative}) and Spot (${spotBalanceNative}) balances for ${row.coin}`).toBe(true);

                // TC-F11 — swap exchanges From/To and reverts
                await fundingPage.swapTransferDirection();
                expect.soft(await fundingPage.getTransferFromText(), 'After swapping, From should show Spot').toContain('Spot');
                expect.soft(await fundingPage.getTransferToText(), 'After swapping, To should show Funding').toContain('Funding');
                const quantityAfterSwap = await fundingPage.getTransferQuantityNumbers();
                const matchesAfterSwap = [fundingBalanceNative, spotBalanceNative].every(balance =>
                    quantityAfterSwap.some(n => Math.abs(n - balance) < 0.0001)
                );
                expect.soft(matchesAfterSwap, `After swapping, quantity numbers [${quantityAfterSwap.join(', ')}] should still include both wallet balances for ${row.coin}`).toBe(true);
                await fundingPage.swapTransferDirection();
                expect.soft(await fundingPage.getTransferFromText(), 'Swapping back should restore From to Funding').toContain('Funding');
                expect.soft(await fundingPage.getTransferToText(), 'Swapping back should restore To to Spot').toContain('Spot');

                // TC-F12 — Amount field currency label, typed value, and empty-amount validation.
                // Uses a balance-relative safe amount (half the Funding balance), not a hardcoded "1"
                // — confirmed live that typing "1" for a low-balance coin (e.g. ETH at 0.03199429)
                // exceeds the available amount and gets auto-clamped down to MAX, which isn't the
                // "typed value reflected" behavior this check is actually about.
                expect.soft(await fundingPage.isTransferAmountCurrencyLabelVisible(row.symbol), `Amount field should show the "${row.symbol}" currency label`).toBe(true);
                const safeTypedAmount = fundingBalanceNative > 0 ? (fundingBalanceNative / 2).toFixed(8) : '0';
                await fundingPage.fillTransferAmount(safeTypedAmount);
                expect.soft(await fundingPage.getTransferAmountValue(), `Typed amount (${safeTypedAmount}) should be reflected in the field`).toBe(safeTypedAmount);
                await fundingPage.fillTransferAmount('');
                await fundingPage.clickTransferConfirm();
                expect.soft(await fundingPage.isTransferAmountValidationVisible(), 'Confirming an empty amount should show a validation message').toBe(true);

                // TC-F13 — MAX means the max available balance of the currently-active (From) wallet
                await fundingPage.clickTransferMax();
                const fundingMax = await fundingPage.getTransferAmountValue();
                expect.soft(Number(fundingMax), `MAX should fill the Funding wallet's available balance (${fundingBalanceNative}) for ${row.coin}`).toBeCloseTo(fundingBalanceNative, 4);

                await fundingPage.swapTransferDirection();
                await fundingPage.clickTransferMax();
                const spotMax = await fundingPage.getTransferAmountValue();
                expect.soft(Number(spotMax), `MAX should fill the Spot wallet's available balance (${spotBalanceNative}) for ${row.coin}`).toBeCloseTo(spotBalanceNative, 4);
                await fundingPage.swapTransferDirection();

                // TC-F14 (Back half) — Select Coin's Back button returns to Transfer without closing it
                await fundingPage.clickTransferCoinDropdown();
                expect.soft(await fundingPage.isSelectCoinPanelVisible(), 'Select Coin panel should open').toBe(true);
                await fundingPage.goBackFromSelectCoin();
                expect.soft(await fundingPage.isTransferModalVisible(), 'Back should return to the Transfer modal, not close it').toBe(true);

                // TC-F15 — Select Coin search shows icon/balance matching either wallet, and selecting
                // this same coin returns to Transfer with the Coin field and currency label refreshed
                await fundingPage.clickTransferCoinDropdown();
                await fundingPage.searchCoinInSelectPanel(row.symbol);
                expect.soft(await fundingPage.isCoinVisibleInSelectPanel(row.coin), `${row.coin} row should appear when searching "${row.symbol}"`).toBe(true);
                expect.soft(await fundingPage.isCoinIconVisibleInSelectPanel(row.coin), `${row.coin} row should show a coin icon`).toBe(true);
                const { balanceText } = await fundingPage.getSelectCoinRowData(row.coin);
                const panelBalance = parseFloat(balanceText) || 0;
                const matchesEitherWallet =
                    Math.abs(panelBalance - fundingBalanceNative) < 0.0001 ||
                    Math.abs(panelBalance - spotBalanceNative) < 0.0001;
                expect.soft(matchesEitherWallet, `Select Coin panel balance (${panelBalance}) should match either the Funding (${fundingBalanceNative}) or Spot (${spotBalanceNative}) wallet`).toBe(true);
                await fundingPage.selectCoinFromPanel(row.coin);
                expect.soft(await fundingPage.isTransferModalVisible(), 'Selecting a coin should return to the Transfer modal').toBe(true);
                expect.soft(await fundingPage.getTransferCoinText(), `Coin field should now show ${row.coin}`).toContain(row.coin);
                expect.soft(await fundingPage.isTransferAmountCurrencyLabelVisible(row.symbol), `Amount currency label should refresh to "${row.symbol}"`).toBe(true);

                // TC-F14 (Close half) — Select Coin's close (X) exits the whole flow back to Funding
                await fundingPage.clickTransferCoinDropdown();
                await fundingPage.closeSelectCoinPanel();
                expect.soft(await fundingPage.isFundingTabVisible(), 'Closing (X) should exit back to the Funding tab').toBe(true);

                // TC-F16 — two real transfers, each verified by exact native-balance arithmetic rather
                // than the account-wide Estimated Balance (USD) total. Confirmed live that the USD
                // total is not a reliable check here — it can read short by exactly the transferred
                // amount's USD value right after a transfer (an aggregate-widget refresh lag), even
                // though the individual Funding/Spot rows already reflect the transfer correctly. Native
                // balance and In Order, read straight from those same rows, aren't subject to that lag.
                // Amount is a CSV-configurable fraction of the live balance (dynamic per coin), not a
                // hardcoded value — works whether the coin holds a large or a very small balance.
                // Skips cleanly rather than failing when this coin holds a zero Funding balance.
                const fundingBefore1 = await fundingPage.getCoinRowData(row.coin);
                test.skip(fundingBefore1.fundingBalanceNative <= 0, `${row.coin} has a zero Funding balance — no valid amount to transfer`);
                await spotPage.goToSpotTab();
                const spotBefore1 = await spotPage.getCoinRowData(row.coin);
                await fundingPage.goToFundingTab();

                const fraction = parseFloat(row.transferFraction);

                // ─── Leg 1: Funding → Spot ─────────────────────────────────────────────
                const transferAmount1 = (fundingBefore1.fundingBalanceNative * fraction).toFixed(8);
                await fundingPage.clickTransferAction(row.coin);
                await fundingPage.fillTransferAmount(transferAmount1);
                await fundingPage.clickTransferConfirm();
                expect.soft(await fundingPage.isTransferSuccessMessageVisible(), `Transferring ${transferAmount1} ${row.symbol} from Funding to Spot should succeed`).toBe(true);
                await fundingPage.closeModal();

                await fundingPage.goToFundingTab();
                const fundingAfter1 = await fundingPage.getCoinRowData(row.coin);
                await spotPage.goToSpotTab();
                const spotAfter1 = await spotPage.getCoinRowData(row.coin);
                await fundingPage.goToFundingTab();

                expect.soft(fundingAfter1.fundingBalanceNative, `Funding balance (${fundingBefore1.fundingBalanceNative}) should decrease by ${transferAmount1} to ${(fundingBefore1.fundingBalanceNative - parseFloat(transferAmount1)).toFixed(8)}`).toBeCloseTo(fundingBefore1.fundingBalanceNative - parseFloat(transferAmount1), 6);
                expect.soft(spotAfter1.spotBalanceNative, `Spot balance (${spotBefore1.spotBalanceNative}) should increase by ${transferAmount1} to ${(spotBefore1.spotBalanceNative + parseFloat(transferAmount1)).toFixed(8)}`).toBeCloseTo(spotBefore1.spotBalanceNative + parseFloat(transferAmount1), 6);
                expect.soft(fundingAfter1.inOrderNative, 'Funding In Order should stay unchanged by a balance-only transfer').toBe(fundingBefore1.inOrderNative);
                expect.soft(spotAfter1.inOrderNative, 'Spot In Order should stay unchanged by a balance-only transfer').toBe(spotBefore1.inOrderNative);

                // ─── Leg 2: Spot → Funding (reverse direction) ─────────────────────────
                const transferAmount2 = (spotAfter1.spotBalanceNative * fraction).toFixed(8);
                await fundingPage.clickTransferAction(row.coin);
                await fundingPage.swapTransferDirection();
                await fundingPage.fillTransferAmount(transferAmount2);
                await fundingPage.clickTransferConfirm();
                expect.soft(await fundingPage.isTransferSuccessMessageVisible(), `Transferring ${transferAmount2} ${row.symbol} from Spot to Funding should succeed`).toBe(true);
                await fundingPage.closeModal();

                await fundingPage.goToFundingTab();
                const fundingAfter2 = await fundingPage.getCoinRowData(row.coin);
                await spotPage.goToSpotTab();
                const spotAfter2 = await spotPage.getCoinRowData(row.coin);
                await fundingPage.goToFundingTab();

                expect.soft(fundingAfter2.fundingBalanceNative, `Funding balance (${fundingAfter1.fundingBalanceNative}) should increase by ${transferAmount2} to ${(fundingAfter1.fundingBalanceNative + parseFloat(transferAmount2)).toFixed(8)}`).toBeCloseTo(fundingAfter1.fundingBalanceNative + parseFloat(transferAmount2), 6);
                expect.soft(spotAfter2.spotBalanceNative, `Spot balance (${spotAfter1.spotBalanceNative}) should decrease by ${transferAmount2} to ${(spotAfter1.spotBalanceNative - parseFloat(transferAmount2)).toFixed(8)}`).toBeCloseTo(spotAfter1.spotBalanceNative - parseFloat(transferAmount2), 6);
                expect.soft(fundingAfter2.inOrderNative, 'Funding In Order should stay unchanged by a balance-only transfer').toBe(fundingBefore1.inOrderNative);
                expect.soft(spotAfter2.inOrderNative, 'Spot In Order should stay unchanged by a balance-only transfer').toBe(spotBefore1.inOrderNative);
            });
        }

        // ─── TC-F17 ─────────────────────────────────────────────────────────────
        test('TC-F17: Hide Zero Balance hides zero-total rows and restores them on uncheck', async () => {
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

        // ─── TC-F18 ─────────────────────────────────────────────────────────────
        // Checks both Hide Zero Balance states inside one test — this TC is about search
        // filtering behavior across both states, not two unrelated things, so it stays one
        // self-contained, independent test per coin rather than splitting further.
        for (const row of currencies) {
            test(`TC-F18 [${row.coin}]: search currency filters correctly with Hide Zero Balance on and off`, async () => {
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

        // ─── TC-F19 ─────────────────────────────────────────────────────────────
        test('TC-F19: Footer is visible', async () => {
            expect(await fundingPage.isFooterVisible()).toBe(true);
        });
    });

});
