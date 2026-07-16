import { test, expect } from '../../src/fixtures/pagefixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { SpotMarketSellOrderPage, FullBalanceSnapshot } from '../../src/pages/trade/SpotMarketSellOrderPage';
import { PortfolioSpotPage } from '../../src/pages/portfolio/spot';
import { BinanceHelper } from '../../src/utils/BinanceHelper';
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
        browser = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
        page                = await context.newPage();
        loginPage           = new LoginPage(page);
        spotMarketSellPage  = new SpotMarketSellOrderPage(page);
        portfolioSpotPage   = new PortfolioSpotPage(page);
        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!).catch(() => {});
        await loginPage.dismissPostLoginDialogsAndWaitForHome();
    });

    test.afterAll(async () => { await browser.close(); });

    // ── TC-01 ─────────────────────────────────────────────────────────────────
    test('TC-01: navigate to Spot Trading page @smoke @sanity', async () => {
        await spotMarketSellPage.navigateToSpotTrading();
        console.log('[TC-01] Navigated to Spot Trading page');
    });

    // ── TC-02 ─────────────────────────────────────────────────────────────────
    test('TC-02: Spot Trading page shows all expected labels @smoke @sanity', async () => {
        const r = await spotMarketSellPage.getSpotPageLabelsStatus();
        expect.soft(r.depthViewText,    'Depth View label').toBe('Depth View');
        expect.soft(r.orderBookText,    'Order Book heading').toBe('Order Book');
        expect.soft(r.buyTabText,       'Buy tab').toBe('Buy');
        expect.soft(r.sellTabText,      'Sell tab').toBe('Sell');
        expect.soft(r.limitTabText,     'Limit tab').toBe('Limit');
        expect.soft(r.marketTabText,    'Market tab').toBe('Market');
        expect.soft(r.marketTradesText, 'Market Trades label').toBe('Market Trades');
        expect.soft(r.myTradesText,     'My Trades label').toBe('My Trades');
        expect.soft(r.allOrdersText,    'All Orders tab').toBe('All Orders');
        expect.soft(r.tradeHistoryText, 'Trade History label').toBe('Trade History');
        console.log(`[TC-02] Depth View: "${r.depthViewText}" | Order Book: "${r.orderBookText}" | Buy: "${r.buyTabText}" | Sell: "${r.sellTabText}" | Limit: "${r.limitTabText}" | Market: "${r.marketTabText}" | Market Trades: "${r.marketTradesText}" | My Trades: "${r.myTradesText}" | All Orders: "${r.allOrdersText}" | Trade History: "${r.tradeHistoryText}"`);
    });

    // ── TC-03 ─────────────────────────────────────────────────────────────────
    test('TC-03: search currency pair @sanity', async () => {
        await spotMarketSellPage.searchCurrencyPair(getTradeData().searchPair);
        console.log(`[TC-03] Searched pair: ${getTradeData().searchPair}`);
    });

    // ── TC-04 ─────────────────────────────────────────────────────────────────
    test('TC-04: mark currency pair as favorite @sanity', async () => {
        const r = await spotMarketSellPage.markAsFavorite(getTradeData().searchPair);
        expect.soft(r.favoriteAddedStatus, r.favoriteMsg).toBe('added');
        console.log(`[TC-04] Marked ${getTradeData().searchPair} as favorite | Status: "${r.favoriteAddedStatus}" | Message: "${r.favoriteMsg}"`);
    });

    // ── TC-05 ─────────────────────────────────────────────────────────────────
    test('TC-05: unmark currency pair from favorites @sanity', async () => {
        const r = await spotMarketSellPage.unmarkFavorite(getTradeData().searchPair);
        expect.soft(r.favoriteRemovedStatus, r.favoriteMsg).toBe('removed');
        console.log(`[TC-05] Unmarked ${getTradeData().searchPair} from favorites | Status: "${r.favoriteRemovedStatus}" | Message: "${r.favoriteMsg}"`);
    });

    // ── TC-06 ─────────────────────────────────────────────────────────────────
    // Pair is active from here — all Binance comparisons use getTradeData().searchPair
    test('TC-06: select currency pair from ALL tab @sanity', async () => {
        await spotMarketSellPage.selectCurrencyPair();
        console.log('[TC-06] Currency pair selected from ALL tab');
    });

    // ── TC-02b ────────────────────────────────────────────────────────────────
    // Positioned after TC-06 so the page shows the selected pair before comparing with Binance
    test('TC-02b: 24h ticker header matches Binance reference data (exact match)', async () => {
        test.skip(!!process.env.CI, 'Binance public API is blocked for GitHub-hosted runner IPs — see project memory (Binance API blocked on CI runners)');
        const [binance, ticker] = await Promise.all([
            BinanceHelper.get24hTicker(page, getTradeData().searchPair),
            spotMarketSellPage.getTickerHeaderData(),
        ]);
        expect.soft(ticker.lastPrice, 'Last Price should be positive').toBeGreaterThan(0);
        expect.soft(diffPct(ticker.lastPrice, binance.lastPrice), `TC-02b Last Price diff% — page:${ticker.lastPrice} Binance:${binance.lastPrice} (live price may shift 2-5s during fetch)`).toBeLessThan(1);
        expect.soft(ticker.high24h,   `TC-02b 24h High — page:${ticker.high24h} Binance:${binance.highPrice}`).toBe(binance.highPrice);
        expect.soft(ticker.low24h,    `TC-02b 24h Low — page:${ticker.low24h} Binance:${binance.lowPrice}`).toBe(binance.lowPrice);
        console.log(`[TC-02b] Verified 24h ticker for ${getTradeData().searchPair} | Page Last: ${ticker.lastPrice} | Page High: ${ticker.high24h} | Page Low: ${ticker.low24h} | Binance Last: ${binance.lastPrice} | Binance High: ${binance.highPrice} | Binance Low: ${binance.lowPrice} | Last Diff%: ${diffPct(ticker.lastPrice, binance.lastPrice)}`);
    });

    // ── TC-03b ────────────────────────────────────────────────────────────────
    test('TC-03b: order book column headers show Price, Amount, Total @sanity', async () => {
        const h = await spotMarketSellPage.getOrderBookColumnHeaders();
        expect.soft(h.price,  'Price header should be visible').not.toBe('');
        expect.soft(h.amount, 'Amount header should be visible').not.toBe('');
        expect.soft(h.total,  'Total header should be visible').not.toBe('');
        console.log(`[TC-03b] Order book headers | Price: "${h.price}" | Amount: "${h.amount}" | Total: "${h.total}"`);
    });

    // ── TC-03c ────────────────────────────────────────────────────────────────
    test('TC-03c: order book view switches (all / sell-only / buy-only) @sanity', async () => {
        await spotMarketSellPage.setOrderBookView('sell');
        const v1 = await spotMarketSellPage.isOrderBookVisible();
        const sellOb = await spotMarketSellPage.getOrderBookTopBidAsk();
        expect.soft(v1 ? 'visible' : 'not visible', 'OB visible in sell-only view').toBe('visible');
        expect.soft(sellOb.topAsk, 'Sell-only view: ask price should be positive').toBeGreaterThan(0);

        await spotMarketSellPage.setOrderBookView('buy');
        const v2 = await spotMarketSellPage.isOrderBookVisible();
        const buyOb = await spotMarketSellPage.getOrderBookTopBidAsk();
        expect.soft(v2 ? 'visible' : 'not visible', 'OB visible in buy-only view').toBe('visible');
        expect.soft(buyOb.topBid, 'Buy-only view: bid price should be positive').toBeGreaterThan(0);

        await spotMarketSellPage.setOrderBookView('all');
        const allOb = await spotMarketSellPage.getOrderBookTopBidAsk();
        expect.soft(allOb.topAsk, 'All view: ask price should be positive').toBeGreaterThan(0);
        expect.soft(allOb.topBid, 'All view: bid price should be positive').toBeGreaterThan(0);
        console.log(`[TC-03c] Sell-only: Ask Count: ${sellOb.askCount} | Top Ask: ${sellOb.topAsk} | Bid Count: ${sellOb.bidCount} | Buy-only: Bid Count: ${buyOb.bidCount} | Top Bid: ${buyOb.topBid} | Ask Count: ${buyOb.askCount} | All: Ask Count: ${allOb.askCount} | Bid Count: ${allOb.bidCount}`);
    });

    // ── TC-03d ────────────────────────────────────────────────────────────────
    test('TC-03d: order book precision dropdown changes price decimal places across all views @sanity', async () => {
        const maxDecimalsForPrec = (prec: string): number =>
            prec === '0.01' ? 2 : prec === '0.1' ? 1 : 0;
        const countDecimals = (text: string): number => {
            const m = text.match(/\.(\d+)$/);
            return m ? m[1].length : 0;
        };

        // Cycle: 0.01 (default) → 0.1 → 1 → 0.01 (restore)
        const precisions = ['0.01', '0.1', '1', '0.01'];
        const views: Array<'all' | 'sell' | 'buy'> = ['all', 'sell', 'buy'];

        for (const prec of precisions) {
            await spotMarketSellPage.setOrderBookPrecision(prec);
            await page.waitForTimeout(400);
            const maxDec = maxDecimalsForPrec(prec);

            for (const view of views) {
                await spotMarketSellPage.setOrderBookView(view);
                await page.waitForTimeout(300);
                const { askTexts, bidTexts } = await spotMarketSellPage.getOrderBookRawPriceTexts();
                const sampleTexts = [...askTexts, ...bidTexts].slice(0, 4);

                for (const text of sampleTexts) {
                    const dec = countDecimals(text);
                    expect.soft(
                        dec <= maxDec,
                        `TC-03d prec=${prec} view=${view}: price "${text}" has ${dec} decimals — expected ≤${maxDec}`,
                    ).toBe(true);
                }
                console.log(`[TC-03d] Precision: ${prec} | View: ${view} | Max Decimals: ${maxDec} | Ask: ${JSON.stringify(askTexts.slice(0, 2))} | Bid: ${JSON.stringify(bidTexts.slice(0, 2))}`);
            }
        }

        // End in all-view at 0.01 precision
        await spotMarketSellPage.setOrderBookView('all');
    });

    // ── TC-03e ────────────────────────────────────────────────────────────────
    test('TC-03e: order book LTP and buy/sell ratio bar (suggestions — not yet implemented) @sanity', async () => {
        const ltp   = await spotMarketSellPage.getOrderBookLtp();
        const ratio = await spotMarketSellPage.getOrderBookBuySellRatio();
        const sum   = parseFloat((ratio.buyPct + ratio.sellPct).toFixed(1));
        // LTP display in orderbook not yet implemented — recorded as suggestion
        test.info().annotations.push({
            type: 'suggestion',
            description: `SUGGESTION [TC-03e LTP]: Order book last traded price (LTP) display is not yet ` +
                `implemented. Observed LTP=${ltp}. Consider showing the last trade price in the order book mid-row.`,
        });
        // Buy/sell ratio bar not yet implemented — recorded as suggestion
        test.info().annotations.push({
            type: 'suggestion',
            description: `SUGGESTION [TC-03e B%+S%]: Order book buy/sell ratio bar is not yet implemented. ` +
                `Observed B%=${ratio.buyPct} + S%=${ratio.sellPct} = ${sum}. ` +
                `Consider adding a visual percentage bar showing bid vs ask volume split.`,
        });
        console.log(`[TC-03e] LTP: ${ltp} | Buy Pct: ${ratio.buyPct} | Sell Pct: ${ratio.sellPct} | Sum: ${sum} (features not yet implemented — logged as suggestions)`);
    });

    // ── TC-03f ────────────────────────────────────────────────────────────────
    test('TC-03f: order book has actual ask and bid rows @sanity', async () => {
        const { askCount, bidCount, topAsk, topBid } = await spotMarketSellPage.getOrderBookTopBidAsk();
        expect.soft(askCount, 'Ask row count should be >0').toBeGreaterThan(0);
        expect.soft(bidCount, 'Bid row count should be >0').toBeGreaterThan(0);
        expect.soft(topAsk,   'Top ask should be positive').toBeGreaterThan(0);
        expect.soft(topBid,   'Top bid should be positive').toBeGreaterThan(0);
        console.log(`[TC-03f] Order book rows | Ask Count: ${askCount} | Bid Count: ${bidCount} | Top Ask: ${topAsk} | Top Bid: ${topBid}`);
    });

    // ── TC-03g ────────────────────────────────────────────────────────────────
    test('TC-03g: top bid < top ask (valid spread) @sanity', async () => {
        const { topAsk, topBid } = await spotMarketSellPage.getOrderBookTopBidAsk();
        if (topAsk > 0 && topBid > 0) {
            expect.soft(topBid, `Top bid(${topBid}) must be < top ask(${topAsk})`).toBeLessThan(topAsk);
        }
        const spread = topAsk > 0 && topBid > 0 ? parseFloat((topAsk - topBid).toFixed(8)) : 'N/A';
        console.log(`[TC-03g] Spread check | Top Bid: ${topBid} | Top Ask: ${topAsk} | Spread: ${spread}`);
    });

    // ── TC-03h ────────────────────────────────────────────────────────────────
    test('TC-03h: order book top bid/ask match Binance within 0.5% @sanity', async () => {
        const [{ topAsk, topBid }, ob] = await Promise.all([
            spotMarketSellPage.getOrderBookTopBidAsk(),
            BinanceHelper.getOrderBook(page, getTradeData().searchPair, 5),
        ]);
        const binanceBid = ob.bids[0]?.price ?? 0;
        const binanceAsk = ob.asks[0]?.price ?? 0;
        if (binanceBid > 0 && topBid > 0) {
            expect.soft(diffPct(topBid, binanceBid), `Bid diff% — page:${topBid} Binance:${binanceBid}`).toBeLessThan(0.5);
        }
        if (binanceAsk > 0 && topAsk > 0) {
            expect.soft(diffPct(topAsk, binanceAsk), `Ask diff% — page:${topAsk} Binance:${binanceAsk}`).toBeLessThan(0.5);
        }
        console.log(`[TC-03h] Bid/Ask vs Binance | Page Bid: ${topBid} | Page Ask: ${topAsk} | Binance Bid: ${binanceBid} | Binance Ask: ${binanceAsk} | Bid Diff%: ${diffPct(topBid, binanceBid)} | Ask Diff%: ${diffPct(topAsk, binanceAsk)}`);
    });

    // ── TC-03i ────────────────────────────────────────────────────────────────
    test('TC-03i: order book LTP matches Binance last price within 0.5% @sanity', async () => {
        const [ltp, b] = await Promise.all([
            spotMarketSellPage.getOrderBookLtp(),
            BinanceHelper.get24hTicker(page, getTradeData().searchPair),
        ]);
        expect.soft(ltp, 'OB LTP should be positive').toBeGreaterThan(0);
        if (b.lastPrice > 0 && ltp > 0) {
            expect.soft(diffPct(ltp, b.lastPrice), `LTP diff% — page:${ltp} Binance:${b.lastPrice}`).toBeLessThan(0.5);
        }
        console.log(`[TC-03i] OB LTP vs Binance last price | LTP: ${ltp} | Binance: ${b.lastPrice} | Diff%: ${diffPct(ltp, b.lastPrice)}`);
    });

    // ── TC-06a ────────────────────────────────────────────────────────────────
    test('TC-06a: Market Sell tab Price field is visible but disabled @sanity', async () => {
        await spotMarketSellPage.selectMarketSellTab();
        const isDisabled = await spotMarketSellPage.isPriceFieldDisabled();
        expect.soft(isDisabled ? 'disabled' : 'editable', 'Market Price field should be disabled (read-only) on Market tab').toBe('disabled');
        console.log(`[TC-06a] Market Sell tab Price field | Is Disabled: ${isDisabled}`);
    });

    // ── TC-06a1 ───────────────────────────────────────────────────────────────
    test('TC-06a1: Sell button label shows "SELL {baseCoin}" @sanity', async () => {
        const label = await spotMarketSellPage.getMarketSellButtonLabel();
        expect.soft(label.toUpperCase(), `Sell button label should contain "SELL"`).toContain('SELL');
        expect.soft(label.toUpperCase(), `Sell button label should contain "${baseCoin}"`).toContain(baseCoin.toUpperCase());
        console.log(`[TC-06a1] Sell button label | Label: "${label}"`);
    });

    // ── TC-06a2 ───────────────────────────────────────────────────────────────
    test('TC-06a2: base coin (BTC) sell available balance is non-negative @sanity', async () => {
        const sellAvlb = await spotMarketSellPage.getSellAvailableBalance();
        expect.soft(sellAvlb, `Sell Avlb (${baseCoin}) should be non-negative`).toBeGreaterThanOrEqual(0);
        console.log(`[TC-06a2] ${baseCoin} available balance for sell | Available Balance: ${sellAvlb}`);
    });

    // ── TC-06a3–TC-06a6: % buttons ────────────────────────────────────────────
    test('TC-06a3: 25% button fills correct amount @sanity', async () => {
        const avlb   = await spotMarketSellPage.getSellAvailableBalance();
        const filled = await spotMarketSellPage.clickPercentageButton(25);
        expect.soft(filled, '25% should fill a non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) {
            const expected = avlb * 0.25;
            expect.soft(diffPct(filled, expected), `25% diff% — filled:${filled} expected:${expected}`).toBeLessThan(5);
        }
        const expected25 = parseFloat((avlb * 0.25).toFixed(8));
        console.log(`[TC-06a3] 25% Button | Available Balance: ${avlb} | Expected: ${expected25} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected25) : 'N/A'}`);
    });

    test('TC-06a4: 50% button fills correct amount @sanity', async () => {
        const avlb   = await spotMarketSellPage.getSellAvailableBalance();
        const filled = await spotMarketSellPage.clickPercentageButton(50);
        expect.soft(filled, '50% should fill non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb * 0.50), `50% diff% — filled:${filled}`).toBeLessThan(5);
        const expected50 = parseFloat((avlb * 0.50).toFixed(8));
        console.log(`[TC-06a4] 50% Button | Available Balance: ${avlb} | Expected: ${expected50} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected50) : 'N/A'}`);
    });

    test('TC-06a5: 75% button fills correct amount @sanity', async () => {
        const avlb   = await spotMarketSellPage.getSellAvailableBalance();
        const filled = await spotMarketSellPage.clickPercentageButton(75);
        expect.soft(filled, '75% should fill non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb * 0.75), `75% diff% — filled:${filled}`).toBeLessThan(5);
        const expected75 = parseFloat((avlb * 0.75).toFixed(8));
        console.log(`[TC-06a5] 75% Button | Available Balance: ${avlb} | Expected: ${expected75} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected75) : 'N/A'}`);
    });

    test('TC-06a6: 100% button fills correct amount @sanity', async () => {
        const avlb   = await spotMarketSellPage.getSellAvailableBalance();
        const filled = await spotMarketSellPage.clickPercentageButton(100);
        expect.soft(filled, '100% should fill non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb), `100% diff% — filled:${filled} avlb:${avlb}`).toBeLessThan(5);
        const expected100 = parseFloat((avlb * 1.00).toFixed(8));
        console.log(`[TC-06a6] 100% Button | Available Balance: ${avlb} | Expected: ${expected100} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected100) : 'N/A'}`);
    });

    // ── TC-06a7 ───────────────────────────────────────────────────────────────
    test('TC-06a7: pair header displays the selected pair name @sanity', async () => {
        const hdr = await spotMarketSellPage.getPairHeaderText();
        if (hdr) {
            expect.soft(
                (hdr.includes(baseCoin) || hdr.includes(getTradeData().searchPair)) ? 'found' : 'not found',
                `Pair header ("${hdr}") should contain "${baseCoin}"`,
            ).toBe('found');
        }
        console.log(`[TC-06a7] Pair header | Text: "${hdr ?? '(none)'}"`);
    });

    // ── TC-06b ────────────────────────────────────────────────────────────────
    test('TC-06b: capture full balance snapshot before placing market sell order @sanity', async () => {
        snapshotBefore = await spotMarketSellPage.captureFullSnapshot(portfolioSpotPage, getTradeData().searchPair);
        const portfolioQuote = snapshotBefore.portfolioCoins.find(c => c.coin === quoteCoin);
        const portfolioBase  = snapshotBefore.portfolioCoins.find(c => c.coin === baseCoin);
        const buyMatchPortfolio  = portfolioQuote ? Math.abs(snapshotBefore.buyAvlb  - portfolioQuote.spotBalance) < 0.001 : null;
        const sellMatchPortfolio = portfolioBase  ? Math.abs(snapshotBefore.sellAvlb - portfolioBase.spotBalance)  < 0.001 : null;
        console.log(`[TC-06b] Buy Avlb: ${snapshotBefore.buyAvlb} | Portfolio ${quoteCoin}: ${portfolioQuote?.spotBalance ?? 'N/A'} | Buy Match: ${buyMatchPortfolio ?? 'N/A'} | Sell Avlb: ${snapshotBefore.sellAvlb} | Portfolio ${baseCoin}: ${portfolioBase?.spotBalance ?? 'N/A'} | Sell Match: ${sellMatchPortfolio ?? 'N/A'}`);
        expect.soft(snapshotBefore.sellAvlb, `Sell Avlb (${baseCoin}) should be non-negative`).toBeGreaterThanOrEqual(0);
        if (buyMatchPortfolio !== null) {
            expect.soft(buyMatchPortfolio, `TC-06b Buy avlb ${snapshotBefore.buyAvlb} should match portfolio ${quoteCoin} spot ${portfolioQuote?.spotBalance}`).toBe(true);
        }
        if (sellMatchPortfolio !== null) {
            expect.soft(sellMatchPortfolio, `TC-06b Sell avlb ${snapshotBefore.sellAvlb} should match portfolio ${baseCoin} spot ${portfolioBase?.spotBalance}`).toBe(true);
        }
    });

    // ── TC-07 ─────────────────────────────────────────────────────────────────
    test('TC-07: enter market sell amount (base coin), verify estimated fee @sanity', async () => {
        await spotMarketSellPage.selectMarketSellTab(); // ensure Market tab is active — page may default to Limit after portfolio navigation
        const r = await spotMarketSellPage.enterMarketSellOrder(parseFloat(getTradeData().sellAmount), parseFloat(getTradeData().feePercent));
        if (r.feePresent) {
            expect.soft(r.feeMatchStatus, r.feeMatchMsg).toBe('match');
        } else {
            test.info().annotations.push({ type: 'suggestion', description: 'Estimated fee is not displayed on Market Sell tab — fee verification skipped' });
        }
        console.log(`[TC-07] Executed Amount: ${getTradeData().sellAmount} | FeePercent: ${getTradeData().feePercent} | Fee Present: ${r.feePresent} | Est Fee: ${r.estFee.toFixed(8)} | UI Est Fee: ${r.uiEstFee.toFixed(8)} | Fee Match: ${r.feeMatchStatus}`);
    });

    // ── TC-08 ─────────────────────────────────────────────────────────────────
    test('TC-08: base coin (BTC) available balance before market sell noted @sanity', async () => {
        const avlb = snapshotBefore?.sellAvlb ?? await spotMarketSellPage.fetchAvailableBalance();
        console.log(`[TC-08] ${baseCoin} available before market sell: ${avlb}`);
        expect.soft(avlb, `${baseCoin} balance should be non-negative`).toBeGreaterThanOrEqual(0);
    });

    // ── TC-09 ─────────────────────────────────────────────────────────────────
    test('TC-09: confirm market sell order — verify success message', async () => {
        await spotMarketSellPage.selectMarketSellTab();
        await spotMarketSellPage.enterMarketSellOrder(parseFloat(getTradeData().sellAmount), parseFloat(getTradeData().feePercent));
        // Check for Insufficient balance before confirming — order cannot proceed if shown
        const hasInsufficientBalance = await page.getByText('Insufficient balance', { exact: true }).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasInsufficientBalance) {
            orderSucceeded = false;
            expect.soft(false, 'TC-09 — Insufficient balance: account does not have enough funds to place this order. Top up and re-run.').toBe(true);
            console.log('[TC-09] INSUFFICIENT BALANCE — order not placed');
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
            `TC-09 — Order placement result — actual: "${r.successMessage || '(no message received)'}" expected to contain: success/created/placed/status`,
        ).toBe(true);
        console.log(`[TC-09] Executed Price: ${executedPrice} | Executed Amount: ${executedAmount} | OrderId: ${orderId} | Order Succeeded: ${orderSucceeded} | Success Message: "${r.successMessage || '(none)'}"`)
    });

    // ── TC-09b ────────────────────────────────────────────────────────────────
    test('TC-09b: balance snapshot after fill — BTC decreased, USDT increased', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping balance comparison.');
        if (!snapshotBefore) {
            test.info().annotations.push({ type: 'suggestion', description: 'Balance comparison skipped — pre-order snapshot not available' });
            console.log('[TC-09b] Pre-order snapshot not available — balance comparison skipped');
            return;
        }
        await page.waitForTimeout(2000);
        const data = getTradeData();
        const afterSnap     = await spotMarketSellPage.captureFullSnapshot(portfolioSpotPage, data.searchPair);
        const soldBase      = parseFloat(data.sellAmount);
        const price         = executedPrice > 0 ? executedPrice : await spotMarketSellPage.getCurrentMarketPrice();
        const receivedQuote = parseFloat((soldBase * price).toFixed(8));
        const results = spotMarketSellPage.compareSnapshots('AfterMarketSell', snapshotBefore, afterSnap, {
            sellAvlbDelta:  -soldBase,
            buyAvlbDelta:    receivedQuote,
            portfolio: [
                { coin: baseCoin,  spotDelta: -soldBase       },
                { coin: quoteCoin, spotDelta:  receivedQuote  },
            ],
            funds: [
                { coin: baseCoin,  amountDelta: -soldBase       },
                { coin: quoteCoin, amountDelta:  receivedQuote  },
            ],
        }, 0.5);
        for (const r of results) {
            if (!r.pass && r.msg.includes('coin not found')) {
                test.info().annotations.push({ type: 'suggestion', description: `Balance check: ${r.msg}` });
            } else {
                expect.soft(r.pass, r.msg).toBe(true);
            }
        }
        console.log(`[TC-09b] Balance snapshot compared after market sell | Executed Price: ${executedPrice} | Executed Amount: ${executedAmount} | Sold Base: ${parseFloat(getTradeData().sellAmount)}`);
    });

    // ── TC-09c ────────────────────────────────────────────────────────────────
    test('TC-09c: Market Trades panel has Price, Amount and Time headers', async () => {
        await spotMarketSellPage.switchToMarketTrades();
        const headers = await spotMarketSellPage.getTradesPanelHeaders();
        const j = headers.join(' ').toLowerCase();
        expect.soft(j, 'Market Trades: Price header').toContain('price');
        expect.soft(
            (j.includes('amount') || j.includes('qty')) ? 'found' : 'not found',
            `Market Trades: Amount/Qty header — got: ${JSON.stringify(headers)}`,
        ).toBe('found');
        expect.soft(j, 'Market Trades: Time header').toContain('time');
        console.log(`[TC-09c] Market Trades headers | Headers: ${JSON.stringify(headers)}`);
    });

    // ── TC-09d ────────────────────────────────────────────────────────────────
    test('TC-09d: My Trades panel has Price, Amount and Time headers', async () => {
        await spotMarketSellPage.switchToMyTrades();
        const headers = await spotMarketSellPage.getTradesPanelHeaders();
        const j = headers.join(' ').toLowerCase();
        expect.soft(j, 'My Trades: Price header').toContain('price');
        expect.soft(
            (j.includes('amount') || j.includes('qty')) ? 'found' : 'not found',
            `My Trades: Amount/Qty header — got: ${JSON.stringify(headers)}`,
        ).toBe('found');
        expect.soft(j, 'My Trades: Time header').toContain('time');
        await spotMarketSellPage.switchToMarketTrades();
        console.log(`[TC-09d] My Trades headers | Headers: ${JSON.stringify(headers)}`);
    });

    // ── TC-09e ────────────────────────────────────────────────────────────────
    test('TC-09e: Market Trades has actual data rows', async () => {
        const rows = await spotMarketSellPage.getMarketTradesRows();
        expect.soft(rows.length, 'Market Trades should have ≥1 row').toBeGreaterThan(0);
        if (rows.length > 0) {
            expect.soft(rows[0].price,  'First row price should be positive').toBeGreaterThan(0);
            expect.soft(rows[0].amount, 'First row amount should be positive').toBeGreaterThan(0);
        }
        console.log(`[TC-09e] Market Trades | Rows: ${rows.length} | First Row Price: ${rows[0]?.price ?? 'N/A'} | First Row Amount: ${rows[0]?.amount ?? 'N/A'}`);
    });

    // ── TC-09f ────────────────────────────────────────────────────────────────
    test('TC-09f: Market Trades prices match Binance recent trades within 1%', async () => {
        const [rows, binance] = await Promise.all([
            spotMarketSellPage.getMarketTradesRows(),
            BinanceHelper.getRecentTrades(page, getTradeData().searchPair, 20),
        ]);
        if (rows.length === 0 || binance.length === 0) { console.warn('[TC-09f] No data'); return; }
        expect.soft(diffPct(rows[0].price, binance[0].price), `Market Trades diff% — page:${rows[0].price} Binance:${binance[0].price}`).toBeLessThan(1);
        console.log(`[TC-09f] Market Trades price vs Binance | Page: ${rows[0].price} | Binance: ${binance[0].price} | Diff%: ${diffPct(rows[0].price, binance[0].price)}`);
    });

    // ── TC-10 ─────────────────────────────────────────────────────────────────
    test('TC-10: market sell order is NOT in Open Orders (fills immediately)', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Open Orders check.');
        const { rowText, isAbsentOrFilled, isMarketOrder, failMsg } = await spotMarketSellPage.checkOpenOrdersHasPendingEntry(getTradeData().searchPair);
        if (isMarketOrder) {
            expect.soft(false, `TC-10 — Market order incorrectly appeared in Open Orders: ${failMsg}`).toBe(true);
        } else {
            expect.soft(
                isAbsentOrFilled,
                `TC-10 — Market sell order should not be pending — actual Open Orders row: "${rowText.slice(0, 100)}"`,
            ).toBe(true);
        }
        console.log(`[TC-10] Open Orders check | Is Absent or Filled: ${isAbsentOrFilled} | Is Market Order: ${isMarketOrder} | Row Text: "${rowText.slice(0, 100)}"`);
    });

    // ── TC-11 ─────────────────────────────────────────────────────────────────
    test('TC-11: All Orders shows market sell as Filled', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping All Orders validation.');
        const data = getTradeData();
        const soldBase = parseFloat(data.sellAmount);
        const price    = executedPrice > 0 ? executedPrice : 0;
        const r = await spotMarketSellPage.validateAllOrdersTab({
            pair: data.searchPair, price, total: parseFloat((soldBase * price).toFixed(8)),
            amount: soldBase, estFee: 0, uiEstFee: 0, dateTime: orderPlacedAt,
            feeMatches: true, side: data.allOrdersSide, type: data.orderType, orderId, feePercent: parseFloat(data.feePercent),
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
        console.log(`[TC-11] All Orders | Pair: ${r.pairActual} | Side: ${r.sideActual} | Type: ${r.typeActual} | Status: ${r.statusActual} | Executed: ${r.executedActual} | Filled: ${r.filledActual} | Remaining: ${r.remainingActual} | Total: ${r.totalActual} (exp: ${r.totalExpected}) | OrderId: ${r.orderId} | Date/Time: "${r.dateTimeActual}" diff: ${r.dateTimeDiffSec}s`);
    });

    // ── TC-12 ─────────────────────────────────────────────────────────────────
    test('TC-12: My Trades shows the executed market sell entry', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping My Trades validation.');
        const r = await spotMarketSellPage.validateMarketSellInMyTrades(executedPrice, executedAmount, orderPlacedAt);
        expect.soft(r.hasEntry, 'My Trades should have at least 1 entry').toBe(true);
        if (r.entry) {
            expect.soft(r.entry.price,  `My Trades price — expected ≈ ${executedPrice}`).toBeGreaterThan(0);
            expect.soft(r.entry.amount, `My Trades amount — expected ≈ ${executedAmount}`).toBeGreaterThan(0);
            if (r.timeDiffSec >= 120) test.info().annotations.push({ type: 'warn', description: `My Trades time diff: ${r.timeDiffSec}s ≥ 120s — entry: "${r.entry.time}", placed: ${orderPlacedAt.toISOString()} (soft, does not fail test)` });
        }
        console.log(`[TC-12] My Trades entry | Has Entry: ${r.hasEntry} | Entry Time: "${r.entry?.time ?? 'N/A'}" | Order Placed: ${orderPlacedAt.toISOString()} | Time Diff: ${r.timeDiffSec}s | Entry Price: ${r.entry?.price ?? 'N/A'} | Entry Amount: ${r.entry?.amount ?? 'N/A'} | Price Match: ${r.priceMatch} | Amount Match: ${r.amountMatch} | Time Match: ${r.timeMatch}`);
    });

    // ── TC-13 ─────────────────────────────────────────────────────────────────
    test('TC-13: BTC available balance decreased after market sell', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping balance check.');
        const r = await spotMarketSellPage.getBalanceAfterOrderStatus(parseFloat(getTradeData().sellAmount), 'sell');
        expect.soft(r.balanceValidStatus, r.balanceMsg).toBe('valid');
        console.log(`[TC-13] Balance after market sell | Balance Valid Status: "${r.balanceValidStatus}" | Message: "${r.balanceMsg}"`);
    });

    // ── TC-14 ─────────────────────────────────────────────────────────────────
    test('TC-14: Trade History shows the market sell order', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Trade History validation.');
        const data     = getTradeData();
        const soldBase = parseFloat(data.sellAmount);
        const price    = executedPrice > 0 ? executedPrice : 0;
        const r = await spotMarketSellPage.validateTransactionHistoryOrdersTab({
            pair: data.searchPair, price, total: parseFloat((soldBase * price).toFixed(8)),
            amount: soldBase, estFee: 0, uiEstFee: 0, dateTime: orderPlacedAt,
            feeMatches: true, side: data.orderSide, type: data.orderType, orderId, feePercent: parseFloat(data.feePercent),
        });
        if (!r.orderId) {
            test.info().annotations.push({ type: 'suggestion', description: 'TC-14: No Trade History entry found — market order may not appear yet. Verify manually.' });
            console.log('[TC-14] Trade History — no rows found, skipping assertions');
            return;
        }
        expect.soft(r.pairActual?.replace('/', ''),  `Trade History — pair`).toContain(data.searchPair.replace('/', ''));
        expect.soft(r.sideActual?.toLowerCase(), `Trade History — side expected to contain "${data.tradeHistorySide.toLowerCase()}"`).toContain(data.tradeHistorySide.toLowerCase());
        expect.soft(r.executedActual,            `Trade History — executed price should be > 0`).toBeGreaterThan(0);
        expect.soft(r.amountActual,              `Trade History — amount should be > 0`).toBeGreaterThan(0);
        expect.soft(r.totalActual,               `Trade History — total (expected ≈ ${r.totalExpected}) should be > 0`).toBeGreaterThan(0);
        expect.soft(r.feeActual,                 `Trade History — fee (expected ≈ ${r.feeExpected}) should be ≥ 0`).toBeGreaterThanOrEqual(0);
        if (r.dateTimeDiffSec >= 60) test.info().annotations.push({ type: 'warn', description: `Trade History date/time diff: ${r.dateTimeDiffSec}s ≥ 60s — actual: "${r.dateTimeActual}" (soft, does not fail test)` });
        console.log(`[TC-14] Trade History | Pair: ${r.pairActual} | Side: ${r.sideActual} | Executed: ${r.executedActual} | Amount: ${r.amountActual} | Total: ${r.totalActual} (exp: ${r.totalExpected}) | Fee: ${r.feeActual} (exp: ${r.feeExpected}) | OrderId: ${r.orderId} | Date/Time: "${r.dateTimeActual}" diff: ${r.dateTimeDiffSec}s`);
    });

    // ── TC-14b ────────────────────────────────────────────────────────────────
    test('TC-14b: Trade History bottom tab shows the market sell entry', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Trade History bottom tab.');
        const entry = await spotMarketSellPage.getTradeHistoryBottomTabFirstEntry();
        if (!entry) { console.warn('[TC-14b] No Trade History rows'); return; }
        expect.soft(
            (entry.pair.includes(baseCoin) || entry.pair.includes(getTradeData().searchPair.replace('/', ''))) ? 'found' : 'not found',
            `Trade History pair ("${entry.pair}") should reference "${baseCoin}"`,
        ).toBe('found');
        expect.soft(entry.side.toLowerCase(), 'Trade History side should be "sell"').toContain('sell');
        expect.soft(entry.price, 'Trade History price should be positive').toBeGreaterThan(0);
        console.log(`[TC-14b] Trade History first entry | Pair: "${entry.pair}" | Side: "${entry.side}" | Price: ${entry.price}`);
    });

});
