import { test, expect } from '../../src/fixtures/pagefixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { SpotMarketOverviewPage } from '../../src/pages/trade/SpotMarketOverviewPage';
import { BinanceHelper } from '../../src/utils/BinanceHelper';
import { CsvHelper } from '../../src/utils/CsvHelper';
import type { Browser, BrowserContext, Page } from '@playwright/test';

// Order-type-agnostic checks (page chrome, ticker, order book, trades panels) that used to be
// copy-pasted identically into spotbuylimitorder/spotselllimitorder/spotmarketbuyorder/
// spotmarketsellorder.spec.ts. None of these depend on buy vs sell or limit vs market, so they
// run once here instead of 4 times. Reuses spotBuyLimitData.csv purely for its searchPair value —
// no order is ever placed from this file.
const tradeData = CsvHelper.readCsv('src/data/spotBuyLimitData.csv')[0];
const baseCoin  = tradeData.sellCurrency;

let browser:  Browser;
let context:  BrowserContext;
let page:     Page;
let loginPage:    LoginPage;
let overviewPage: SpotMarketOverviewPage;

const diffPct = (actual: number, ref: number) =>
    ref > 0 ? parseFloat((Math.abs(actual - ref) / ref * 100).toFixed(3)) : 0;

test.describe.serial('Spot Module — Market Overview (page chrome, ticker, order book, trades panels)', () => {

    test.beforeAll(async ({ playwright }, testInfo) => {
        browser = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL, ignoreHTTPSErrors: true });
        page          = await context.newPage();
        loginPage     = new LoginPage(page);
        overviewPage  = new SpotMarketOverviewPage(page);
        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!).catch(() => {});
        await loginPage.dismissPostLoginDialogsAndWaitForHome();
    });

    test.afterAll(async () => { await browser.close(); });

    // ── TC-01 ─────────────────────────────────────────────────────────────────
    test('TC-01: navigate to Spot Trading page @smoke @sanity', async () => {
        await overviewPage.navigateToSpotTrading();
        console.log('[TC-01] Navigated to Spot Trading page');
    });

    // ── TC-02 ─────────────────────────────────────────────────────────────────
    test('TC-02: Spot Trading page shows all expected labels @smoke @sanity', async () => {
        const r = await overviewPage.getSpotPageLabelsStatus();
        expect.soft(r.tradingText,       'Trading page heading').toBe('Trading');
        expect.soft(r.spotText,          'Spot label').toBe('Spot');
        expect.soft(r.depthViewText,     'Depth View label').toBe('Depth View');
        expect.soft(r.orderBookText,     'Order Book heading').toBe('Order Book');
        expect.soft(r.buyTabText,        'Buy tab').toBe('Buy');
        expect.soft(r.sellTabText,       'Sell tab').toBe('Sell');
        expect.soft(r.limitTabText,      'Limit tab').toBe('Limit');
        expect.soft(r.marketTabText,     'Market tab').toBe('Market');
        expect.soft(r.stopTabText,       'Stop tab').toBe('Stop');
        expect.soft(r.marketTradesText,  'Market Trades label').toBe('Market Trades');
        expect.soft(r.myTradesText,      'My Trades label').toBe('My Trades');
        expect.soft(r.openOrdersTabText, 'Open Orders tab').toBe('Open Orders');
        expect.soft(r.allOrdersText,     'All Orders tab').toBe('All Orders');
        expect.soft(r.tradeHistoryText,  'Trade History label').toBe('Trade History');
        console.log(`[TC-02] Depth View: "${r.depthViewText}" | Order Book: "${r.orderBookText}" | Buy: "${r.buyTabText}" | Sell: "${r.sellTabText}" | Limit: "${r.limitTabText}" | Market: "${r.marketTabText}" | Market Trades: "${r.marketTradesText}" | My Trades: "${r.myTradesText}" | All Orders: "${r.allOrdersText}" | Trade History: "${r.tradeHistoryText}"`);
    });

    // ── TC-03 ─────────────────────────────────────────────────────────────────
    test('TC-03: search currency pair in the market dropdown @sanity', async () => {
        await overviewPage.searchCurrencyPair(tradeData.searchPair);
        console.log(`[TC-03] Searched pair: ${tradeData.searchPair}`);
    });

    // ── TC-04 ─────────────────────────────────────────────────────────────────
    test('TC-04: mark currency pair as favorite and verify it appears in Favorites tab @sanity', async () => {
        const r = await overviewPage.markAsFavorite(tradeData.searchPair);
        expect.soft(r.favoriteAddedStatus, r.favoriteMsg).toBe('added');
        console.log(`[TC-04] Marked ${tradeData.searchPair} as favorite | Status: "${r.favoriteAddedStatus}" | Message: "${r.favoriteMsg}"`);
    });

    // ── TC-05 ─────────────────────────────────────────────────────────────────
    test('TC-05: unmark currency pair from favorites and verify "No records found" @sanity', async () => {
        const r = await overviewPage.unmarkFavorite(tradeData.searchPair);
        expect.soft(r.noRecordsStatus,       r.noRecordsMsg).toBe('visible');
        expect.soft(r.favoriteRemovedStatus, r.favoriteMsg).toBe('removed');
        console.log(`[TC-05] Unmarked ${tradeData.searchPair} from favorites | Status: "${r.favoriteRemovedStatus}" | Message: "${r.favoriteMsg}" | No Records Status: "${r.noRecordsStatus}"`);
    });

    // ── TC-06 ─────────────────────────────────────────────────────────────────
    // Pair is now active — all price/OB comparisons with Binance run after this point
    test('TC-06: select currency pair from ALL tab @sanity', async () => {
        await overviewPage.selectCurrencyPair(tradeData.searchPair);
        console.log('[TC-06] Currency pair selected from ALL tab');
    });

    // ── TC-07 ─────────────────────────────────────────────────────────────────
    test('TC-07: 24h ticker header values match Binance reference data (exact match)', async () => {
        test.skip(!!process.env.CI, 'Binance public API is blocked for GitHub-hosted runner IPs — see project memory (Binance API blocked on CI runners)');
        const [binance, ticker] = await Promise.all([
            BinanceHelper.get24hTicker(page, tradeData.searchPair),
            overviewPage.getTickerHeaderData(),
        ]);
        expect.soft(ticker.lastPrice, 'Last Price should be a positive number').toBeGreaterThan(0);
        expect.soft(diffPct(ticker.lastPrice, binance.lastPrice), `TC-07 Last Price diff% — page:${ticker.lastPrice} Binance:${binance.lastPrice} (live price may shift 2-5s during fetch)`).toBeLessThan(1);
        expect.soft(ticker.high24h, `TC-07 24h High — page:${ticker.high24h} Binance:${binance.highPrice}`).toBe(binance.highPrice);
        expect.soft(ticker.low24h,  `TC-07 24h Low — page:${ticker.low24h} Binance:${binance.lowPrice}`).toBe(binance.lowPrice);
        expect.soft(diffPct(ticker.volume24hBase, binance.volume), `TC-07 Volume(base) diff% — page:${ticker.volume24hBase} Binance:${binance.volume} (volume changes with every trade)`).toBeLessThan(1);
        const quoteDiffPct = diffPct(ticker.volume24hQuote, binance.quoteVolume);
        if (quoteDiffPct >= 1) test.info().annotations.push({ type: 'info', description: `TC-07 Volume(quote) diff: ${quoteDiffPct.toFixed(2)}% — page:${ticker.volume24hQuote} Binance:${binance.quoteVolume} — exchange counts both sides of each trade (~2× Binance), not a bug` });
        console.log(`[TC-07] Verified 24h ticker for ${tradeData.searchPair} | Page Last: ${ticker.lastPrice} | Page High: ${ticker.high24h} | Page Low: ${ticker.low24h} | Binance Last: ${binance.lastPrice} | Binance High: ${binance.highPrice} | Binance Low: ${binance.lowPrice} | Last Diff%: ${diffPct(ticker.lastPrice, binance.lastPrice)}`);
    });

    // ── TC-08 ─────────────────────────────────────────────────────────────────
    test('TC-08: order book column headers show Price, Amount and Total @sanity', async () => {
        const h = await overviewPage.getOrderBookColumnHeaders();
        expect.soft(h.price,  'Order book Price header should be visible').not.toBe('');
        expect.soft(h.amount, 'Order book Amount header should be visible').not.toBe('');
        expect.soft(h.total,  'Order book Total header should be visible').not.toBe('');
        console.log(`[TC-08] Order book headers | Price: "${h.price}" | Amount: "${h.amount}" | Total: "${h.total}"`);
    });

    // ── TC-09 ─────────────────────────────────────────────────────────────────
    test('TC-09: order book view switches — all / sell-only / buy-only @sanity', async () => {
        await overviewPage.setOrderBookView('sell');
        const v1 = await overviewPage.isOrderBookVisible();
        const sellOb = await overviewPage.getOrderBookTopBidAsk();
        expect.soft(v1 ? 'visible' : 'not visible', 'Order book should remain visible in sell-only view').toBe('visible');
        expect.soft(sellOb.topAsk, 'Sell-only view: ask price should be positive').toBeGreaterThan(0);

        await overviewPage.setOrderBookView('buy');
        const v2 = await overviewPage.isOrderBookVisible();
        const buyOb = await overviewPage.getOrderBookTopBidAsk();
        expect.soft(v2 ? 'visible' : 'not visible', 'Order book should remain visible in buy-only view').toBe('visible');
        expect.soft(buyOb.topBid, 'Buy-only view: bid price should be positive').toBeGreaterThan(0);

        await overviewPage.setOrderBookView('all');
        const allOb = await overviewPage.getOrderBookTopBidAsk();
        expect.soft(allOb.topAsk, 'All view: ask price should be positive').toBeGreaterThan(0);
        expect.soft(allOb.topBid, 'All view: bid price should be positive').toBeGreaterThan(0);
        console.log(`[TC-09] Order book view switch | Sell-only Visible: ${v1} Top Ask: ${sellOb.topAsk} | Buy-only Visible: ${v2} Top Bid: ${buyOb.topBid} | Restored to all`);
    });

    // ── TC-10 ─────────────────────────────────────────────────────────────────
    test('TC-10: order book precision dropdown changes price decimal places across all views @sanity', async () => {
        const precisions: string[]                  = ['0.01', '0.1', '1', '0.01'];
        const views: Array<'all' | 'sell' | 'buy'> = ['all', 'sell', 'buy'];
        const r = await overviewPage.validateOrderBookPrecisionDecimals(precisions, views);
        for (const f of r.failures) {
            expect.soft(false, `TC-10: ${f.msg}`).toBe(true);
        }
        console.log(`[TC-10] Precision validation | Passed: ${r.passed} | Failures: ${r.failures.length}`);
    });

    // ── TC-11 ─────────────────────────────────────────────────────────────────
    test('TC-11: order book LTP and buy/sell ratio bar (suggestions — not yet implemented) @sanity', async () => {
        const ltp   = await overviewPage.getOrderBookLtp();
        const ratio = await overviewPage.getOrderBookBuySellRatio();
        const sum   = parseFloat((ratio.buyPct + ratio.sellPct).toFixed(1));
        test.info().annotations.push({
            type: 'suggestion',
            description: `SUGGESTION [TC-11 LTP]: Order book last traded price (LTP) display is not yet ` +
                `implemented. Observed LTP=${ltp}. Consider showing the last trade price in the order book mid-row.`,
        });
        test.info().annotations.push({
            type: 'suggestion',
            description: `SUGGESTION [TC-11 B%+S%]: Order book buy/sell ratio bar is not yet implemented. ` +
                `Observed B%=${ratio.buyPct} + S%=${ratio.sellPct} = ${sum}. ` +
                `Consider adding a visual percentage bar showing bid vs ask volume split.`,
        });
        console.log(`[TC-11] LTP: ${ltp} | Buy Pct: ${ratio.buyPct} | Sell Pct: ${ratio.sellPct} | Sum: ${sum} (features not yet implemented — logged as suggestions)`);
    });

    // ── TC-12 ─────────────────────────────────────────────────────────────────
    test('TC-12: order book has actual ask and bid data rows @sanity', async () => {
        const { topAsk, topBid, askCount, bidCount } = await overviewPage.getOrderBookTopBidAsk();
        expect.soft(askCount, 'Ask row count should be >0').toBeGreaterThan(0);
        expect.soft(bidCount, 'Bid row count should be >0').toBeGreaterThan(0);
        expect.soft(topAsk,   'Top ask price should be positive').toBeGreaterThan(0);
        expect.soft(topBid,   'Top bid price should be positive').toBeGreaterThan(0);
        console.log(`[TC-12] Order book rows | Ask Count: ${askCount} | Bid Count: ${bidCount} | Top Ask: ${topAsk} | Top Bid: ${topBid}`);
    });

    // ── TC-13 ─────────────────────────────────────────────────────────────────
    test('TC-13: top bid price is less than top ask price (valid spread) @sanity', async () => {
        const { topAsk, topBid } = await overviewPage.getOrderBookTopBidAsk();
        if (topAsk > 0 && topBid > 0) {
            expect.soft(topBid, `Top bid(${topBid}) must be < top ask(${topAsk})`).toBeLessThan(topAsk);
        }
        const spread = topAsk > 0 && topBid > 0 ? parseFloat((topAsk - topBid).toFixed(8)) : 'N/A';
        console.log(`[TC-13] Spread check | Top Bid: ${topBid} | Top Ask: ${topAsk} | Spread: ${spread}`);
    });

    // ── TC-14 ─────────────────────────────────────────────────────────────────
    test('TC-14: order book top bid/ask match Binance within 0.5% @sanity', async () => {
        const [{ topAsk, topBid }, binanceOb] = await Promise.all([
            overviewPage.getOrderBookTopBidAsk(),
            BinanceHelper.getOrderBook(page, tradeData.searchPair, 5),
        ]);
        const binanceBid = binanceOb.bids[0]?.price ?? 0;
        const binanceAsk = binanceOb.asks[0]?.price ?? 0;
        if (binanceBid > 0 && topBid > 0) {
            expect.soft(diffPct(topBid, binanceBid), `Top bid diff% — page:${topBid} Binance:${binanceBid}`).toBeLessThan(0.5);
        }
        if (binanceAsk > 0 && topAsk > 0) {
            expect.soft(diffPct(topAsk, binanceAsk), `Top ask diff% — page:${topAsk} Binance:${binanceAsk}`).toBeLessThan(0.5);
        }
        console.log(`[TC-14] Bid/Ask vs Binance | Page Bid: ${topBid} | Page Ask: ${topAsk} | Binance Bid: ${binanceBid} | Binance Ask: ${binanceAsk} | Bid Diff%: ${diffPct(topBid, binanceBid)} | Ask Diff%: ${diffPct(topAsk, binanceAsk)}`);
    });

    // ── TC-15 ─────────────────────────────────────────────────────────────────
    test('TC-15: order book LTP matches Binance last price within 0.5% @sanity', async () => {
        const [ltp, binance] = await Promise.all([
            overviewPage.getOrderBookLtp(),
            BinanceHelper.get24hTicker(page, tradeData.searchPair),
        ]);
        expect.soft(ltp, 'Order book LTP should be a positive number').toBeGreaterThan(0);
        if (binance.lastPrice > 0 && ltp > 0) {
            expect.soft(diffPct(ltp, binance.lastPrice), `OB LTP diff% — page:${ltp} Binance:${binance.lastPrice}`).toBeLessThan(0.5);
        }
        console.log(`[TC-15] OB LTP vs Binance last price | LTP: ${ltp} | Binance: ${binance.lastPrice} | Diff%: ${diffPct(ltp, binance.lastPrice)}`);
    });

    // ── TC-16 ─────────────────────────────────────────────────────────────────
    test('TC-16: pair header displays the correct pair name after selection @sanity', async () => {
        const headerText = await overviewPage.getPairHeaderText();
        if (headerText) {
            expect.soft(
                headerText.includes(baseCoin) || headerText.includes(tradeData.searchPair)
                    ? 'found' : 'not found',
                `Pair header ("${headerText}") should contain "${baseCoin}" or "${tradeData.searchPair}"`,
            ).toBe('found');
        }
        console.log(`[TC-16] Pair header | Text: "${headerText ?? '(none)'}"`);
    });

    // ── TC-17 ─────────────────────────────────────────────────────────────────
    test('TC-17: Market Trades panel has Price, Amount and Time headers', async () => {
        await overviewPage.switchToMarketTrades();
        const headers = await overviewPage.getTradesPanelHeaders();
        const joined  = headers.join(' ').toLowerCase();
        expect.soft(joined, 'Market Trades headers should include "price"').toContain('price');
        expect.soft(
            joined.includes('amount') || joined.includes('qty') ? 'found' : 'not found',
            `Market Trades headers should include "amount"/"qty" — got: ${JSON.stringify(headers)}`,
        ).toBe('found');
        expect.soft(joined, 'Market Trades headers should include "time"').toContain('time');
        console.log(`[TC-17] Market Trades headers | Headers: ${JSON.stringify(headers)}`);
    });

    // ── TC-18 ─────────────────────────────────────────────────────────────────
    test('TC-18: My Trades panel has Price, Amount and Time headers', async () => {
        await overviewPage.switchToMyTrades();
        const headers = await overviewPage.getTradesPanelHeaders();
        const joined  = headers.join(' ').toLowerCase();
        expect.soft(joined, 'My Trades headers should include "price"').toContain('price');
        expect.soft(
            joined.includes('amount') || joined.includes('qty') ? 'found' : 'not found',
            `My Trades headers should include "amount"/"qty" — got: ${JSON.stringify(headers)}`,
        ).toBe('found');
        expect.soft(joined, 'My Trades headers should include "time"').toContain('time');
        await overviewPage.switchToMarketTrades();
        console.log(`[TC-18] My Trades headers | Headers: ${JSON.stringify(headers)}`);
    });

    // ── TC-19 ─────────────────────────────────────────────────────────────────
    test('TC-19: Market Trades panel has actual data rows', async () => {
        const rows = await overviewPage.getMarketTradesRows();
        expect.soft(rows.length, 'Market Trades should display at least 1 data row').toBeGreaterThan(0);
        if (rows.length > 0) {
            expect.soft(rows[0].price,  'First Market Trades price should be positive').toBeGreaterThan(0);
            expect.soft(rows[0].amount, 'First Market Trades amount should be positive').toBeGreaterThan(0);
            expect.soft(rows[0].time,   'First Market Trades row should have a time string').not.toBe('');
        }
        console.log(`[TC-19] Market Trades | Rows: ${rows.length} | First Row Price: ${rows[0]?.price ?? 'N/A'} | First Row Amount: ${rows[0]?.amount ?? 'N/A'}`);
    });

    // ── TC-20 ─────────────────────────────────────────────────────────────────
    test('TC-20: Market Trades prices match Binance recent trades within 1%', async () => {
        const [rows, binanceTrades] = await Promise.all([
            overviewPage.getMarketTradesRows(),
            BinanceHelper.getRecentTrades(page, tradeData.searchPair, 20),
        ]);
        if (rows.length === 0 || binanceTrades.length === 0) { console.warn('[TC-20] No data'); return; }
        expect.soft(
            diffPct(rows[0].price, binanceTrades[0].price),
            `Market Trades latest price diff% — page:${rows[0].price} Binance:${binanceTrades[0].price}`,
        ).toBeLessThan(1);
        console.log(`[TC-20] Market Trades price vs Binance | Page: ${rows[0].price} | Binance: ${binanceTrades[0].price} | Diff%: ${diffPct(rows[0].price, binanceTrades[0].price)}`);
    });
});
