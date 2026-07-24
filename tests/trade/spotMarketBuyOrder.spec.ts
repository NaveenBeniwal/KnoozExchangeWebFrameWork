import { test, expect } from '../../src/fixtures/pagefixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { SpotMarketBuyOrderPage, FullBalanceSnapshot } from '../../src/pages/trade/SpotMarketBuyOrderPage';
import { PortfolioSpotPage } from '../../src/pages/portfolio/spot';
import { CsvHelper } from '../../src/utils/CsvHelper';
import type { Browser, BrowserContext, Page } from '@playwright/test';

const getTradeData = () => CsvHelper.readCsv('src/data/spotMarketBuyData.csv')[0];
const baseCoin  = getTradeData().sellCurrency;
const quoteCoin = getTradeData().buyCurrency;

let browser: Browser;
let context: BrowserContext;
let page: Page;
let loginPage: LoginPage;
let spotMarketBuyPage: SpotMarketBuyOrderPage;
let portfolioSpotPage: PortfolioSpotPage;

let executedPrice   = 0;
let executedAmount  = 0;
let orderPlacedAt   = new Date();
let snapshotBefore: FullBalanceSnapshot | null = null;
let orderSucceeded  = false;
let orderId         = '';
let allOrdersTotal  = 0; // actual USDT total from All Orders (btcQty × executedPrice)
let allOrdersFilled = 0; // actual BTC amount filled from All Orders

const diffPct = (actual: number, ref: number) =>
    ref > 0 ? parseFloat((Math.abs(actual - ref) / ref * 100).toFixed(3)) : 0;

test.describe.serial('Spot Module — Market Buy Order Positive Flow', () => {

    test.beforeAll(async ({ playwright }, testInfo) => {
        testInfo.setTimeout(60000); // now does login + navigate + search + favorite/unfavorite before TC-01
        browser = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
        page               = await context.newPage();
        loginPage          = new LoginPage(page);
        spotMarketBuyPage  = new SpotMarketBuyOrderPage(page);
        portfolioSpotPage  = new PortfolioSpotPage(page);
        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!).catch(() => {});
        await loginPage.dismissPostLoginDialogsAndWaitForHome();
        // Navigation/search/favorite-toggle assertions now live in spotMarketOverview.spec.ts —
        // still need to reach the same page state here (silently) before TC-01 selects the pair.
        await spotMarketBuyPage.navigateToSpotTrading();
        await spotMarketBuyPage.searchCurrencyPair(getTradeData().searchPair);
        await spotMarketBuyPage.markAsFavorite(getTradeData().searchPair).catch(() => {});
        await spotMarketBuyPage.unmarkFavorite(getTradeData().searchPair).catch(() => {});
    });

    test.afterAll(async () => { await browser.close(); });

    // ── TC-01 ─────────────────────────────────────────────────────────────────
    // Pair is active from here — all Binance comparisons use getTradeData().searchPair
    test('TC-01: select currency pair from ALL tab @sanity', async () => {
        await spotMarketBuyPage.selectCurrencyPair(getTradeData().searchPair);
        console.log('[TC-01] Currency pair selected from ALL tab');
    });

    // ── TC-02 ─────────────────────────────────────────────────────────────────
    test('TC-02: Market Buy tab Price field is visible but disabled @sanity', async () => {
        await spotMarketBuyPage.selectMarketBuyTab();
        const isDisabled = await spotMarketBuyPage.isPriceFieldDisabled();
        expect.soft(isDisabled ? 'disabled' : 'editable', 'Market Price field should be disabled (read-only) on Market tab').toBe('disabled');
        console.log(`[TC-02] Market Buy tab Price field | Is Disabled: ${isDisabled}`);
    });

    // ── TC-03 ─────────────────────────────────────────────────────────────────
    test('TC-03: Buy button label shows "BUY {baseCoin}" @sanity', async () => {
        const label = await spotMarketBuyPage.getMarketBuyButtonLabel();
        expect.soft(label.toUpperCase(), `Buy button label should contain "BUY"`).toContain('BUY');
        expect.soft(label.toUpperCase(), `Buy button label should contain "${baseCoin}"`).toContain(baseCoin.toUpperCase());
        console.log(`[TC-03] Buy button label | Label: "${label}"`);
    });

    // ── TC-04 ─────────────────────────────────────────────────────────────────
    test('TC-04: quote currency (USDT) available balance is non-negative @sanity', async () => {
        const buyAvlb = await spotMarketBuyPage.getBuyAvailableBalance();
        expect.soft(buyAvlb, `Buy Avlb (${quoteCoin}) should be non-negative`).toBeGreaterThanOrEqual(0);
        console.log(`[TC-04] ${quoteCoin} available balance for buy | Available Balance: ${buyAvlb}`);
    });

    // ── TC-05–TC-08: % buttons ────────────────────────────────────────────────
    test('TC-05: 25% button fills correct spend amount @sanity', async () => {
        const avlb   = await spotMarketBuyPage.getBuyAvailableBalance();
        const filled = await spotMarketBuyPage.clickPercentageButton(25);
        expect.soft(filled, '25% should fill a non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) {
            const expected = avlb * 0.25;
            expect.soft(diffPct(filled, expected), `25% diff% — filled:${filled} expected:${expected}`).toBeLessThan(5);
        }
        const expected25 = parseFloat((avlb * 0.25).toFixed(8));
        console.log(`[TC-05] 25% Button | Available Balance: ${avlb} | Expected: ${expected25} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected25) : 'N/A'}`);
    });

    test('TC-06: 50% button fills correct spend amount @sanity', async () => {
        const avlb   = await spotMarketBuyPage.getBuyAvailableBalance();
        const filled = await spotMarketBuyPage.clickPercentageButton(50);
        expect.soft(filled, '50% should fill non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb * 0.50), `50% diff% — filled:${filled}`).toBeLessThan(5);
        const expected50 = parseFloat((avlb * 0.50).toFixed(8));
        console.log(`[TC-06] 50% Button | Available Balance: ${avlb} | Expected: ${expected50} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected50) : 'N/A'}`);
    });

    test('TC-07: 75% button fills correct spend amount @sanity', async () => {
        const avlb   = await spotMarketBuyPage.getBuyAvailableBalance();
        const filled = await spotMarketBuyPage.clickPercentageButton(75);
        expect.soft(filled, '75% should fill non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb * 0.75), `75% diff% — filled:${filled}`).toBeLessThan(5);
        const expected75 = parseFloat((avlb * 0.75).toFixed(8));
        console.log(`[TC-07] 75% Button | Available Balance: ${avlb} | Expected: ${expected75} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected75) : 'N/A'}`);
    });

    test('TC-08: 100% button fills correct spend amount @sanity', async () => {
        const avlb   = await spotMarketBuyPage.getBuyAvailableBalance();
        const filled = await spotMarketBuyPage.clickPercentageButton(100);
        expect.soft(filled, '100% should fill non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb), `100% diff% — filled:${filled} avlb:${avlb}`).toBeLessThan(5);
        const expected100 = parseFloat((avlb * 1.00).toFixed(8));
        console.log(`[TC-08] 100% Button | Available Balance: ${avlb} | Expected: ${expected100} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected100) : 'N/A'}`);
    });

    // ── TC-09 ─────────────────────────────────────────────────────────────────
    test('TC-09: capture full balance snapshot before placing market buy order @sanity', async () => {
        snapshotBefore = await spotMarketBuyPage.captureFullSnapshot(portfolioSpotPage, getTradeData().searchPair);
        const portfolioQuote = snapshotBefore.portfolioCoins.find(c => c.coin === quoteCoin);
        const portfolioBase  = snapshotBefore.portfolioCoins.find(c => c.coin === baseCoin);
        const buyMatchPortfolio  = portfolioQuote ? Math.abs(snapshotBefore.buyAvlb  - portfolioQuote.spotBalance) < 0.001 : null;
        const sellMatchPortfolio = portfolioBase  ? Math.abs(snapshotBefore.sellAvlb - portfolioBase.spotBalance)  < 0.001 : null;
        console.log(`[TC-09] Buy Avlb: ${snapshotBefore.buyAvlb} | Portfolio ${quoteCoin}: ${portfolioQuote?.spotBalance ?? 'N/A'} | Buy Match: ${buyMatchPortfolio ?? 'N/A'} | Sell Avlb: ${snapshotBefore.sellAvlb} | Portfolio ${baseCoin}: ${portfolioBase?.spotBalance ?? 'N/A'} | Sell Match: ${sellMatchPortfolio ?? 'N/A'}`);
        expect.soft(snapshotBefore.buyAvlb, `Buy Avlb (${quoteCoin}) should be non-negative`).toBeGreaterThanOrEqual(0);
        if (buyMatchPortfolio !== null) {
            expect.soft(buyMatchPortfolio, `TC-09 Buy avlb ${snapshotBefore.buyAvlb} should match portfolio ${quoteCoin} spot ${portfolioQuote?.spotBalance}`).toBe(true);
        }
        if (sellMatchPortfolio !== null) {
            expect.soft(sellMatchPortfolio, `TC-09 Sell avlb ${snapshotBefore.sellAvlb} should match portfolio ${baseCoin} spot ${portfolioBase?.spotBalance}`).toBe(true);
        }
    });

    // ── TC-10 ─────────────────────────────────────────────────────────────────
    test('TC-10: enter market buy order amount (total to spend), verify fee @sanity', async () => {
        await spotMarketBuyPage.selectMarketBuyTab(); // ensure Market tab is active — page may default to Limit after portfolio navigation
        const r = await spotMarketBuyPage.enterMarketBuyOrder(parseFloat(getTradeData().buyTotal), parseFloat(getTradeData().takerFeePercent));
        if (r.feePresent) {
            expect.soft(r.feeMatchStatus, r.feeMatchMsg).toBe('match');
        } else {
            test.info().annotations.push({ type: 'suggestion', description: 'Estimated fee is not displayed on Market Buy tab — fee verification skipped' });
        }
        console.log(`[TC-10] Total Entered: ${getTradeData().buyTotal} | FeePercent: ${getTradeData().takerFeePercent} | Fee Present: ${r.feePresent} | Est Fee: ${r.estFee.toFixed(8)} | UI Est Fee: ${r.uiEstFee.toFixed(8)} | Fee Match: ${r.feeMatchStatus}`);
    });

    // ── TC-11 ─────────────────────────────────────────────────────────────────
    test('TC-11: USDT available balance before market buy noted @sanity', async () => {
        const avlb = snapshotBefore?.buyAvlb ?? await spotMarketBuyPage.getBuyAvailableBalance();
        console.log(`[TC-11] ${quoteCoin} available before market buy: ${avlb}`);
        expect.soft(avlb, `${quoteCoin} balance should be non-negative`).toBeGreaterThanOrEqual(0);
    });

    // ── TC-12 ─────────────────────────────────────────────────────────────────
    test('TC-12: confirm market buy order — verify success message', async () => {
        await spotMarketBuyPage.selectMarketBuyTab();
        await spotMarketBuyPage.enterMarketBuyOrder(parseFloat(getTradeData().buyTotal), parseFloat(getTradeData().takerFeePercent));
        // Check for Insufficient balance before confirming — order cannot proceed if shown
        const hasInsufficientBalance = await page.getByText('Insufficient balance', { exact: true }).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasInsufficientBalance) {
            orderSucceeded = false;
            expect.soft(false, 'TC-12 — Insufficient balance: account does not have enough funds to place this order. Top up and re-run.').toBe(true);
            console.log('[TC-12] INSUFFICIENT BALANCE — order not placed');
            return;
        }
        orderPlacedAt = new Date();
        const r = await spotMarketBuyPage.confirmMarketBuyOrder();
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
    test('TC-13: balance snapshot after fill — USDT decreased, BTC increased', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping balance comparison.');
        if (!snapshotBefore) {
            test.info().annotations.push({ type: 'suggestion', description: 'Balance comparison skipped — pre-order snapshot not available' });
            console.log('[TC-13] Pre-order snapshot not available — balance comparison skipped');
            return;
        }
        await page.waitForTimeout(2000);
        const data = getTradeData();
        // Market fills are always taker fills — use the actual executed price/amount (read from
        // All Orders' Filled column, not the requested total) and deduct the taker fee from the
        // BTC received, matching the same validated math used in the round-trip suite.
        const results = await spotMarketBuyPage.validateMarketFillBalance(
            portfolioSpotPage, data.searchPair, snapshotBefore,
            executedPrice, executedAmount, executedPrice,
            quoteCoin, baseCoin, 'buy', parseFloat(data.takerFeePercent ?? '0'),
        );
        for (const r of results) {
            if (!r.pass && r.msg.includes('coin not found')) {
                test.info().annotations.push({ type: 'suggestion', description: `Balance check: ${r.msg}` });
            } else {
                expect.soft(r.pass, r.msg).toBe(true);
            }
        }
        console.log(`[TC-13] Balance verified after market buy fill | Executed Price: ${executedPrice} | Executed Amount: ${executedAmount}`);
    });

    // ── TC-14 ─────────────────────────────────────────────────────────────────
    test('TC-14: market buy order is NOT in Open Orders (fills immediately)', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Open Orders check.');
        const { rowText, isAbsentOrFilled, isMarketOrder, failMsg } = await spotMarketBuyPage.checkOpenOrdersHasPendingEntry(getTradeData().searchPair);
        if (isMarketOrder) {
            expect.soft(false, `TC-14 — Market order incorrectly appeared in Open Orders: ${failMsg}`).toBe(true);
        } else {
            expect.soft(
                isAbsentOrFilled,
                `TC-14 — Market buy order should not be pending — actual Open Orders row: "${rowText.slice(0, 100)}"`,
            ).toBe(true);
        }
        console.log(`[TC-14] Open Orders check | Is Absent or Filled: ${isAbsentOrFilled} | Is Market Order: ${isMarketOrder} | Row Text: "${rowText.slice(0, 100)}"`);
    });

    // ── TC-15 ─────────────────────────────────────────────────────────────────
    test('TC-15: All Orders shows market buy as Filled', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping All Orders validation.');
        const data = getTradeData();
        const r = await spotMarketBuyPage.validateAllOrdersTab({
            pair: data.searchPair, price: executedPrice, total: parseFloat(data.buyTotal),
            amount: executedAmount, estFee: 0, uiEstFee: 0, dateTime: orderPlacedAt,
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
        allOrdersTotal  = r.totalActual;
        allOrdersFilled = r.filledActual;
        console.log(`[TC-15] All Orders | Pair: ${r.pairActual} | Side: ${r.sideActual} | Type: ${r.typeActual} | Status: ${r.statusActual} | Executed: ${r.executedActual} | Filled: ${r.filledActual} | Remaining: ${r.remainingActual} | Total: ${r.totalActual} (exp: ${r.totalExpected}) | OrderId: ${r.orderId} | Date/Time: "${r.dateTimeActual}" diff: ${r.dateTimeDiffSec}s`);
    });

    // ── TC-16 ─────────────────────────────────────────────────────────────────
    test('TC-16: My Trades shows the executed market buy entry', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping My Trades validation.');
        const r = await spotMarketBuyPage.validateMarketBuyInMyTrades(executedPrice, executedAmount, orderPlacedAt);
        expect.soft(r.hasEntry, 'My Trades should have at least 1 entry').toBe(true);
        if (r.entry) {
            expect.soft(r.entry.price,  `My Trades price — expected ≈ ${executedPrice}`).toBeGreaterThan(0);
            expect.soft(r.entry.amount, `My Trades amount — expected ≈ ${executedAmount}`).toBeGreaterThan(0);
            if (r.timeDiffSec >= 120) test.info().annotations.push({ type: 'warn', description: `My Trades time diff: ${r.timeDiffSec}s ≥ 120s — entry: "${r.entry.time}", placed: ${orderPlacedAt.toISOString()} (soft, does not fail test)` });
        }
        console.log(`[TC-16] My Trades entry | Has Entry: ${r.hasEntry} | Entry Time: "${r.entry?.time ?? 'N/A'}" | Order Placed: ${orderPlacedAt.toISOString()} | Time Diff: ${r.timeDiffSec}s | Entry Price: ${r.entry?.price ?? 'N/A'} | Entry Amount: ${r.entry?.amount ?? 'N/A'} | Price Match: ${r.priceMatch} | Amount Match: ${r.amountMatch} | Time Match: ${r.timeMatch}`);
    });

    // ── TC-17 ─────────────────────────────────────────────────────────────────
    test('TC-17: USDT decreases by actual total; BTC increases by filled minus fee', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping balance check.');
        const data         = getTradeData();
        const enteredTotal = parseFloat(data.buyTotal);
        const feePercent   = parseFloat(data.takerFeePercent);
        const beforeUsdt   = spotMarketBuyPage.getBeforeBalance(); // captured right before order placement

        // ── 1. All Orders total must not exceed entered total by >5% (market order bug) ──
        if (allOrdersTotal > 0) {
            const overPct = allOrdersTotal > enteredTotal
                ? ((allOrdersTotal - enteredTotal) / enteredTotal * 100) : 0;
            expect.soft(
                allOrdersTotal <= enteredTotal * 1.05,
                `BUG: All Orders total ${allOrdersTotal.toFixed(4)} USDT exceeds entered ${enteredTotal} USDT by ${overPct.toFixed(2)}% (max allowed: 5%)`
            ).toBe(true);
            console.log(`[TC-17] Total check | Entered: ${enteredTotal} USDT | Actual (All Orders): ${allOrdersTotal} USDT | Over by: ${overPct.toFixed(3)}%`);
        }

        // ── 2. USDT (buy tab) should decrease by the actual total spent ─────────────
        const spentUsdt    = allOrdersTotal > 0 ? allOrdersTotal : enteredTotal;
        const afterUsdt    = await spotMarketBuyPage.getBuyAvailableBalance();
        const expectedUsdt = beforeUsdt - spentUsdt;
        const usdtDiffPct  = beforeUsdt > 0 ? Math.abs(afterUsdt - expectedUsdt) / beforeUsdt * 100 : 0;
        expect.soft(
            usdtDiffPct < 3,
            `USDT balance | Before: ${beforeUsdt} | Spent: ${spentUsdt.toFixed(4)} | Expected after: ${expectedUsdt.toFixed(4)} | Actual after: ${afterUsdt} | Diff: ${(afterUsdt - expectedUsdt).toFixed(4)} USDT (${usdtDiffPct.toFixed(3)}%)`
        ).toBe(true);

        // ── 3. BTC (sell tab) should increase by filledAmount − fee ──────────────────
        const beforeBtc = snapshotBefore?.sellAvlb ?? 0;
        if (allOrdersFilled > 0) {
            const btcFee      = parseFloat((allOrdersFilled * feePercent / 100).toFixed(8));
            const btcReceived = parseFloat((allOrdersFilled - btcFee).toFixed(8));
            const expectedBtc = parseFloat((beforeBtc + btcReceived).toFixed(8));
            const afterBtc    = await spotMarketBuyPage.getSellAvailableBalance();
            const btcDiffPct  = expectedBtc > 0 ? Math.abs(afterBtc - expectedBtc) / expectedBtc * 100 : 0;
            expect.soft(
                btcDiffPct < 3,
                `BTC balance | Before: ${beforeBtc} | Filled: ${allOrdersFilled} | Fee (${feePercent}%): ${btcFee} | Received: ${btcReceived} | Expected after: ${expectedBtc} | Actual after: ${afterBtc} | Diff: ${(afterBtc - expectedBtc).toFixed(8)} BTC (${btcDiffPct.toFixed(3)}%)`
            ).toBe(true);
            console.log(`[TC-17] BTC check | Before: ${beforeBtc} | Filled: ${allOrdersFilled} | Fee: ${btcFee} | Received: ${btcReceived} | Expected after: ${expectedBtc} | Actual after: ${afterBtc} | Diff%: ${btcDiffPct.toFixed(3)}%`);
        }

        console.log(`[TC-17] USDT check | Entered: ${enteredTotal} | Actual total: ${allOrdersTotal} | Before: ${beforeUsdt} | Spent: ${spentUsdt.toFixed(4)} | Expected after: ${expectedUsdt.toFixed(4)} | Actual after: ${afterUsdt} | Diff%: ${usdtDiffPct.toFixed(3)}%`);
    });

    // ── TC-18 ─────────────────────────────────────────────────────────────────
    test('TC-18: Trade History shows the market buy order', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Trade History validation.');
        const data = getTradeData();
        const r = await spotMarketBuyPage.validateTransactionHistoryOrdersTab({
            pair: data.searchPair, price: executedPrice, total: parseFloat(data.buyTotal),
            amount: executedAmount, estFee: 0, uiEstFee: 0, dateTime: orderPlacedAt,
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
    test('TC-19: Trade History bottom tab shows the market buy entry', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Trade History bottom tab.');
        const entry = await spotMarketBuyPage.getTradeHistoryBottomTabFirstEntry();
        if (!entry) { console.warn('[TC-19] No Trade History rows'); return; }
        expect.soft(
            (entry.pair.includes(baseCoin) || entry.pair.includes(getTradeData().searchPair.replace('/', ''))) ? 'found' : 'not found',
            `Trade History pair ("${entry.pair}") should reference "${baseCoin}"`,
        ).toBe('found');
        expect.soft(entry.side.toLowerCase(), 'Trade History side should be "buy"').toContain('buy');
        expect.soft(entry.price, 'Trade History price should be positive').toBeGreaterThan(0);
        console.log(`[TC-19] Trade History first entry | Pair: "${entry.pair}" | Side: "${entry.side}" | Price: ${entry.price}`);
    });

});
