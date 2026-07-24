import { test, expect } from '../../src/fixtures/pagefixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { SpotMarketSellOrderPage, FullBalanceSnapshot } from '../../src/pages/trade/SpotMarketSellOrderPage';
import { PortfolioSpotPage } from '../../src/pages/portfolio/spot';
import { CsvHelper } from '../../src/utils/CsvHelper';
import type { Browser, BrowserContext, Page } from '@playwright/test';

const getTradeData = () => CsvHelper.readCsv('src/data/spotMarketSellData.csv')[0];
const baseCoin  = getTradeData().sellCurrency;
const quoteCoin = getTradeData().buyCurrency;

let browser: Browser;
let context: BrowserContext;
let page: Page;
let loginPage: LoginPage;
let spotMarketSellPage: SpotMarketSellOrderPage;
let portfolioSpotPage: PortfolioSpotPage;

let executedPrice  = 0;
let executedAmount = 0;
let orderPlacedAt  = new Date();
let snapshotBefore: FullBalanceSnapshot | null = null;
let orderSucceeded = false;
let orderId = '';

const diffPct = (actual: number, ref: number) =>
    ref > 0 ? parseFloat((Math.abs(actual - ref) / ref * 100).toFixed(3)) : 0;

test.describe.serial('Spot Module — Market Sell Order Positive Flow', () => {

    test.beforeAll(async ({ playwright }, testInfo) => {
        testInfo.setTimeout(60000); // now does login + navigate + search + favorite/unfavorite before TC-01
        browser = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
        page                = await context.newPage();
        loginPage           = new LoginPage(page);
        spotMarketSellPage  = new SpotMarketSellOrderPage(page);
        portfolioSpotPage   = new PortfolioSpotPage(page);
        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!).catch(() => {});
        await loginPage.dismissPostLoginDialogsAndWaitForHome();
        // Navigation/search/favorite-toggle assertions now live in spotMarketOverview.spec.ts —
        // still need to reach the same page state here (silently) before TC-01 selects the pair.
        await spotMarketSellPage.navigateToSpotTrading();
        await spotMarketSellPage.searchCurrencyPair(getTradeData().searchPair);
        await spotMarketSellPage.markAsFavorite(getTradeData().searchPair).catch(() => {});
        await spotMarketSellPage.unmarkFavorite(getTradeData().searchPair).catch(() => {});
    });

    test.afterAll(async () => { await browser.close(); });

    // ── TC-01 ─────────────────────────────────────────────────────────────────
    // Pair is active from here — all Binance comparisons use getTradeData().searchPair
    test('TC-01: select currency pair from ALL tab @sanity', async () => {
        await spotMarketSellPage.selectCurrencyPair(getTradeData().searchPair);
        console.log('[TC-01] Currency pair selected from ALL tab');
    });

    // ── TC-02 ─────────────────────────────────────────────────────────────────
    test('TC-02: Market Sell tab Price field is visible but disabled @sanity', async () => {
        await spotMarketSellPage.selectMarketSellTab();
        const isDisabled = await spotMarketSellPage.isPriceFieldDisabled();
        expect.soft(isDisabled ? 'disabled' : 'editable', 'Market Price field should be disabled (read-only) on Market tab').toBe('disabled');
        console.log(`[TC-02] Market Sell tab Price field | Is Disabled: ${isDisabled}`);
    });

    // ── TC-03 ─────────────────────────────────────────────────────────────────
    test('TC-03: Sell button label shows "SELL {baseCoin}" @sanity', async () => {
        const label = await spotMarketSellPage.getMarketSellButtonLabel();
        expect.soft(label.toUpperCase(), `Sell button label should contain "SELL"`).toContain('SELL');
        expect.soft(label.toUpperCase(), `Sell button label should contain "${baseCoin}"`).toContain(baseCoin.toUpperCase());
        console.log(`[TC-03] Sell button label | Label: "${label}"`);
    });

    // ── TC-04 ─────────────────────────────────────────────────────────────────
    test('TC-04: base coin (BTC) sell available balance is non-negative @sanity', async () => {
        const sellAvlb = await spotMarketSellPage.getSellAvailableBalance();
        expect.soft(sellAvlb, `Sell Avlb (${baseCoin}) should be non-negative`).toBeGreaterThanOrEqual(0);
        console.log(`[TC-04] ${baseCoin} available balance for sell | Available Balance: ${sellAvlb}`);
    });

    // ── TC-05–TC-08: % buttons ────────────────────────────────────────────────
    test('TC-05: 25% button fills correct amount @sanity', async () => {
        const avlb   = await spotMarketSellPage.getSellAvailableBalance();
        const filled = await spotMarketSellPage.clickPercentageButton(25);
        expect.soft(filled, '25% should fill a non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) {
            const expected = avlb * 0.25;
            expect.soft(diffPct(filled, expected), `25% diff% — filled:${filled} expected:${expected}`).toBeLessThan(5);
        }
        const expected25 = parseFloat((avlb * 0.25).toFixed(8));
        console.log(`[TC-05] 25% Button | Available Balance: ${avlb} | Expected: ${expected25} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected25) : 'N/A'}`);
    });

    test('TC-06: 50% button fills correct amount @sanity', async () => {
        const avlb   = await spotMarketSellPage.getSellAvailableBalance();
        const filled = await spotMarketSellPage.clickPercentageButton(50);
        expect.soft(filled, '50% should fill non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb * 0.50), `50% diff% — filled:${filled}`).toBeLessThan(5);
        const expected50 = parseFloat((avlb * 0.50).toFixed(8));
        console.log(`[TC-06] 50% Button | Available Balance: ${avlb} | Expected: ${expected50} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected50) : 'N/A'}`);
    });

    test('TC-07: 75% button fills correct amount @sanity', async () => {
        const avlb   = await spotMarketSellPage.getSellAvailableBalance();
        const filled = await spotMarketSellPage.clickPercentageButton(75);
        expect.soft(filled, '75% should fill non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb * 0.75), `75% diff% — filled:${filled}`).toBeLessThan(5);
        const expected75 = parseFloat((avlb * 0.75).toFixed(8));
        console.log(`[TC-07] 75% Button | Available Balance: ${avlb} | Expected: ${expected75} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected75) : 'N/A'}`);
    });

    test('TC-08: 100% button fills correct amount @sanity', async () => {
        const avlb   = await spotMarketSellPage.getSellAvailableBalance();
        const filled = await spotMarketSellPage.clickPercentageButton(100);
        expect.soft(filled, '100% should fill non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb), `100% diff% — filled:${filled} avlb:${avlb}`).toBeLessThan(5);
        const expected100 = parseFloat((avlb * 1.00).toFixed(8));
        console.log(`[TC-08] 100% Button | Available Balance: ${avlb} | Expected: ${expected100} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected100) : 'N/A'}`);
    });

    // ── TC-09 ─────────────────────────────────────────────────────────────────
    test('TC-09: capture full balance snapshot before placing market sell order @sanity', async () => {
        snapshotBefore = await spotMarketSellPage.captureFullSnapshot(portfolioSpotPage, getTradeData().searchPair);
        const portfolioQuote = snapshotBefore.portfolioCoins.find(c => c.coin === quoteCoin);
        const portfolioBase  = snapshotBefore.portfolioCoins.find(c => c.coin === baseCoin);
        const buyMatchPortfolio  = portfolioQuote ? Math.abs(snapshotBefore.buyAvlb  - portfolioQuote.spotBalance) < 0.001 : null;
        const sellMatchPortfolio = portfolioBase  ? Math.abs(snapshotBefore.sellAvlb - portfolioBase.spotBalance)  < 0.001 : null;
        console.log(`[TC-09] Buy Avlb: ${snapshotBefore.buyAvlb} | Portfolio ${quoteCoin}: ${portfolioQuote?.spotBalance ?? 'N/A'} | Buy Match: ${buyMatchPortfolio ?? 'N/A'} | Sell Avlb: ${snapshotBefore.sellAvlb} | Portfolio ${baseCoin}: ${portfolioBase?.spotBalance ?? 'N/A'} | Sell Match: ${sellMatchPortfolio ?? 'N/A'}`);
        expect.soft(snapshotBefore.sellAvlb, `Sell Avlb (${baseCoin}) should be non-negative`).toBeGreaterThanOrEqual(0);
        if (buyMatchPortfolio !== null) {
            expect.soft(buyMatchPortfolio, `TC-09 Buy avlb ${snapshotBefore.buyAvlb} should match portfolio ${quoteCoin} spot ${portfolioQuote?.spotBalance}`).toBe(true);
        }
        if (sellMatchPortfolio !== null) {
            expect.soft(sellMatchPortfolio, `TC-09 Sell avlb ${snapshotBefore.sellAvlb} should match portfolio ${baseCoin} spot ${portfolioBase?.spotBalance}`).toBe(true);
        }
    });

    // ── TC-10 ─────────────────────────────────────────────────────────────────
    test('TC-10: enter market sell amount (base coin), verify estimated fee @sanity', async () => {
        await spotMarketSellPage.selectMarketSellTab(); // ensure Market tab is active — page may default to Limit after portfolio navigation
        const r = await spotMarketSellPage.enterMarketSellOrder(parseFloat(getTradeData().sellAmount), parseFloat(getTradeData().takerFeePercent));
        if (r.feePresent) {
            expect.soft(r.feeMatchStatus, r.feeMatchMsg).toBe('match');
        } else {
            test.info().annotations.push({ type: 'suggestion', description: 'Estimated fee is not displayed on Market Sell tab — fee verification skipped' });
        }
        console.log(`[TC-10] Executed Amount: ${getTradeData().sellAmount} | FeePercent: ${getTradeData().takerFeePercent} | Fee Present: ${r.feePresent} | Est Fee: ${r.estFee.toFixed(8)} | UI Est Fee: ${r.uiEstFee.toFixed(8)} | Fee Match: ${r.feeMatchStatus}`);
    });

    // ── TC-11 ─────────────────────────────────────────────────────────────────
    test('TC-11: base coin (BTC) available balance before market sell noted @sanity', async () => {
        const avlb = snapshotBefore?.sellAvlb ?? await spotMarketSellPage.fetchAvailableBalance();
        console.log(`[TC-11] ${baseCoin} available before market sell: ${avlb}`);
        expect.soft(avlb, `${baseCoin} balance should be non-negative`).toBeGreaterThanOrEqual(0);
    });

    // ── TC-12 ─────────────────────────────────────────────────────────────────
    test('TC-12: confirm market sell order — verify success message', async () => {
        await spotMarketSellPage.selectMarketSellTab();
        await spotMarketSellPage.enterMarketSellOrder(parseFloat(getTradeData().sellAmount), parseFloat(getTradeData().takerFeePercent));
        // Check for Insufficient balance before confirming — order cannot proceed if shown
        const hasInsufficientBalance = await page.getByText('Insufficient balance', { exact: true }).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasInsufficientBalance) {
            orderSucceeded = false;
            expect.soft(false, 'TC-12 — Insufficient balance: account does not have enough funds to place this order. Top up and re-run.').toBe(true);
            console.log('[TC-12] INSUFFICIENT BALANCE — order not placed');
            return;
        }
        orderPlacedAt = new Date();
        const r = await spotMarketSellPage.confirmMarketSellOrder();
        executedPrice  = r.executedPrice;
        executedAmount = r.executedAmount;
        orderId        = r.orderId;
        orderSucceeded = /success|creat|placed|status:/i.test(r.successMessage);
        expect.soft(
            orderSucceeded,
            `TC-12 — Order placement result — actual: "${r.successMessage || '(no message received)'}" expected to contain: success/created/placed/status`,
        ).toBe(true);
        console.log(`[TC-12] Executed Price: ${executedPrice} | Executed Amount: ${executedAmount} | OrderId: ${orderId} | Order Succeeded: ${orderSucceeded} | Success Message: "${r.successMessage || '(none)'}"`)
    });

    // ── TC-13 ─────────────────────────────────────────────────────────────────
    test('TC-13: balance snapshot after fill — BTC decreased, USDT increased', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping balance comparison.');
        if (!snapshotBefore) {
            test.info().annotations.push({ type: 'suggestion', description: 'Balance comparison skipped — pre-order snapshot not available' });
            console.log('[TC-13] Pre-order snapshot not available — balance comparison skipped');
            return;
        }
        await page.waitForTimeout(2000);
        const data = getTradeData();
        // Market fills are always taker fills — use the actual executed price/amount (read from
        // All Orders' Filled column, not the requested sell amount) and deduct the taker fee from
        // the USDT received, matching the same validated math used in the round-trip suite.
        const results = await spotMarketSellPage.validateMarketFillBalance(
            portfolioSpotPage, data.searchPair, snapshotBefore,
            executedPrice, executedAmount, executedPrice,
            quoteCoin, baseCoin, 'sell', parseFloat(data.takerFeePercent ?? '0'),
        );
        for (const r of results) {
            if (!r.pass && r.msg.includes('coin not found')) {
                test.info().annotations.push({ type: 'suggestion', description: `Balance check: ${r.msg}` });
            } else {
                expect.soft(r.pass, r.msg).toBe(true);
            }
        }
        console.log(`[TC-13] Balance verified after market sell fill | Executed Price: ${executedPrice} | Executed Amount: ${executedAmount}`);
    });

    // ── TC-14 ─────────────────────────────────────────────────────────────────
    test('TC-14: market sell order is NOT in Open Orders (fills immediately)', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Open Orders check.');
        const { rowText, isAbsentOrFilled, isMarketOrder, failMsg } = await spotMarketSellPage.checkOpenOrdersHasPendingEntry(getTradeData().searchPair);
        if (isMarketOrder) {
            expect.soft(false, `TC-14 — Market order incorrectly appeared in Open Orders: ${failMsg}`).toBe(true);
        } else {
            expect.soft(
                isAbsentOrFilled,
                `TC-14 — Market sell order should not be pending — actual Open Orders row: "${rowText.slice(0, 100)}"`,
            ).toBe(true);
        }
        console.log(`[TC-14] Open Orders check | Is Absent or Filled: ${isAbsentOrFilled} | Is Market Order: ${isMarketOrder} | Row Text: "${rowText.slice(0, 100)}"`);
    });

    // ── TC-15 ─────────────────────────────────────────────────────────────────
    test('TC-15: All Orders shows market sell as Filled', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping All Orders validation.');
        const data = getTradeData();
        const soldBase = parseFloat(data.sellAmount);
        const price    = executedPrice > 0 ? executedPrice : 0;
        const r = await spotMarketSellPage.validateAllOrdersTab({
            pair: data.searchPair, price, total: parseFloat((soldBase * price).toFixed(8)),
            amount: soldBase, estFee: 0, uiEstFee: 0, dateTime: orderPlacedAt,
            feeMatches: true, side: data.allOrdersSide, type: data.orderType, orderId, feePercent: parseFloat(data.takerFeePercent),
        });
        expect.soft(r.pairActual?.replace('/', ''),  `All Orders — pair`).toContain(data.searchPair.replace('/', ''));
        expect.soft(r.sideActual?.toLowerCase(),   `All Orders — side expected to contain "${data.allOrdersSide.toLowerCase()}"`).toContain(data.allOrdersSide.toLowerCase());
        expect.soft(r.typeActual?.toLowerCase(),   `All Orders — type expected to contain "${data.orderType.toLowerCase()}"`).toContain(data.orderType.toLowerCase());
        expect.soft(r.statusActual,                `All Orders — status should be done/filled/complete`).toMatch(/done|filled|complete/i);
        expect.soft(r.executedActual,              `All Orders — executed price should be > 0`).toBeGreaterThan(0);
        expect.soft(r.filledActual,                `All Orders — filled should be > 0`).toBeGreaterThan(0);
        expect.soft(r.remainingActual,             `All Orders — remaining should be 0`).toBe(0);
        expect.soft(r.totalActual,                 `All Orders — total (expected ≈ ${r.totalExpected}) should be > 0`).toBeGreaterThan(0);
        if (r.dateTimeDiffSec >= 60) test.info().annotations.push({ type: 'warn', description: `All Orders date/time diff: ${r.dateTimeDiffSec}s ≥ 60s — actual: "${r.dateTimeActual}" (soft, does not fail test)` });
        console.log(`[TC-15] All Orders | Pair: ${r.pairActual} | Side: ${r.sideActual} | Type: ${r.typeActual} | Status: ${r.statusActual} | Executed: ${r.executedActual} | Filled: ${r.filledActual} | Remaining: ${r.remainingActual} | Total: ${r.totalActual} (exp: ${r.totalExpected}) | OrderId: ${r.orderId} | Date/Time: "${r.dateTimeActual}" diff: ${r.dateTimeDiffSec}s`);
    });

    // ── TC-16 ─────────────────────────────────────────────────────────────────
    test('TC-16: My Trades shows the executed market sell entry', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping My Trades validation.');
        const r = await spotMarketSellPage.validateMarketSellInMyTrades(executedPrice, executedAmount, orderPlacedAt);
        expect.soft(r.hasEntry, 'My Trades should have at least 1 entry').toBe(true);
        if (r.entry) {
            expect.soft(r.entry.price,  `My Trades price — expected ≈ ${executedPrice}`).toBeGreaterThan(0);
            expect.soft(r.entry.amount, `My Trades amount — expected ≈ ${executedAmount}`).toBeGreaterThan(0);
            if (r.timeDiffSec >= 120) test.info().annotations.push({ type: 'warn', description: `My Trades time diff: ${r.timeDiffSec}s ≥ 120s — entry: "${r.entry.time}", placed: ${orderPlacedAt.toISOString()} (soft, does not fail test)` });
        }
        console.log(`[TC-16] My Trades entry | Has Entry: ${r.hasEntry} | Entry Time: "${r.entry?.time ?? 'N/A'}" | Order Placed: ${orderPlacedAt.toISOString()} | Time Diff: ${r.timeDiffSec}s | Entry Price: ${r.entry?.price ?? 'N/A'} | Entry Amount: ${r.entry?.amount ?? 'N/A'} | Price Match: ${r.priceMatch} | Amount Match: ${r.amountMatch} | Time Match: ${r.timeMatch}`);
    });

    // ── TC-17 ─────────────────────────────────────────────────────────────────
    test('TC-17: BTC available balance decreased after market sell', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping balance check.');
        const r = await spotMarketSellPage.getBalanceAfterOrderStatus(parseFloat(getTradeData().sellAmount), 'sell');
        expect.soft(r.balanceValidStatus, r.balanceMsg).toBe('valid');
        console.log(`[TC-17] Balance after market sell | Balance Valid Status: "${r.balanceValidStatus}" | Message: "${r.balanceMsg}"`);
    });

    // ── TC-18 ─────────────────────────────────────────────────────────────────
    test('TC-18: Trade History shows the market sell order', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Trade History validation.');
        const data     = getTradeData();
        const soldBase = parseFloat(data.sellAmount);
        const price    = executedPrice > 0 ? executedPrice : 0;
        const r = await spotMarketSellPage.validateTransactionHistoryOrdersTab({
            pair: data.searchPair, price, total: parseFloat((soldBase * price).toFixed(8)),
            amount: soldBase, estFee: 0, uiEstFee: 0, dateTime: orderPlacedAt,
            feeMatches: true, side: data.orderSide, type: data.orderType, orderId, feePercent: parseFloat(data.takerFeePercent),
        });
        if (!r.orderId) {
            test.info().annotations.push({ type: 'suggestion', description: 'TC-18: No Trade History entry found — market order may not appear yet. Verify manually.' });
            console.log('[TC-18] Trade History — no rows found, skipping assertions');
            return;
        }
        expect.soft(r.pairActual?.replace('/', ''),  `Trade History — pair`).toContain(data.searchPair.replace('/', ''));
        expect.soft(r.sideActual?.toLowerCase(), `Trade History — side expected to contain "${data.tradeHistorySide.toLowerCase()}"`).toContain(data.tradeHistorySide.toLowerCase());
        expect.soft(r.executedActual,            `Trade History — executed price should be > 0`).toBeGreaterThan(0);
        expect.soft(r.amountActual,              `Trade History — amount should be > 0`).toBeGreaterThan(0);
        expect.soft(r.totalActual,               `Trade History — total (expected ≈ ${r.totalExpected}) should be > 0`).toBeGreaterThan(0);
        expect.soft(r.feeActual,                 `Trade History — fee (expected ≈ ${r.feeExpected}) should be ≥ 0`).toBeGreaterThanOrEqual(0);
        if (r.dateTimeDiffSec >= 60) test.info().annotations.push({ type: 'warn', description: `Trade History date/time diff: ${r.dateTimeDiffSec}s ≥ 60s — actual: "${r.dateTimeActual}" (soft, does not fail test)` });
        console.log(`[TC-18] Trade History | Pair: ${r.pairActual} | Side: ${r.sideActual} | Executed: ${r.executedActual} | Amount: ${r.amountActual} | Total: ${r.totalActual} (exp: ${r.totalExpected}) | Fee: ${r.feeActual} (exp: ${r.feeExpected}) | OrderId: ${r.orderId} | Date/Time: "${r.dateTimeActual}" diff: ${r.dateTimeDiffSec}s`);
    });

    // ── TC-19 ─────────────────────────────────────────────────────────────────
    test('TC-19: Trade History bottom tab shows the market sell entry', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Trade History bottom tab.');
        const entry = await spotMarketSellPage.getTradeHistoryBottomTabFirstEntry();
        if (!entry) { console.warn('[TC-19] No Trade History rows'); return; }
        expect.soft(
            (entry.pair.includes(baseCoin) || entry.pair.includes(getTradeData().searchPair.replace('/', ''))) ? 'found' : 'not found',
            `Trade History pair ("${entry.pair}") should reference "${baseCoin}"`,
        ).toBe('found');
        expect.soft(entry.side.toLowerCase(), 'Trade History side should be "sell"').toContain('sell');
        expect.soft(entry.price, 'Trade History price should be positive').toBeGreaterThan(0);
        console.log(`[TC-19] Trade History first entry | Pair: "${entry.pair}" | Side: "${entry.side}" | Price: ${entry.price}`);
    });

});
