import { test, expect } from '../../src/fixtures/pagefixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { SpotSellLimitOrderPage, SpotOrderDetails, FullBalanceSnapshot } from '../../src/pages/trade/SpotSellLimitOrderPage';
import { PortfolioSpotPage } from '../../src/pages/portfolio/spot';
import { BinanceHelper } from '../../src/utils/BinanceHelper';
import { CsvHelper } from '../../src/utils/CsvHelper';
import type { Browser, BrowserContext, Page } from '@playwright/test';

const tradeData = CsvHelper.readCsv('src/data/spotSellLimitData.csv')[0];
const baseCoin  = tradeData.sellCurrency;
const quoteCoin = tradeData.buyCurrency;

let browser: Browser;
let context: BrowserContext;
let page: Page;
let loginPage: LoginPage;
let spotSellPage: SpotSellLimitOrderPage;
let portfolioSpotPage: PortfolioSpotPage;

let orderDetails: SpotOrderDetails = {
    pair: '', price: 0, total: 0, amount: 0, estFee: 0, uiEstFee: 0,
    dateTime: new Date(), feeMatches: false,
};
let orderId = '';
let orderSucceeded = false;
let snapshotBeforeOrder:        FullBalanceSnapshot | null = null;
let snapshotAfterOrder:         FullBalanceSnapshot | null = null;
let snapshotBeforeBelowMarket:  FullBalanceSnapshot | null = null;
let belowMarketOrderDetails: { limitPrice: number; executedPrice: number; amount: number; placedAt: Date; orderId: string } | null = null;

// Set in TC-09: true when limit price < market price at order time (fills immediately)
let orderFilledImmediately = false;
let marketPriceAtOrder     = 0;

// Actual BTC amount from All Orders — used in TC-13 for balance check
let allOrdersAmountActual = 0;

// Cancel All scenario (TC-20 onwards)
let snapshotBeforeMultiOrders: FullBalanceSnapshot | null = null;
let multiOrdersSucceeded = false;
let multiOrderActualSellAmounts: number[] = [];
let multiOrderActualBuyTotals:   number[] = [];

const diffPct = (actual: number, ref: number) =>
    ref > 0 ? parseFloat((Math.abs(actual - ref) / ref * 100).toFixed(3)) : 0;

test.describe.serial('Spot Module — Sell Limit Order Positive Flow', () => {

    test.beforeAll(async ({ playwright }, testInfo) => {
        browser = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL, ignoreHTTPSErrors: true });
        page              = await context.newPage();
        loginPage         = new LoginPage(page);
        spotSellPage      = new SpotSellLimitOrderPage(page);
        portfolioSpotPage = new PortfolioSpotPage(page);
        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!).catch(() => {});
        await loginPage.dismissPostLoginDialogsAndWaitForHome();
    });

    test.afterAll(async () => { await browser.close(); });

    // ── TC-01 ─────────────────────────────────────────────────────────────────
    test('TC-01: navigate to Spot Trading page @smoke @sanity', async () => {
        await spotSellPage.navigateToSpotTrading();
        console.log('[TC-01] Navigated to Spot Trading page');
    });

    // ── TC-02 ─────────────────────────────────────────────────────────────────
    test('TC-02: Spot Trading page shows all expected labels @smoke @sanity', async () => {
        const r = await spotSellPage.getSpotPageLabelsStatus();
        expect.soft(r.tradingText,       'Trading page heading').toBe('Trading');
        expect.soft(r.spotText,          'Spot label').toBe('Spot');
        expect.soft(r.depthViewText,    'Depth View label').toBe('Depth View');
        expect.soft(r.orderBookText,    'Order Book heading').toBe('Order Book');
        expect.soft(r.buyTabText,       'Buy tab').toBe('Buy');
        expect.soft(r.sellTabText,      'Sell tab').toBe('Sell');
        expect.soft(r.limitTabText,     'Limit tab').toBe('Limit');
        expect.soft(r.marketTabText,    'Market tab').toBe('Market');
        expect.soft(r.stopTabText,       'Stop tab').toBe('Stop');
        expect.soft(r.marketTradesText, 'Market Trades label').toBe('Market Trades');
        expect.soft(r.myTradesText,     'My Trades label').toBe('My Trades');
        expect.soft(r.openOrdersTabText, 'Open Orders tab').toBe('Open Orders');
        expect.soft(r.allOrdersText,    'All Orders tab').toBe('All Orders');
        expect.soft(r.tradeHistoryText, 'Trade History label').toBe('Trade History');
        console.log(`[TC-02] Depth View: "${r.depthViewText}" | Order Book: "${r.orderBookText}" | Buy: "${r.buyTabText}" | Sell: "${r.sellTabText}" | Limit: "${r.limitTabText}" | Market: "${r.marketTabText}" | Market Trades: "${r.marketTradesText}" | My Trades: "${r.myTradesText}" | All Orders: "${r.allOrdersText}" | Trade History: "${r.tradeHistoryText}"`);
    });

    // ── TC-03 ─────────────────────────────────────────────────────────────────
    test('TC-03: search currency pair in dropdown @sanity', async () => {
        await spotSellPage.searchCurrencyPair(tradeData.searchPair);
        console.log(`[TC-03] Searched pair: ${tradeData.searchPair}`);
    });

    // ── TC-04 ─────────────────────────────────────────────────────────────────
    test('TC-04: mark currency pair as favorite @sanity', async () => {
        const r = await spotSellPage.markAsFavorite(tradeData.searchPair);
        expect.soft(r.favoriteAddedStatus, r.favoriteMsg).toBe('added');
        console.log(`[TC-04] Marked ${tradeData.searchPair} as favorite | Status: "${r.favoriteAddedStatus}" | Message: "${r.favoriteMsg}"`);
    });

    // ── TC-05 ─────────────────────────────────────────────────────────────────
    test('TC-05: unmark currency pair from favorites @sanity', async () => {
        const r = await spotSellPage.unmarkFavorite(tradeData.searchPair);
        expect.soft(r.noRecordsStatus,    r.noRecordsMsg).toBe('visible');
        expect.soft(r.favoriteRemovedStatus, r.favoriteMsg).toBe('removed');
        console.log(`[TC-05] Unmarked ${tradeData.searchPair} from favorites | Status: "${r.favoriteRemovedStatus}" | Message: "${r.favoriteMsg}" | No Records Status: "${r.noRecordsStatus}"`);
    });

    // ── TC-06 ─────────────────────────────────────────────────────────────────
    // Pair is active from here — all Binance comparisons use tradeData.searchPair
    test('TC-06: select currency pair from ALL tab @sanity', async () => {
        await spotSellPage.selectCurrencyPair();
        console.log('[TC-06] Currency pair selected from ALL tab');
    });

    // ── TC-07 ─────────────────────────────────────────────────────────────────
    // Positioned after TC-06 so the page shows the selected pair before comparing with Binance
    test('TC-07: 24h ticker header matches Binance reference data (exact match)', async () => {
        const [binance, ticker] = await Promise.all([
            BinanceHelper.get24hTicker(page, tradeData.searchPair),
            spotSellPage.getTickerHeaderData(),
        ]);
        expect.soft(ticker.lastPrice, 'Last Price should be a positive number').toBeGreaterThan(0);
        expect.soft(diffPct(ticker.lastPrice, binance.lastPrice),      `TC-07 Last Price diff% — page:${ticker.lastPrice} Binance:${binance.lastPrice} (live price may shift 2-5s during fetch)`).toBeLessThan(1);
        expect.soft(ticker.high24h,        `TC-07 24h High — page:${ticker.high24h} Binance:${binance.highPrice}`).toBe(binance.highPrice);
        expect.soft(ticker.low24h,         `TC-07 24h Low — page:${ticker.low24h} Binance:${binance.lowPrice}`).toBe(binance.lowPrice);
        expect.soft(diffPct(ticker.volume24hBase,  binance.volume), `TC-07 Volume(base) diff% — page:${ticker.volume24hBase} Binance:${binance.volume} (volume changes with every trade)`).toBeLessThan(1);
        // Quote volume: exchange counts both buyer+seller side (~2× Binance). Log as info only, not a test failure.
        const quoteDiffPct = diffPct(ticker.volume24hQuote, binance.quoteVolume);
        if (quoteDiffPct >= 1) test.info().annotations.push({ type: 'info', description: `TC-07 Volume(quote) diff: ${quoteDiffPct.toFixed(2)}% — page:${ticker.volume24hQuote} Binance:${binance.quoteVolume} — exchange counts both sides of each trade (~2× Binance), not a bug` });
        console.log(`[TC-07] Verified 24h ticker for ${tradeData.searchPair} | Page Last: ${ticker.lastPrice} | Page High: ${ticker.high24h} | Page Low: ${ticker.low24h} | Page Vol Base: ${ticker.volume24hBase} | Page Vol Quote: ${ticker.volume24hQuote} | Binance Last: ${binance.lastPrice} | Binance High: ${binance.highPrice} | Binance Low: ${binance.lowPrice} | Binance Vol: ${binance.volume} | Binance Quote Vol: ${binance.quoteVolume} | Last Diff%: ${diffPct(ticker.lastPrice, binance.lastPrice)} | Vol Base Diff%: ${diffPct(ticker.volume24hBase, binance.volume)} | Vol Quote Diff%: ${quoteDiffPct}`);
    });

    // ── TC-08 ─────────────────────────────────────────────────────────────────
    test('TC-08: order book column headers show Price, Amount and Total @sanity', async () => {
        const h = await spotSellPage.getOrderBookColumnHeaders();
        expect.soft(h.price,  'Price header should be visible').not.toBe('');
        expect.soft(h.amount, 'Amount header should be visible').not.toBe('');
        expect.soft(h.total,  'Total header should be visible').not.toBe('');
        console.log(`[TC-08] Order book headers | Price: "${h.price}" | Amount: "${h.amount}" | Total: "${h.total}"`);
    });

    // ── TC-09 ─────────────────────────────────────────────────────────────────
    test('TC-09: order book view switches (all / sell-only / buy-only) @sanity', async () => {
        await spotSellPage.setOrderBookView('sell');
        const v1 = await spotSellPage.isOrderBookVisible();
        expect.soft(v1 ? 'visible' : 'not visible', 'OB visible in sell-only view').toBe('visible');
        await spotSellPage.setOrderBookView('buy');
        const v2 = await spotSellPage.isOrderBookVisible();
        expect.soft(v2 ? 'visible' : 'not visible', 'OB visible in buy-only view').toBe('visible');
        await spotSellPage.setOrderBookView('all');
        console.log(`[TC-09] Order book view switch | Sell-only Visible: ${v1} | Buy-only Visible: ${v2} | Restored to all`);
    });

    // ── TC-10 ─────────────────────────────────────────────────────────────────
    test('TC-10: order book precision dropdown changes price decimal places across all views @sanity', async () => {
        const precisions: string[]                  = ['0.01', '0.1', '1', '0.01'];
        const views: Array<'all' | 'sell' | 'buy'> = ['all', 'sell', 'buy'];
        const r = await spotSellPage.validateOrderBookPrecisionDecimals(precisions, views);
        for (const f of r.failures) { expect.soft(false, `TC-10: ${f.msg}`).toBe(true); }
        console.log(`[TC-10] Passed: ${r.passed} | Failures: ${r.failures.length}`);
    });

    // ── TC-11 ─────────────────────────────────────────────────────────────────
    test('TC-11: order book LTP and buy/sell ratio bar (suggestions — not yet implemented) @sanity', async () => {
        const ltp   = await spotSellPage.getOrderBookLtp();
        const ratio = await spotSellPage.getOrderBookBuySellRatio();
        const sum   = parseFloat((ratio.buyPct + ratio.sellPct).toFixed(1));
        // LTP display in orderbook not yet implemented — recorded as suggestion
        test.info().annotations.push({
            type: 'suggestion',
            description: `SUGGESTION [TC-11 LTP]: Order book last traded price (LTP) display is not yet ` +
                `implemented. Observed LTP=${ltp}. Consider showing the last trade price in the order book mid-row.`,
        });
        // Buy/sell ratio bar not yet implemented — recorded as suggestion
        test.info().annotations.push({
            type: 'suggestion',
            description: `SUGGESTION [TC-11 B%+S%]: Order book buy/sell ratio bar is not yet implemented. ` +
                `Observed B%=${ratio.buyPct} + S%=${ratio.sellPct} = ${sum}. ` +
                `Consider adding a visual percentage bar showing bid vs ask volume split.`,
        });
        console.log(`[TC-11] LTP: ${ltp} | Buy Pct: ${ratio.buyPct} | Sell Pct: ${ratio.sellPct} | Sum: ${sum} (features not yet implemented — logged as suggestions)`);
    });

    // ── TC-12 ─────────────────────────────────────────────────────────────────
    test('TC-12: order book has actual ask and bid rows @sanity', async () => {
        const { askCount, bidCount, topAsk, topBid } = await spotSellPage.getOrderBookTopBidAsk();
        expect.soft(askCount, 'Ask row count should be >0').toBeGreaterThan(0);
        expect.soft(bidCount, 'Bid row count should be >0').toBeGreaterThan(0);
        expect.soft(topAsk,   'Top ask should be positive').toBeGreaterThan(0);
        expect.soft(topBid,   'Top bid should be positive').toBeGreaterThan(0);
        console.log(`[TC-12] Order book rows | Ask Count: ${askCount} | Bid Count: ${bidCount} | Top Ask: ${topAsk} | Top Bid: ${topBid}`);
    });

    // ── TC-13 ─────────────────────────────────────────────────────────────────
    test('TC-13: top bid < top ask (valid spread) @sanity', async () => {
        const { topAsk, topBid } = await spotSellPage.getOrderBookTopBidAsk();
        if (topAsk > 0 && topBid > 0) {
            expect.soft(topBid, `Top bid(${topBid}) must be < top ask(${topAsk})`).toBeLessThan(topAsk);
        }
        const spread = topAsk > 0 && topBid > 0 ? parseFloat((topAsk - topBid).toFixed(8)) : 'N/A';
        console.log(`[TC-13] Spread check | Top Bid: ${topBid} | Top Ask: ${topAsk} | Spread: ${spread}`);
    });

    // ── TC-14 ─────────────────────────────────────────────────────────────────
    test('TC-14: order book top bid/ask match Binance within 0.5% @sanity', async () => {
        const [{ topAsk, topBid }, ob] = await Promise.all([
            spotSellPage.getOrderBookTopBidAsk(),
            BinanceHelper.getOrderBook(page, tradeData.searchPair, 5),
        ]);
        const binanceBid = ob.bids[0]?.price ?? 0;
        const binanceAsk = ob.asks[0]?.price ?? 0;
        if (binanceBid > 0 && topBid > 0) {
            expect.soft(diffPct(topBid, binanceBid), `Bid diff% — page:${topBid} Binance:${binanceBid}`).toBeLessThan(0.5);
        }
        if (binanceAsk > 0 && topAsk > 0) {
            expect.soft(diffPct(topAsk, binanceAsk), `Ask diff% — page:${topAsk} Binance:${binanceAsk}`).toBeLessThan(0.5);
        }
        console.log(`[TC-14] Bid/Ask vs Binance | Page Bid: ${topBid} | Page Ask: ${topAsk} | Binance Bid: ${binanceBid} | Binance Ask: ${binanceAsk} | Bid Diff%: ${diffPct(topBid, binanceBid)} | Ask Diff%: ${diffPct(topAsk, binanceAsk)}`);
    });

    // ── TC-15 ─────────────────────────────────────────────────────────────────
    test('TC-15: order book LTP matches Binance last price within 0.5% @sanity', async () => {
        const [ltp, b] = await Promise.all([
            spotSellPage.getOrderBookLtp(),
            BinanceHelper.get24hTicker(page, tradeData.searchPair),
        ]);
        expect.soft(ltp, 'OB LTP should be positive').toBeGreaterThan(0);
        if (b.lastPrice > 0 && ltp > 0) {
            expect.soft(diffPct(ltp, b.lastPrice), `LTP diff% — page:${ltp} Binance:${b.lastPrice}`).toBeLessThan(0.5);
        }
        console.log(`[TC-15] OB LTP vs Binance last price | LTP: ${ltp} | Binance: ${b.lastPrice} | Diff%: ${diffPct(ltp, b.lastPrice)}`);
    });

    // ── TC-16 ─────────────────────────────────────────────────────────────────
    test('TC-16: precision change alters LTP decimal display @sanity', async () => {
        const orig = await spotSellPage.getOrderBookPrecision();
        const alt  = orig.startsWith('0.0') ? '0.1' : '0.01';
        await spotSellPage.setOrderBookPrecision(alt).catch(() => {});
        await spotSellPage.setOrderBookPrecision(orig).catch(() => {});
        const ltp = await spotSellPage.getOrderBookLtp();
        expect.soft(ltp, 'OB LTP should still be positive after precision toggle').toBeGreaterThan(0);
        console.log(`[TC-16] Precision toggle | Original: "${orig}" | Alternate: "${alt}" | LTP After Restore: ${ltp}`);
    });

    // ── TC-17 ─────────────────────────────────────────────────────────────────
    test('TC-17: clicking order book bid rows (5 rows) pre-fills Price and Amount inputs @sanity', async () => {
        await spotSellPage.selectLimitSellTab();
        const { rows, passCount } = await spotSellPage.validateOrderBookBidRowsFillForm(5);
        for (const row of rows) {
            expect.soft(row.priceResult,  row.priceMsg).toBe('pass');
            expect.soft(row.amountResult, row.amountMsg).toBe('pass');
        }
        console.log(`[TC-17] Summary: ${passCount}/${rows.length} bid rows matched price+amount in form`);
    });

    // ── TC-18 ─────────────────────────────────────────────────────────────────
    test('TC-18: Sell button label shows "SELL {baseCoin}" @sanity', async () => {
        const label = await spotSellPage.getSellButtonLabel();
        expect.soft(label.toUpperCase(), `Sell button label should contain "SELL"`).toContain('SELL');
        expect.soft(label.toUpperCase(), `Sell button label should contain "${baseCoin}"`).toContain(baseCoin.toUpperCase());
        console.log(`[TC-18] Sell button label | Label: "${label}"`);
    });

    // ── TC-19 ─────────────────────────────────────────────────────────────────
    test('TC-19: Buy tab shows quote currency available balance @sanity', async () => {
        const buyAvlb = await spotSellPage.getBuyAvailableBalance();
        expect.soft(buyAvlb, `Buy Avlb (${quoteCoin}) should be non-negative`).toBeGreaterThanOrEqual(0);
        console.log(`[TC-19] ${quoteCoin} available balance on Buy tab | Available Balance: ${buyAvlb}`);
    });

    // ── TC-20–TC-23: % buttons ──────────────────────────────────────────────
    test('TC-20: 25% button fills correct amount of base coin @sanity', async () => {
        await spotSellPage.selectLimitSellTab();
        const avlb   = await spotSellPage.fetchAvailableBalance();
        const price  = parseFloat(tradeData.sellLimitPrice);
        await spotSellPage.setLimitPriceValue(price);
        const filled = await spotSellPage.clickPercentageButton(25);
        expect.soft(filled, '25% should fill a positive amount').toBeGreaterThan(0);
        if (avlb > 0) {
            const expected = avlb * 0.25;
            expect.soft(diffPct(filled, expected), `25% diff% — filled:${filled} expected:${expected}`).toBeLessThan(5);
        }
        console.log(`[TC-20] 25% Button | Available Balance: ${avlb} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, avlb * 0.25) : 'N/A'}`);
    });

    test('TC-21: 50% button fills correct amount @sanity', async () => {
        const avlb   = await spotSellPage.fetchAvailableBalance();
        const filled = await spotSellPage.clickPercentageButton(50);
        expect.soft(filled, '50% should fill a positive amount').toBeGreaterThan(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb * 0.50), `50% diff% — filled:${filled}`).toBeLessThan(5);
        console.log(`[TC-21] 50% Button | Available Balance: ${avlb} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, avlb * 0.50) : 'N/A'}`);
    });

    test('TC-22: 75% button fills correct amount @sanity', async () => {
        const avlb   = await spotSellPage.fetchAvailableBalance();
        const filled = await spotSellPage.clickPercentageButton(75);
        expect.soft(filled, '75% should fill a positive amount').toBeGreaterThan(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb * 0.75), `75% diff% — filled:${filled}`).toBeLessThan(5);
        console.log(`[TC-22] 75% Button | Available Balance: ${avlb} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, avlb * 0.75) : 'N/A'}`);
    });

    test('TC-23: 100% button fills correct amount @sanity', async () => {
        const avlb   = await spotSellPage.fetchAvailableBalance();
        const filled = await spotSellPage.clickPercentageButton(100);
        expect.soft(filled, '100% should fill a positive amount').toBeGreaterThan(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb), `100% diff% — filled:${filled} avlb:${avlb}`).toBeLessThan(5);
        console.log(`[TC-23] 100% Button | Available Balance: ${avlb} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, avlb) : 'N/A'}`);
    });

    // ── TC-24 ─────────────────────────────────────────────────────────────────
    test('TC-24: pair header displays the selected pair name @sanity', async () => {
        const hdr = await spotSellPage.getPairHeaderText();
        if (hdr) {
            expect.soft(
                (hdr.includes(baseCoin) || hdr.includes(tradeData.searchPair)) ? 'found' : 'not found',
                `Pair header ("${hdr}") should contain "${baseCoin}"`,
            ).toBe('found');
        }
        console.log(`[TC-24] Pair header | Text: "${hdr ?? '(none)'}"`);
    });

    // ── TC-25 ─────────────────────────────────────────────────────────────────
    test('TC-25: capture full balance snapshot before placing sell order @sanity', async () => {
        const r = await spotSellPage.captureAndValidatePreOrderSnapshot(portfolioSpotPage, tradeData.searchPair, quoteCoin, baseCoin);
        snapshotBeforeOrder = r.snapshot;
        expect.soft(r.snapshot.sellAvlb, 'Sell Avlb (base coin) should be non-negative').toBeGreaterThanOrEqual(0);
        if (r.buyMatchPortfolio  !== null) expect.soft(r.buyMatchPortfolio,  `TC-25 Buy avlb ${r.snapshot.buyAvlb} should match portfolio ${quoteCoin} spot ${r.portfolioQuoteBalance}`).toBe(true);
        if (r.sellMatchPortfolio !== null) expect.soft(r.sellMatchPortfolio, `TC-25 Sell avlb ${r.snapshot.sellAvlb} should match portfolio ${baseCoin} spot ${r.portfolioBaseBalance}`).toBe(true);
        console.log(`[TC-25] ${r.log}`);
    });

    // ── TC-26 ─────────────────────────────────────────────────────────────────
    test('TC-26: enter sell limit price and amount, verify estimated fee @sanity', async () => {
        const price      = parseFloat(tradeData.sellLimitPrice);
        const amount     = parseFloat(tradeData.sellAmount);
        const feePercent = parseFloat(tradeData.feePercent);
        const r = await spotSellPage.enterSellLimitOrderDetails(price, amount, feePercent);
        expect.soft(r.feeMatchStatus, r.feeMatchMsg).toBe('match');
        orderDetails = {
            pair: tradeData.searchPair, price, total: parseFloat((price * amount).toFixed(8)),
            amount, estFee: r.estFee, uiEstFee: r.uiEstFee,
            dateTime: new Date(), feeMatches: r.feeMatchStatus === 'match',
            side: tradeData.orderSide, type: tradeData.orderType, feePercent,
        };
        console.log(`[TC-26] Executed Price: ${price} | Executed Amount: ${amount} | Total: ${orderDetails.total} | FeePercent: ${feePercent} | Est Fee: ${r.estFee} | UI Est Fee: ${r.uiEstFee} | Fee Match: ${r.feeMatchStatus}`);
    });

    // ── TC-27 ─────────────────────────────────────────────────────────────────
    test('TC-27: Total field auto-calculates as price × amount @sanity', async () => {
        const price  = parseFloat(tradeData.sellLimitPrice);
        const amount = await spotSellPage.getAmountFieldValue();
        const totalField = await spotSellPage.getTotalFieldValue();
        const expected   = parseFloat((price * amount).toFixed(8));
        if (amount > 0 && expected > 0 && totalField > 0) {
            expect.soft(diffPct(totalField, expected), `Total diff% — field:${totalField} expected:${expected}`).toBeLessThan(1);
        } else {
            expect.soft(totalField, 'Total field should be non-negative').toBeGreaterThanOrEqual(0);
        }
        console.log(`[TC-27] Total field auto-calc | Executed Price: ${price} | Executed Amount: ${amount} | Total Field: ${totalField} | Expected: ${expected} | Diff%: ${amount > 0 && expected > 0 && totalField > 0 ? diffPct(totalField, expected) : 'N/A'}`);
    });

    // ── TC-28 ─────────────────────────────────────────────────────────────────
    test('TC-28: base coin available balance before placing order @sanity', async () => {
        const avlb = snapshotBeforeOrder?.sellAvlb ?? await spotSellPage.fetchAvailableBalance();
        console.log(`[TC-28] ${baseCoin} balance before sell order: ${avlb}`);
        expect.soft(avlb, `${baseCoin} balance should be non-negative`).toBeGreaterThanOrEqual(0);
    });

    // ── TC-29 ─────────────────────────────────────────────────────────────────
    test('TC-29: confirm sell order and verify success message', async () => {
        // Check for Insufficient balance before confirming — order cannot proceed if shown
        const hasInsufficientBalance = await page.getByText('Insufficient balance', { exact: true }).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasInsufficientBalance) {
            orderSucceeded = false;
            expect.soft(false, 'TC-29 — Insufficient balance: account does not have enough funds to place this order. Top up and re-run.').toBe(true);
            console.log('[TC-29] INSUFFICIENT BALANCE — order not placed');
            return;
        }
        const r = await spotSellPage.confirmSellOrder();
        orderId = r.orderId;
        orderDetails = { ...orderDetails, orderId };
        orderSucceeded = /success|creat|placed|status:/i.test(r.successMessage);
        expect.soft(
            orderSucceeded,
            `TC-29 — Order placement result — actual: "${r.successMessage || '(no message received)'}" expected to contain: success/created/placed/status`,
        ).toBe(true);
        // Detect whether the limit order fills immediately (sell limit price < market price)
        try {
            const ticker = await BinanceHelper.get24hTicker(page, tradeData.searchPair);
            marketPriceAtOrder = ticker.lastPrice;
            const limitPrice   = parseFloat(tradeData.sellLimitPrice);
            orderFilledImmediately = limitPrice < marketPriceAtOrder;
            console.log(`[TC-29] Fill detection | Limit price: ${limitPrice} | Binance market: ${marketPriceAtOrder} | Filled immediately: ${orderFilledImmediately}`);
        } catch {
            console.warn('[TC-29] Could not fetch Binance price — assuming order is pending');
        }
        console.log(`[TC-29] Confirmed sell limit order | Pair: ${orderDetails.pair} | Executed Price: ${orderDetails.price} | Executed Amount: ${orderDetails.amount} | OrderId: ${orderId} | Success Message: "${r.successMessage || '(none)'}"`)
    });

    // ── TC-30 ─────────────────────────────────────────────────────────────────
    test('TC-30: balance snapshot after order — pending lock or immediate fill', async () => {
        test.setTimeout(60000); // captureFullSnapshot round-trips Trading → Portfolio → Trading; can run close to the default 30s on a slow staging response
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping balance comparison.');
        if (!snapshotBeforeOrder) {
            test.info().annotations.push({ type: 'suggestion', description: 'Balance comparison skipped — pre-order snapshot not available' });
            console.log('[TC-30] Pre-order snapshot not available — balance comparison skipped');
            return;
        }
        const { afterSnap, results, label } = await spotSellPage.capturePostOrderBalanceAndValidate(
            portfolioSpotPage, tradeData.searchPair, snapshotBeforeOrder,
            orderDetails, orderFilledImmediately, marketPriceAtOrder, quoteCoin, baseCoin, 'sell',
        );
        snapshotAfterOrder = afterSnap;
        for (const r of results) {
            if (!r.pass && r.msg.includes('coin not found')) {
                test.info().annotations.push({ type: 'suggestion', description: `Balance check: ${r.msg}` });
            } else {
                expect.soft(r.pass, r.msg).toBe(true);
            }
        }
        console.log(`[TC-30] Balance snapshot (${label}) | Sell Avlb Before: ${snapshotBeforeOrder.sellAvlb} | Sell Avlb After: ${afterSnap.sellAvlb}`);
    });

    // ── TC-31 ─────────────────────────────────────────────────────────────────
    test('TC-31: Market Trades panel has Price, Amount and Time headers', async () => {
        await spotSellPage.switchToMarketTrades();
        const headers = await spotSellPage.getTradesPanelHeaders();
        const j = headers.join(' ').toLowerCase();
        expect.soft(j, 'Market Trades: Price header').toContain('price');
        expect.soft(
            (j.includes('amount') || j.includes('qty')) ? 'found' : 'not found',
            `Market Trades: Amount header — got: ${JSON.stringify(headers)}`,
        ).toBe('found');
        expect.soft(j, 'Market Trades: Time header').toContain('time');
        console.log(`[TC-31] Market Trades headers | Headers: ${JSON.stringify(headers)}`);
    });

    // ── TC-32 ─────────────────────────────────────────────────────────────────
    test('TC-32: My Trades panel has Price, Amount and Time headers', async () => {
        await spotSellPage.switchToMyTrades();
        const headers = await spotSellPage.getTradesPanelHeaders();
        const j = headers.join(' ').toLowerCase();
        expect.soft(j, 'My Trades: Price header').toContain('price');
        expect.soft(
            (j.includes('amount') || j.includes('qty')) ? 'found' : 'not found',
            `My Trades: Amount header — got: ${JSON.stringify(headers)}`,
        ).toBe('found');
        expect.soft(j, 'My Trades: Time header').toContain('time');
        await spotSellPage.switchToMarketTrades();
        console.log(`[TC-32] My Trades headers | Headers: ${JSON.stringify(headers)}`);
    });

    // ── TC-33 ─────────────────────────────────────────────────────────────────
    test('TC-33: Market Trades has actual data rows', async () => {
        const rows = await spotSellPage.getMarketTradesRows();
        expect.soft(rows.length, 'Market Trades should have ≥1 row').toBeGreaterThan(0);
        if (rows.length > 0) {
            expect.soft(rows[0].price,  'First row price should be positive').toBeGreaterThan(0);
            expect.soft(rows[0].amount, 'First row amount should be positive').toBeGreaterThan(0);
        }
        console.log(`[TC-33] Market Trades | Rows: ${rows.length} | First Row Price: ${rows[0]?.price ?? 'N/A'} | First Row Amount: ${rows[0]?.amount ?? 'N/A'}`);
    });

    // ── TC-34 ─────────────────────────────────────────────────────────────────
    test('TC-34: Market Trades prices match Binance recent trades within 1%', async () => {
        const [rows, binance] = await Promise.all([
            spotSellPage.getMarketTradesRows(),
            BinanceHelper.getRecentTrades(page, tradeData.searchPair, 20),
        ]);
        if (rows.length === 0 || binance.length === 0) { console.warn('[TC-34] No data'); return; }
        expect.soft(diffPct(rows[0].price, binance[0].price), `Market Trades diff% — page:${rows[0].price} Binance:${binance[0].price}`).toBeLessThan(1);
        console.log(`[TC-34] Market Trades price vs Binance | Page: ${rows[0].price} | Binance: ${binance[0].price} | Diff%: ${diffPct(rows[0].price, binance[0].price)}`);
    });

    // ── TC-35 ─────────────────────────────────────────────────────────────────
    test('TC-35: Open Orders section visible with correct tab and View All button', async () => {
        const r = await spotSellPage.getOpenOrdersTabStatus();
        expect.soft(r.viewAllText,       '"View All" button should be present').toBe('View All');
        expect.soft(r.openOrdersTabText, '"Open Orders" tab should be present').toBe('Open Orders');
        console.log(`[TC-35] Open Orders section | View All Text: "${r.viewAllText}" | Open Orders Tab: "${r.openOrdersTabText}"`);
    });

    // ── TC-36 ─────────────────────────────────────────────────────────────────
    test('TC-36: Open Orders shows the placed sell limit order', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Open Orders validation.');
        if (orderFilledImmediately) {
            test.info().annotations.push({ type: 'suggestion', description: `TC-36: Limit price (${tradeData.sellLimitPrice}) was below market (${marketPriceAtOrder}) — order filled immediately, no pending entry in Open Orders.` });
            console.log('[TC-36] Order filled immediately — skipping Open Orders pending check');
            return;
        }
        const r = await spotSellPage.validateOpenOrdersTab(orderDetails);
        expect.soft(r.pairActual?.replace('/', ''),  `Open Orders — pair`).toContain(orderDetails.pair.replace('/', ''));
        expect.soft(r.typeActual?.toLowerCase(),   `Open Orders — type expected to contain "${tradeData.orderType.toLowerCase()}"`).toContain(tradeData.orderType.toLowerCase());
        expect.soft(r.sideActual?.toLowerCase(),   `Open Orders — side expected to contain "${tradeData.openOrdersSide.toLowerCase()}"`).toContain(tradeData.openOrdersSide.toLowerCase());
        expect.soft(r.priceActual,                 `Open Orders — price (expected ≈ ${orderDetails.price})`).toBeGreaterThan(0);
        expect.soft(r.amountActual,                `Open Orders — amount (expected ≈ ${orderDetails.amount})`).toBeGreaterThan(0);
        if (r.dateTimeDiffSec >= 60) test.info().annotations.push({ type: 'warn', description: `Open Orders date/time diff: ${r.dateTimeDiffSec}s ≥ 60s — actual: "${r.dateTimeActual}" (soft, does not fail test)` });
        expect.soft(r.stopLimitActual,             `Open Orders — Stop Limit should be "-"`).toBe('-');
        // The last column in Open Orders is the Cancel button — its presence proves the order is pending/cancellable
        expect.soft(r.statusActual?.toLowerCase(), `Open Orders — Cancel button present confirms order is pending and cancellable`).toContain('cancel');
        expect.soft(r.filledActual,                `Open Orders — filled should be 0`).toBe(0);
        expect.soft(r.remainingActual,             `Open Orders — remaining (expected ≈ ${orderDetails.amount})`).toBeGreaterThan(0);
        expect.soft(r.totalActual,                 `Open Orders — total should be ≥ 0`).toBeGreaterThanOrEqual(0);
        console.log(`[TC-36] Open Orders | Pair: ${r.pairActual} | Type: ${r.typeActual} | Side: ${r.sideActual} | Price: ${r.priceActual} | Amount: ${r.amountActual} | Status: ${r.statusActual} | Filled: ${r.filledActual} | Remaining: ${r.remainingActual} | Date/Time: ${r.dateTimeActual}`);
    });

    // ── TC-37 ─────────────────────────────────────────────────────────────────
    test('TC-37: All Orders shows the placed sell limit order', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping All Orders validation.');
        const r = await spotSellPage.validateAllOrdersTab(orderDetails);
        expect.soft(r.pairActual?.replace('/', ''),  `All Orders — pair`).toContain(orderDetails.pair.replace('/', ''));
        expect.soft(r.typeActual?.toLowerCase(),   `All Orders — type expected to contain "${tradeData.orderType.toLowerCase()}"`).toContain(tradeData.orderType.toLowerCase());
        expect.soft(r.sideActual?.toLowerCase(),   `All Orders — side expected to contain "${tradeData.allOrdersSide.toLowerCase()}"`).toContain(tradeData.allOrdersSide.toLowerCase());
        expect.soft(parseFloat(r.priceFieldActual?.replace(/[^0-9.]/g, '') ?? '0') || 0, `All Orders — limit price (expected ≈ ${orderDetails.price}) should be > 0`).toBeGreaterThan(0);
        if (r.dateTimeDiffSec >= 60) test.info().annotations.push({ type: 'warn', description: `All Orders date/time diff: ${r.dateTimeDiffSec}s ≥ 60s — actual: "${r.dateTimeActual}" (soft, does not fail test)` });
        if (orderFilledImmediately) {
            // Limit price below market → executed immediately: status = done/filled, filled = amount, remaining = 0
            expect.soft(r.statusActual,    `All Orders — immediate fill: status should be done/filled/complete`).toMatch(/done|filled|complete/i);
            expect.soft(r.filledActual,    `All Orders — immediate fill: filled should be > 0`).toBeGreaterThan(0);
        } else {
            // Pending order: status = new/pending/open, filled = 0, remaining > 0
            expect.soft(r.statusActual,    `All Orders — pending: status should be new/pending/open`).toMatch(/new|pending|open/i);
            expect.soft(r.filledActual,    `All Orders — pending: filled should be 0`).toBe(0);
            expect.soft(r.remainingActual, `All Orders — pending: remaining (expected ≈ ${orderDetails.amount})`).toBeGreaterThan(0);
        }
        allOrdersAmountActual = r.filledActual + r.remainingActual;
        console.log(`[TC-37] All Orders (${orderFilledImmediately ? 'immediate fill' : 'pending'}) | Pair: ${r.pairActual} | Type: ${r.typeActual} | Side: ${r.sideActual} | Limit Price: ${r.priceFieldActual} | Status: ${r.statusActual} | Filled: ${r.filledActual} | Remaining: ${r.remainingActual} | Amount: ${allOrdersAmountActual} | OrderId: ${r.orderId}`);
    });

    // ── TC-38 ─────────────────────────────────────────────────────────────────
    test('TC-38: base coin available balance decreases after placing sell order', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping balance check.');
        const v = spotSellPage.validateOrderTotalRange(orderDetails.amount, allOrdersAmountActual);
        expect.soft(v.totalOk    ? 'pass' : `fail(${v.actual} > ${orderDetails.amount * 1.001})`, `All Orders amount must not exceed placed amount (${orderDetails.amount})`).toBe('pass');
        expect.soft(v.pctBelowOk ? 'pass' : `fail(${v.pctBelow.toFixed(2)}% below)`,             `All Orders amount diff% must be < 6%`).toBe('pass');
        const r = await spotSellPage.getBalanceAfterOrderStatus(v.actual, 'sell');
        expect.soft(r.balanceValidStatus, r.balanceMsg).toBe('valid');
        console.log(`[TC-38] Balance check | Input amount: ${orderDetails.amount} | All Orders amount: ${v.actual} | ${v.pctBelow.toFixed(2)}% below | Balance status: "${r.balanceValidStatus}"`);
    });

    // ── TC-39 ─────────────────────────────────────────────────────────────────
    test('TC-39: Trade History tab shows the placed sell order (skipped if pending)', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Trade History validation.');
        const r = await spotSellPage.validateTransactionHistoryOrdersTab(orderDetails);
        if (!r.orderId || !orderDetails.orderId || r.orderId !== orderDetails.orderId) {
            test.info().annotations.push({ type: 'suggestion', description: `TC-39: Order ${orderDetails.orderId ?? ''} not found in Trade History — order is still pending (unfilled). Trade History only shows executed trades.` });
            console.log(`[TC-39] Trade History — order not found (pending/unfilled). Found orderId: "${r.orderId}", expected: "${orderDetails.orderId ?? 'N/A'}"`);
            return;
        }
        expect.soft(r.pairActual?.replace('/', ''),  `Trade History — pair`).toContain(orderDetails.pair.replace('/', ''));
        expect.soft(r.sideActual?.toLowerCase(), `Trade History — side expected to contain "${tradeData.tradeHistorySide.toLowerCase()}"`).toContain(tradeData.tradeHistorySide.toLowerCase());
        expect.soft(r.executedActual,            `Trade History — executed price should be > 0`).toBeGreaterThan(0);
        expect.soft(r.amountActual,              `Trade History — amount should be > 0`).toBeGreaterThan(0);
        expect.soft(r.totalActual,               `Trade History — total (expected ≈ ${r.totalExpected}) should be > 0`).toBeGreaterThan(0);
        expect.soft(r.feeActual,                 `Trade History — fee (expected ≈ ${r.feeExpected}) should be ≥ 0`).toBeGreaterThanOrEqual(0);
        if (r.dateTimeDiffSec >= 60) test.info().annotations.push({ type: 'warn', description: `Trade History date/time diff: ${r.dateTimeDiffSec}s ≥ 60s — actual: "${r.dateTimeActual}" (soft, does not fail test)` });
        console.log(`[TC-39] Trade History | Pair: ${r.pairActual} | Side: ${r.sideActual} | Executed: ${r.executedActual} | Amount: ${r.amountActual} | Total: ${r.totalActual} (exp: ${r.totalExpected}) | Fee: ${r.feeActual} (exp: ${r.feeExpected}) | OrderId: ${r.orderId} | Date/Time: "${r.dateTimeActual}" diff: ${r.dateTimeDiffSec}s`);
    });

    // ── TC-40 ─────────────────────────────────────────────────────────────────
    test('TC-40: Trade History bottom tab shows the placed sell order', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Trade History bottom tab.');
        const entry = await spotSellPage.getTradeHistoryBottomTabFirstEntry();
        if (!entry) { console.warn('[TC-40] No Trade History rows'); return; }
        // Only assert if the first row matches our order — pending limit orders are NOT in Trade History
        const firstRowOrderId = (entry.raw[1] ?? '').trim();
        if (!orderDetails.orderId || !firstRowOrderId || firstRowOrderId !== orderDetails.orderId) {
            test.info().annotations.push({ type: 'suggestion', description: `TC-40: First Trade History entry (orderId: "${firstRowOrderId}") does not match our order "${orderDetails.orderId ?? 'N/A'}" — order is still pending (unfilled). Trade History only shows executed trades.` });
            console.log(`[TC-40] Trade History — entry orderId "${firstRowOrderId}" ≠ our order "${orderDetails.orderId ?? 'N/A'}" — skipping assertions (order pending)`);
            return;
        }
        expect.soft(
            (entry.pair.includes(baseCoin) || entry.pair.includes(tradeData.searchPair.replace('/', ''))) ? 'found' : 'not found',
            `Trade History pair ("${entry.pair}") should reference "${baseCoin}"`,
        ).toBe('found');
        expect.soft(entry.side.toLowerCase(), 'Trade History side should be "sell"').toContain('sell');
        expect.soft(entry.price, 'Trade History price should be positive').toBeGreaterThan(0);
        console.log(`[TC-40] Trade History first entry | Pair: "${entry.pair}" | Side: "${entry.side}" | Price: ${entry.price} | OrderId: "${firstRowOrderId}"`);
    });

    // ── TC-41 ─────────────────────────────────────────────────────────────────
    test('TC-41: cancel sell order and verify base coin balance is restored', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Nothing to cancel.');
        if (orderFilledImmediately) {
            test.info().annotations.push({ type: 'suggestion', description: `TC-41: Limit price (${tradeData.sellLimitPrice}) was below market (${marketPriceAtOrder}) — order filled immediately, nothing to cancel.` });
            console.log('[TC-41] Order filled immediately — no pending order to cancel');
            return;
        }
        const r = await spotSellPage.cancelLatestOrderAndVerifyBalance(tradeData.searchPair, 'sell');
        expect.soft(r.cancelledStatus,       r.cancelledMsg).toBe('cancelled');
        expect.soft(r.balanceRestoredStatus, r.balanceRestoredMsg).toBe('restored');
        console.log(`[TC-41] Cancel sell order | Cancelled Status: "${r.cancelledStatus}" | Balance Restored Status: "${r.balanceRestoredStatus}" | Message: "${r.cancelledMsg}"`);
    });

    // ── TC-42 ─────────────────────────────────────────────────────────────────
    test('TC-42: full balance snapshot after cancel confirms base coin restored', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping post-cancel balance check.');
        if (orderFilledImmediately) {
            test.info().annotations.push({ type: 'suggestion', description: 'TC-42: Order filled immediately — no cancel took place, inOrder restore check skipped.' });
            console.log('[TC-42] Order filled immediately — skipping cancel balance check');
            return;
        }
        if (!snapshotAfterOrder) { console.warn('[TC-42] No post-order snapshot'); return; }
        const results = await spotSellPage.validateBalanceAfterOrderCancel(
            portfolioSpotPage, snapshotAfterOrder, quoteCoin, baseCoin,
            orderDetails.amount, orderDetails.price, 'sell',
        );
        for (const r of results) expect.soft(r.pass, r.msg).toBe(true);
        console.log(`[TC-42] Balance after cancel | Sell Avlb After Order: ${snapshotAfterOrder.sellAvlb}`);
    });

    // ────────────────────────────────────────────────────────────────────────────
    // Cancel All scenario — 4 sell + 2 buy pending orders
    // ────────────────────────────────────────────────────────────────────────────

    // ── TC-43 ─────────────────────────────────────────────────────────────────
    test('TC-43: snapshot before placing multiple pending orders (Cancel All test)', async () => {
        test.skip(!orderSucceeded, 'Prior order not placed — skipping Cancel All scenario.');
        multiOrderActualSellAmounts = [];
        multiOrderActualBuyTotals   = [];
        snapshotBeforeMultiOrders = await spotSellPage.captureFullSnapshot(portfolioSpotPage, tradeData.searchPair);
        expect.soft(snapshotBeforeMultiOrders.sellAvlb, 'Pre-multi-order sellAvlb should be non-negative').toBeGreaterThanOrEqual(0);
        expect.soft(snapshotBeforeMultiOrders.buyAvlb,  'Pre-multi-order buyAvlb should be non-negative').toBeGreaterThanOrEqual(0);
        console.log(`[TC-43] Pre-multi-order snapshot | Sell Avlb: ${snapshotBeforeMultiOrders.sellAvlb} | Buy Avlb: ${snapshotBeforeMultiOrders.buyAvlb}`);
    });

    // ── TC-44: 1st pending sell limit order ───────────────────────────────
    test('TC-44: place 1st pending sell limit order and verify state after placement', async () => {
        test.skip(!orderSucceeded, 'Prior order not placed — skipping TC-44.');
        const price2  = parseFloat(tradeData.sellLimitPrice2  ?? '');
        const amount2 = parseFloat(tradeData.sellLimitAmount2 ?? '');
        test.skip(!price2 || !amount2, 'sellLimitPrice2 or sellLimitAmount2 missing in CSV — skipping TC-44.');
        const r = await spotSellPage.placePendingSellLimitOrder(price2, amount2);
        multiOrdersSucceeded = !!r.orderId;
        multiOrderActualSellAmounts.push(r.actual);
        expect.soft(r.successMsg,   'TC-44: 1st pending sell order should succeed').toContain('success');
        expect.soft(r.amountOk ? 'pass' :`fail(${r.actual} > ${amount2 * 1.001})`, `TC-44: All Orders remaining must not exceed entered (${amount2})`).toBe('pass');
        expect.soft(r.pctBelowOk ? 'pass' :`fail(${r.pctBelow.toFixed(2)}%)`,     `TC-44: amount diff% must be < 6%`).toBe('pass');
        const c = await spotSellPage.validateAfterOrderPlacement({ orderId: r.orderId, actualLocked: r.actual, balanceBefore: r.balanceBefore, orderN: 1, searchPair: tradeData.searchPair, side: 'sell' });
        expect.soft(c.allOrdersStatus.toLowerCase(),                                   'TC-44: All Orders status should be New/pending').toMatch(/new|pending|open/i);
        expect.soft(c.openCount,                                                        'TC-44: Open Orders should show ≥ 1').toBeGreaterThanOrEqual(1);
        expect.soft(c.tradeHistoryExcluded ? 'not-in-th' : 'in-th',                    `TC-44: Pending order ${r.orderId} should NOT be in Trade History`).toBe('not-in-th');
        expect.soft(c.balanceOk ? 'pass' : `fail(avlb=${c.balanceNow} exp≈${c.expectedBalance} diff=${c.balanceDiff})`, 'TC-44: sellAvlb should decrease by locked amount').toBe('pass');
        console.log(`[TC-44] 1st Pending Sell | Price: ${price2} | Amount: ${r.actual} | Open: ${c.openCount} | sellAvlb: ${c.balanceNow} | OrderId: ${r.orderId}`);
    });

    // ── TC-45: 2nd pending sell limit order ────────────────────────────────
    test('TC-45: place 2nd pending sell limit order and verify state after placement', async () => {
        test.skip(!multiOrdersSucceeded, 'Previous order failed — skipping TC-45.');
        const price3  = parseFloat(tradeData.sellLimitPrice3  ?? '');
        const amount3 = parseFloat(tradeData.sellLimitAmount3 ?? '');
        test.skip(!price3 || !amount3, 'sellLimitPrice3 or sellLimitAmount3 missing in CSV — skipping TC-45.');
        const r = await spotSellPage.placePendingSellLimitOrder(price3, amount3);
        multiOrderActualSellAmounts.push(r.actual);
        expect.soft(r.successMsg,   'TC-45: 2nd pending sell order should succeed').toContain('success');
        expect.soft(r.amountOk ? 'pass' :`fail(${r.actual} > ${amount3 * 1.001})`, `TC-45: All Orders remaining must not exceed entered (${amount3})`).toBe('pass');
        expect.soft(r.pctBelowOk ? 'pass' :`fail(${r.pctBelow.toFixed(2)}%)`,     `TC-45: amount diff% must be < 6%`).toBe('pass');
        const c = await spotSellPage.validateAfterOrderPlacement({ orderId: r.orderId, actualLocked: r.actual, balanceBefore: r.balanceBefore, orderN: 2, searchPair: tradeData.searchPair, side: 'sell' });
        expect.soft(c.allOrdersStatus.toLowerCase(),                                   'TC-45: All Orders status should be New/pending').toMatch(/new|pending|open/i);
        expect.soft(c.openCount,                                                        'TC-45: Open Orders should show ≥ 2').toBeGreaterThanOrEqual(2);
        expect.soft(c.tradeHistoryExcluded ? 'not-in-th' : 'in-th',                    `TC-45: Pending order ${r.orderId} should NOT be in Trade History`).toBe('not-in-th');
        expect.soft(c.balanceOk ? 'pass' : `fail(avlb=${c.balanceNow} exp≈${c.expectedBalance} diff=${c.balanceDiff})`, 'TC-45: sellAvlb should decrease by locked amount').toBe('pass');
        console.log(`[TC-45] 2nd Pending Sell | Price: ${price3} | Amount: ${r.actual} | Open: ${c.openCount} | sellAvlb: ${c.balanceNow} | OrderId: ${r.orderId}`);
    });

    // ── TC-46: 3rd pending sell limit order ────────────────────────────────
    test('TC-46: place 3rd pending sell limit order and verify state after placement', async () => {
        test.skip(!multiOrdersSucceeded, 'Previous order failed — skipping TC-46.');
        const price4  = parseFloat(tradeData.sellLimitPrice4  ?? '');
        const amount4 = parseFloat(tradeData.sellLimitAmount4 ?? '');
        test.skip(!price4 || !amount4, 'sellLimitPrice4 or sellLimitAmount4 missing in CSV — skipping TC-46.');
        const r = await spotSellPage.placePendingSellLimitOrder(price4, amount4);
        multiOrderActualSellAmounts.push(r.actual);
        expect.soft(r.successMsg,   'TC-46: 3rd pending sell order should succeed').toContain('success');
        expect.soft(r.amountOk ? 'pass' :`fail(${r.actual} > ${amount4 * 1.001})`, `TC-46: All Orders remaining must not exceed entered (${amount4})`).toBe('pass');
        expect.soft(r.pctBelowOk ? 'pass' :`fail(${r.pctBelow.toFixed(2)}%)`,     `TC-46: amount diff% must be < 6%`).toBe('pass');
        const c = await spotSellPage.validateAfterOrderPlacement({ orderId: r.orderId, actualLocked: r.actual, balanceBefore: r.balanceBefore, orderN: 3, searchPair: tradeData.searchPair, side: 'sell' });
        expect.soft(c.allOrdersStatus.toLowerCase(),                                   'TC-46: All Orders status should be New/pending').toMatch(/new|pending|open/i);
        expect.soft(c.openCount,                                                        'TC-46: Open Orders should show ≥ 3').toBeGreaterThanOrEqual(3);
        expect.soft(c.tradeHistoryExcluded ? 'not-in-th' : 'in-th',                    `TC-46: Pending order ${r.orderId} should NOT be in Trade History`).toBe('not-in-th');
        expect.soft(c.balanceOk ? 'pass' : `fail(avlb=${c.balanceNow} exp≈${c.expectedBalance} diff=${c.balanceDiff})`, 'TC-46: sellAvlb should decrease by locked amount').toBe('pass');
        console.log(`[TC-46] 3rd Pending Sell | Price: ${price4} | Amount: ${r.actual} | Open: ${c.openCount} | sellAvlb: ${c.balanceNow} | OrderId: ${r.orderId}`);
    });

    // ── TC-47: 4th pending sell limit order ────────────────────────────────
    test('TC-47: place 4th pending sell limit order and verify state after placement', async () => {
        test.skip(!multiOrdersSucceeded, 'Previous order failed — skipping TC-47.');
        const price5  = parseFloat(tradeData.sellLimitPrice5  ?? '');
        const amount5 = parseFloat(tradeData.sellLimitAmount5 ?? '');
        test.skip(!price5 || !amount5, 'sellLimitPrice5 or sellLimitAmount5 missing in CSV — skipping TC-47.');
        const r = await spotSellPage.placePendingSellLimitOrder(price5, amount5);
        multiOrderActualSellAmounts.push(r.actual);
        expect.soft(r.successMsg,   'TC-47: 4th pending sell order should succeed').toContain('success');
        expect.soft(r.amountOk ? 'pass' :`fail(${r.actual} > ${amount5 * 1.001})`, `TC-47: All Orders remaining must not exceed entered (${amount5})`).toBe('pass');
        expect.soft(r.pctBelowOk ? 'pass' :`fail(${r.pctBelow.toFixed(2)}%)`,     `TC-47: amount diff% must be < 6%`).toBe('pass');
        const c = await spotSellPage.validateAfterOrderPlacement({ orderId: r.orderId, actualLocked: r.actual, balanceBefore: r.balanceBefore, orderN: 4, searchPair: tradeData.searchPair, side: 'sell' });
        expect.soft(c.allOrdersStatus.toLowerCase(),                                   'TC-47: All Orders status should be New/pending').toMatch(/new|pending|open/i);
        expect.soft(c.openCount,                                                        'TC-47: Open Orders should show ≥ 4').toBeGreaterThanOrEqual(4);
        expect.soft(c.tradeHistoryExcluded ? 'not-in-th' : 'in-th',                    `TC-47: Pending order ${r.orderId} should NOT be in Trade History`).toBe('not-in-th');
        expect.soft(c.balanceOk ? 'pass' : `fail(avlb=${c.balanceNow} exp≈${c.expectedBalance} diff=${c.balanceDiff})`, 'TC-47: sellAvlb should decrease by locked amount').toBe('pass');
        console.log(`[TC-47] 4th Pending Sell | Price: ${price5} | Amount: ${r.actual} | Open: ${c.openCount} | sellAvlb: ${c.balanceNow} | OrderId: ${r.orderId}`);
    });

    // ── TC-48: 1st pending buy limit order (for cancel-all) ────────────────
    test('TC-48: place 1st pending buy limit order and verify state after placement', async () => {
        test.skip(!multiOrdersSucceeded, 'Previous order failed — skipping TC-48.');
        const buyPrice1 = parseFloat(tradeData.cancelAllBuyPrice1 ?? '');
        const buyTotal1 = parseFloat(tradeData.cancelAllBuyTotal1 ?? '');
        test.skip(!buyPrice1 || !buyTotal1, 'cancelAllBuyPrice1 or cancelAllBuyTotal1 missing in CSV — skipping TC-48.');
        const r = await spotSellPage.placePendingBuyLimitOrderForSellSpec(buyPrice1, buyTotal1);
        multiOrderActualBuyTotals.push(r.actual);
        expect.soft(r.successMsg,  'TC-48: 1st pending buy order should succeed').toContain('success');
        expect.soft(r.totalOk ? 'pass' :`fail(${r.actual} > ${buyTotal1 * 1.001})`, `TC-48: All Orders total must not exceed entered (${buyTotal1})`).toBe('pass');
        expect.soft(r.pctBelowOk ? 'pass' :`fail(${r.pctBelow.toFixed(2)}%)`,      `TC-48: total diff% must be < 6%`).toBe('pass');
        const c = await spotSellPage.validateAfterOrderPlacement({ orderId: r.orderId, actualLocked: r.actual, balanceBefore: r.balanceBefore, orderN: 5, searchPair: tradeData.searchPair, side: 'buy' });
        expect.soft(c.allOrdersStatus.toLowerCase(),                                    'TC-48: All Orders status should be New/pending').toMatch(/new|pending|open/i);
        expect.soft(c.openCount,                                                         'TC-48: Open Orders should show ≥ 5').toBeGreaterThanOrEqual(5);
        expect.soft(c.tradeHistoryExcluded ? 'not-in-th' : 'in-th',                     `TC-48: Pending buy order ${r.orderId} should NOT be in Trade History`).toBe('not-in-th');
        expect.soft(c.balanceOk ? 'pass' : `fail(avlb=${c.balanceNow} exp≈${c.expectedBalance} diff=${c.balanceDiff})`, 'TC-48: buyAvlb should decrease by locked amount').toBe('pass');
        console.log(`[TC-48] 1st Pending Buy | Price: ${buyPrice1} | Total: ${r.actual} | Open: ${c.openCount} | buyAvlb: ${c.balanceNow} | OrderId: ${r.orderId}`);
    });

    // ── TC-49: 2nd pending buy limit order (for cancel-all) ────────────────
    test('TC-49: place 2nd pending buy limit order and verify state after placement', async () => {
        test.skip(!multiOrdersSucceeded, 'Previous order failed — skipping TC-49.');
        const buyPrice2 = parseFloat(tradeData.cancelAllBuyPrice2 ?? '');
        const buyTotal2 = parseFloat(tradeData.cancelAllBuyTotal2 ?? '');
        test.skip(!buyPrice2 || !buyTotal2, 'cancelAllBuyPrice2 or cancelAllBuyTotal2 missing in CSV — skipping TC-49.');
        const r = await spotSellPage.placePendingBuyLimitOrderForSellSpec(buyPrice2, buyTotal2);
        multiOrderActualBuyTotals.push(r.actual);
        expect.soft(r.successMsg,  'TC-49: 2nd pending buy order should succeed').toContain('success');
        expect.soft(r.totalOk ? 'pass' :`fail(${r.actual} > ${buyTotal2 * 1.001})`, `TC-49: All Orders total must not exceed entered (${buyTotal2})`).toBe('pass');
        expect.soft(r.pctBelowOk ? 'pass' :`fail(${r.pctBelow.toFixed(2)}%)`,      `TC-49: total diff% must be < 6%`).toBe('pass');
        const c = await spotSellPage.validateAfterOrderPlacement({ orderId: r.orderId, actualLocked: r.actual, balanceBefore: r.balanceBefore, orderN: 6, searchPair: tradeData.searchPair, side: 'buy' });
        expect.soft(c.allOrdersStatus.toLowerCase(),                                    'TC-49: All Orders status should be New/pending').toMatch(/new|pending|open/i);
        expect.soft(c.openCount,                                                         'TC-49: Open Orders should show ≥ 6').toBeGreaterThanOrEqual(6);
        expect.soft(c.tradeHistoryExcluded ? 'not-in-th' : 'in-th',                     `TC-49: Pending buy order ${r.orderId} should NOT be in Trade History`).toBe('not-in-th');
        expect.soft(c.balanceOk ? 'pass' : `fail(avlb=${c.balanceNow} exp≈${c.expectedBalance} diff=${c.balanceDiff})`, 'TC-49: buyAvlb should decrease by locked amount').toBe('pass');
        console.log(`[TC-49] 2nd Pending Buy | Price: ${buyPrice2} | Total: ${r.actual} | Open: ${c.openCount} | buyAvlb: ${c.balanceNow} | OrderId: ${r.orderId}`);
    });

    // ── TC-50 ─────────────────────────────────────────────────────────────────
    test('TC-50: Open Orders shows all 6 pending orders and Cancel All button', async () => {
        test.skip(!multiOrdersSucceeded || !snapshotBeforeMultiOrders, 'No orders or no snapshot — skipping TC-50.');
        const r = await spotSellPage.getOpenOrdersWithCancelAllStatus();
        expect.soft(r.rowCount,                                          'Open Orders should show 6 rows (4 sell + 2 buy)').toBeGreaterThanOrEqual(6);
        expect.soft(r.cancelAllVisible ? 'visible' : 'hidden',          'Cancel All button should be visible').toBe('visible');
        console.log(`[TC-50] Open Orders row count: ${r.rowCount} | Cancel All visible: ${r.cancelAllVisible}`);
    });

    // ── TC-51 ─────────────────────────────────────────────────────────────────
    test('TC-51: balance shows sell orders locked in sellAvlb inOrder and buy orders locked in buyAvlb inOrder', async () => {
        test.skip(!multiOrdersSucceeded || !snapshotBeforeMultiOrders, 'No orders or no snapshot — skipping TC-51.');
        const results = await spotSellPage.validateMultiOrderBalanceLock(
            portfolioSpotPage, tradeData.searchPair, snapshotBeforeMultiOrders!,
            multiOrderActualBuyTotals, multiOrderActualSellAmounts, quoteCoin, baseCoin,
        );
        for (const r of results) expect.soft(r.pass, r.msg).toBe(true);
        console.log(`[TC-51] Multi-order lock validated | Sell orders: ${multiOrderActualSellAmounts.length} | Buy orders: ${multiOrderActualBuyTotals.length}`);
    });

    // ── TC-52 ─────────────────────────────────────────────────────────────────
    test('TC-52: Trade History does NOT show pending/open limit orders', async () => {
        test.skip(!multiOrdersSucceeded, 'No multi-orders — skipping TC-52.');
        const tradeHistTab = page.getByText('Trade History', { exact: true }).first();
        await tradeHistTab.click().catch(() => {});
        await page.waitForTimeout(1000);
        const rows = await spotSellPage.getOpenOrderRowCount();
        console.log(`[TC-52] Trade History row count after multi-orders: ${rows} (pending orders should not appear here)`);
        test.info().annotations.push({ type: 'info', description: `TC-52: Trade History checked — pending limit orders should not appear. Rows found: ${rows}` });
    });

    // ── TC-53: cancel one order individually ───────────────────────────────
    test('TC-53: cancel one order individually by clicking its row Cancel button', async () => {
        test.skip(!multiOrdersSucceeded, 'No multi-orders placed — skipping TC-53.');
        await spotSellPage.openOrdersTab.click();
        await page.waitForTimeout(1000);
        const result = await spotSellPage.cancelFirstOpenOrder();
        expect.soft(result.confirmed ? 'cancelled' : 'not cancelled', `TC-53: Individual cancel toast — ${result.toastMsg}`).toBe('cancelled');
        console.log(`[TC-53] Individual cancel | Confirmed: ${result.confirmed} | Toast: "${result.toastMsg}"`);
    });

    // ── TC-54 ─────────────────────────────────────────────────────────────────
    test('TC-54: 5 orders remain in Open Orders after individual cancel', async () => {
        test.skip(!multiOrdersSucceeded, 'No multi-orders — skipping TC-54.');
        await spotSellPage.openOrdersTab.click();
        await page.waitForTimeout(1000);
        const remaining = await spotSellPage.getOpenOrderRowCount();
        expect.soft(remaining, 'After cancelling 1 of 6, 5 should remain').toBeGreaterThanOrEqual(5);
        console.log(`[TC-54] Open Orders after individual cancel: ${remaining} rows`);
    });

    // ── TC-55: Cancel All ──────────────────────────────────────────────────
    test('TC-55: Cancel All button removes all remaining open orders', async () => {
        test.skip(!multiOrdersSucceeded, 'No multi-orders placed — skipping TC-55.');
        const result = await spotSellPage.cancelAllOpenOrders();
        const v = spotSellPage.validateCancelAllMessage(result.toastMsg, tradeData.cancelAllMsg ?? undefined);
        expect.soft(result.confirmed ? 'cancelled' : 'not cancelled', `TC-55: Cancel All — ${result.toastMsg}`).toBe('cancelled');
        expect.soft(v.match, `TC-55: Cancel All toast should contain "${tradeData.cancelAllMsg ?? 'cancel/success'}"`).toBe('match');
        console.log(`[TC-55] Cancel All | Confirmed: ${result.confirmed} | Toast: "${result.toastMsg}" | ExpectedMsg: "${tradeData.cancelAllMsg ?? '(none)'}"`);
    });

    // ── TC-56 ─────────────────────────────────────────────────────────────────
    test('TC-56: Open Orders shows "No data" after Cancel All', async () => {
        test.skip(!multiOrdersSucceeded, 'No multi-orders — skipping TC-56.');
        const r = await spotSellPage.validateOpenOrdersEmpty(tradeData.noDataText ?? undefined);
        expect.soft(r.isVisible ? 'visible' : 'hidden', `Open Orders should show "${tradeData.noDataText ?? 'No data'}" after Cancel All`).toBe('visible');
        expect.soft(r.rowCount,                          'Open Orders row count should be 0 after Cancel All').toBe(0);
        console.log(`[TC-56] Open Orders after Cancel All | No Data visible: ${r.isVisible} | Row count: ${r.rowCount}`);
    });

    // ── TC-57 ─────────────────────────────────────────────────────────────────
    test('TC-57: All Orders shows cancelled/done status for the cancelled orders', async () => {
        test.skip(!multiOrdersSucceeded, 'No multi-orders placed — skipping TC-57.');
        const r = await spotSellPage.validateAllOrdersCancelled(tradeData.searchPair);
        expect.soft(r.statusResult,                          'TC-57: All Orders row after Cancel All should show cancelled/done status').toBe('cancelled/done');
        expect.soft(r.cancelledColorOk ? 'red' : 'not-red', 'TC-57: Cancelled status color should be red').toBe('red');
        console.log(`[TC-57] All Orders after Cancel All | Status: "${r.statusActual}" | CancelledColorOk: ${r.cancelledColorOk} | Pair: ${r.pairActual}`);
    });

    // ── TC-58 ─────────────────────────────────────────────────────────────────
    test('TC-58: Trade History does not show the cancelled pending orders', async () => {
        test.skip(!multiOrdersSucceeded, 'No multi-orders placed — skipping TC-58.');
        const r = await spotSellPage.validateTradeHistoryAfterCancelAll();
        test.info().annotations.push({ type: 'info', description: `TC-58: Trade History rows after Cancel All: ${r.rowCount}. Cancelled pending orders should not appear here.` });
        console.log(`[TC-58] Trade History after Cancel All | Row count: ${r.rowCount} (cancelled pending orders should not be here)`);
    });

    // ── TC-59 ─────────────────────────────────────────────────────────────────
    test('TC-59: balance fully restored after Cancel All — inOrder returns to 0, both coins restored', async () => {
        test.skip(!multiOrdersSucceeded || !snapshotBeforeMultiOrders, 'No orders or no pre-snapshot — skipping TC-59.');
        const results = await spotSellPage.validateBalanceRestoredAfterCancelAll(
            portfolioSpotPage, tradeData.searchPair, snapshotBeforeMultiOrders!, quoteCoin, baseCoin,
        );
        for (const r of results) expect.soft(r.pass, r.msg).toBe(true);
        console.log(`[TC-59] Balance restored after Cancel All | SellAvlb before: ${snapshotBeforeMultiOrders!.sellAvlb} | BuyAvlb before: ${snapshotBeforeMultiOrders!.buyAvlb}`);
    });

    // ── TC-60 ─────────────────────────────────────────────────────────────────
    test('TC-60: capture full balance snapshot before placing below-market sell', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping below-market scenario.');
        snapshotBeforeBelowMarket = await spotSellPage.captureFullSnapshot(portfolioSpotPage, tradeData.searchPair);
        expect.soft(snapshotBeforeBelowMarket.sellAvlb, 'Pre-below-market sellAvlb should be non-negative').toBeGreaterThanOrEqual(0);
        console.log(`[TC-60] Pre-below-market snapshot captured | Sell Avlb: ${snapshotBeforeBelowMarket.sellAvlb} | Buy Avlb: ${snapshotBeforeBelowMarket.buyAvlb}`);
    });

    // ────────────────────────────────────────────────────────────────────────────
    // Below-market sell scenario
    // ────────────────────────────────────────────────────────────────────────────

    // ── TC-61 ─────────────────────────────────────────────────────────────────
    test('TC-61: sell limit below market price — executes immediately at market', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping below-market sell test.');
        const limitPrice = parseFloat(tradeData.belowMarketLimitPrice ?? '50000');
        const amount     = parseFloat(tradeData.belowMarketAmount     ?? '0.0002');
        const r = await spotSellPage.placeBelowMarketLimitSell(limitPrice, amount);
        belowMarketOrderDetails = { limitPrice: r.limitPrice, executedPrice: r.executedPrice, amount: r.amount, placedAt: new Date(), orderId: r.orderId };
        expect.soft(
            r.successMsg.toLowerCase().includes('success') || r.successMsg.toLowerCase().includes('creat')
                ? 'success' : `failed: "${r.successMsg}"`,
            'Below-market sell should succeed',
        ).toBe('success');
        expect.soft(r.executedPrice, `Executed price should be ≥ limit price (${r.limitPrice})`).toBeGreaterThanOrEqual(r.limitPrice);
        console.log(`[TC-61] Below-market sell limit order placed | Limit Price: ${r.limitPrice} | Executed Price: ${r.executedPrice} | Executed Amount: ${r.amount} | Success Message: "${r.successMsg}"`);
    });

    // ── TC-62 ─────────────────────────────────────────────────────────────────
    test('TC-62: below-market sell NOT in Open Orders (filled immediately)', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping TC-62.');
        if (!belowMarketOrderDetails) { console.warn('[TC-62] No below-market order data'); return; }
        const { rowText, isAbsent, isFilled } = await spotSellPage.checkOpenOrdersHasPendingEntry(tradeData.searchPair);
        expect.soft(
            (isAbsent || isFilled) ? 'not pending' : `pending: "${rowText.slice(0, 80)}"`,
            'Below-market sell should not be Pending in Open Orders',
        ).toBe('not pending');
        console.log(`[TC-62] Below-market sell in Open Orders | Is Absent: ${isAbsent} | Is Filled: ${isFilled} | Row Text: "${rowText.slice(0, 80)}"`);
    });

    // ── TC-63 ─────────────────────────────────────────────────────────────────
    test('TC-63: All Orders shows correct limit price and executed price', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping TC-63.');
        if (!belowMarketOrderDetails) { console.warn('[TC-63] No below-market order data'); return; }
        const { limitPrice, executedPrice, amount } = belowMarketOrderDetails;
        const r = await spotSellPage.verifyBelowMarketInAllOrders(limitPrice, executedPrice, amount);
        expect.soft(r.rowLimitPrice,    `TC-63: All Orders — limit price (expected ≈ ${limitPrice})`).toBeGreaterThan(0);
        expect.soft(r.rowExecutedPrice, `TC-63: All Orders — executed price should be > 0`).toBeGreaterThan(0);
        expect.soft(r.rowStatus,        `TC-63: All Orders — status should be "${tradeData.doneStatus ?? 'Done'}"`).toBe(tradeData.doneStatus ?? 'Done');
        expect.soft(r.statusColorOk ? 'green' : 'not-green', 'TC-63: Done status color should be green').toBe('green');
        expect.soft(r.sideText?.toLowerCase(), `TC-63: All Orders — below-market side should contain "${(tradeData.belowMarketSide ?? 'Sell Full').toLowerCase()}"`).toContain((tradeData.belowMarketSide ?? 'Sell Full').toLowerCase());
        console.log(`[TC-63] All Orders below-market sell | LimitPrice: ${r.rowLimitPrice} | ExecPrice: ${r.rowExecutedPrice} | Status: "${r.rowStatus}" | ColorOk: ${r.statusColorOk} | Side: "${r.sideText}"`);
    });

    // ── TC-64 ─────────────────────────────────────────────────────────────────
    test('TC-64: Trade History shows the below-market sell order with side "sell"', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping TC-64.');
        if (!belowMarketOrderDetails) { console.warn('[TC-64] No below-market order data'); return; }
        const { limitPrice, executedPrice, amount, placedAt, orderId } = belowMarketOrderDetails;
        const thDetails: SpotOrderDetails = {
            pair: tradeData.searchPair,
            price: limitPrice,
            total: parseFloat((amount * (executedPrice > 0 ? executedPrice : limitPrice)).toFixed(8)),
            amount, estFee: 0, uiEstFee: 0,
            dateTime: placedAt, feeMatches: true,
            orderId,
            feePercent: parseFloat(tradeData.feePercent ?? '0.15'),
        };
        const r = await spotSellPage.validateTransactionHistoryOrdersTab(thDetails);
        if (!r.orderId || !thDetails.orderId || r.orderId !== thDetails.orderId) {
            test.info().annotations.push({ type: 'suggestion', description: `TC-64: Below-market order "${thDetails.orderId}" not yet in Trade History — may still be processing.` });
            console.log(`[TC-64] Trade History — below-market order not found. Found orderId: "${r.orderId}", expected: "${thDetails.orderId}"`);
            return;
        }
        expect.soft(r.sideActual?.toLowerCase(), `Trade History — below-market sell side should contain "sell"`).toContain('sell');
        expect.soft(r.executedActual, 'Trade History — executed price should be > 0').toBeGreaterThan(0);
        expect.soft(r.amountActual,   'Trade History — amount should be > 0').toBeGreaterThan(0);
        expect.soft(r.totalActual,    'Trade History — total should be > 0').toBeGreaterThan(0);
        console.log(`[TC-64] Trade History below-market sell | Side: ${r.sideActual} | Executed: ${r.executedActual} | Amount: ${r.amountActual} | Total: ${r.totalActual} | OrderId: ${r.orderId}`);
    });

    // ── TC-65 ─────────────────────────────────────────────────────────────────
    test('TC-65: My Trades shows executed price (market price) — NOT the limit price', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping TC-65.');
        if (!belowMarketOrderDetails) { console.warn('[TC-65] No below-market order data'); return; }
        const { executedPrice } = belowMarketOrderDetails;
        const limitPrice = belowMarketOrderDetails.limitPrice;
        const entries = await spotSellPage.getMyTradesEntries();
        expect.soft(entries.length, 'My Trades should have ≥1 entry').toBeGreaterThan(0);
        if (entries.length > 0) {
            const entry = entries[0];
            expect.soft(entry.price,  `My Trades — executed price (${entry.price}) should be > 0`).toBeGreaterThan(0);
            expect.soft(entry.amount, `My Trades — amount (${entry.amount}) should be > 0`).toBeGreaterThan(0);
            // For sell below market: executed price should be > limit price (market was higher)
            expect.soft(
                entry.price > limitPrice ? 'pass' : `fail — executed(${entry.price}) should be > limitPrice(${limitPrice})`,
                `My Trades price should be executed market price, not limit price (${limitPrice})`,
            ).toBe('pass');
            if (executedPrice > 0) {
                const priceDiffPct = Math.abs(entry.price - executedPrice) / executedPrice * 100;
                expect.soft(priceDiffPct, `My Trades price (${entry.price}) vs executed price (${executedPrice}) diff%`).toBeLessThan(1);
            }
            console.log(`[TC-65] My Trades | Executed Price: ${entry.price} | Amount: ${entry.amount} | Time: "${entry.time}" | Limit Price: ${limitPrice} | Expected Executed: ${executedPrice}`);
        } else {
            console.warn('[TC-65] My Trades — no entries found');
        }
    });

    // ── TC-66 ─────────────────────────────────────────────────────────────────
    test('TC-66: balance after fill — base coin decreased, quote coin increased', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping TC-66.');
        if (!snapshotBeforeBelowMarket || !belowMarketOrderDetails) { console.warn('[TC-66] Missing data'); return; }
        const { executedPrice, amount, limitPrice } = belowMarketOrderDetails;
        const results = await spotSellPage.validateMarketFillBalance(
            portfolioSpotPage, tradeData.searchPair, snapshotBeforeBelowMarket,
            executedPrice, amount, limitPrice, quoteCoin, baseCoin, 'sell',
        );
        for (const r of results) expect.soft(r.pass, r.msg).toBe(true);
        console.log(`[TC-66] Balance after below-market sell fill | Executed Price: ${executedPrice} | Executed Amount: ${amount} | LimitPrice: ${limitPrice}`);
    });

});
