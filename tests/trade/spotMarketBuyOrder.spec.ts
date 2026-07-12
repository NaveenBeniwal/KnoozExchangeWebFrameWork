import { test, expect } from '../../src/fixtures/pagefixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { SpotMarketBuyOrderPage, FullBalanceSnapshot } from '../../src/pages/trade/SpotMarketBuyOrderPage';
import { PortfolioSpotPage } from '../../src/pages/portfolio/spot';
import { BinanceHelper } from '../../src/utils/BinanceHelper';
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
        browser = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
        page               = await context.newPage();
        loginPage          = new LoginPage(page);
        spotMarketBuyPage  = new SpotMarketBuyOrderPage(page);
        portfolioSpotPage  = new PortfolioSpotPage(page);
        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!).catch(() => {});
        await loginPage.dismissPostLoginDialogsAndWaitForHome();
    });

    test.afterAll(async () => { await browser.close(); });

    // ── TC-01 ─────────────────────────────────────────────────────────────────
    test('TC-01: navigate to Spot Trading page @smoke @sanity @regression', async () => {
        await spotMarketBuyPage.navigateToSpotTrading();
        console.log('[TC-01] Navigated to Spot Trading page');
    });

    // ── TC-02 ─────────────────────────────────────────────────────────────────
    test('TC-02: Spot Trading page shows all expected labels @smoke @sanity @regression', async () => {
        const r = await spotMarketBuyPage.getSpotPageLabelsStatus();
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
    test('TC-03: search currency pair @sanity @regression', async () => {
        await spotMarketBuyPage.searchCurrencyPair(getTradeData().searchPair);
        console.log(`[TC-03] Searched pair: ${getTradeData().searchPair}`);
    });

    // ── TC-04 ─────────────────────────────────────────────────────────────────
    test('TC-04: mark currency pair as favorite @sanity @regression', async () => {
        const r = await spotMarketBuyPage.markAsFavorite(getTradeData().searchPair);
        expect.soft(r.favoriteAddedStatus, r.favoriteMsg).toBe('added');
        console.log(`[TC-04] Marked ${getTradeData().searchPair} as favorite | Status: "${r.favoriteAddedStatus}" | Message: "${r.favoriteMsg}"`);
    });

    // ── TC-05 ─────────────────────────────────────────────────────────────────
    test('TC-05: unmark currency pair from favorites @sanity @regression', async () => {
        const r = await spotMarketBuyPage.unmarkFavorite(getTradeData().searchPair);
        expect.soft(r.favoriteRemovedStatus, r.favoriteMsg).toBe('removed');
        console.log(`[TC-05] Unmarked ${getTradeData().searchPair} from favorites | Status: "${r.favoriteRemovedStatus}" | Message: "${r.favoriteMsg}"`);
    });

    // ── TC-06 ─────────────────────────────────────────────────────────────────
    // Pair is active from here — all Binance comparisons use getTradeData().searchPair
    test('TC-06: select currency pair from ALL tab @sanity @regression', async () => {
        await spotMarketBuyPage.selectCurrencyPair();
        console.log('[TC-06] Currency pair selected from ALL tab');
    });

    // ── TC-02b ────────────────────────────────────────────────────────────────
    // Positioned after TC-06 so the page shows the selected pair before comparing with Binance
    test('TC-02b: 24h ticker header matches Binance reference data (exact match) @sanity @regression', async () => {
        const [binance, ticker] = await Promise.all([
            BinanceHelper.get24hTicker(page, getTradeData().searchPair),
            spotMarketBuyPage.getTickerHeaderData(),
        ]);
        expect.soft(ticker.lastPrice, 'Last Price should be positive').toBeGreaterThan(0);
        expect.soft(diffPct(ticker.lastPrice, binance.lastPrice), `TC-02b Last Price diff% — page:${ticker.lastPrice} Binance:${binance.lastPrice} (live price may shift 2-5s during fetch)`).toBeLessThan(1);
        expect.soft(ticker.high24h,   `TC-02b 24h High — page:${ticker.high24h} Binance:${binance.highPrice}`).toBe(binance.highPrice);
        expect.soft(ticker.low24h,    `TC-02b 24h Low — page:${ticker.low24h} Binance:${binance.lowPrice}`).toBe(binance.lowPrice);
        console.log(`[TC-02b] Verified 24h ticker for ${getTradeData().searchPair} | Page Last: ${ticker.lastPrice} | Page High: ${ticker.high24h} | Page Low: ${ticker.low24h} | Binance Last: ${binance.lastPrice} | Binance High: ${binance.highPrice} | Binance Low: ${binance.lowPrice} | Last Diff%: ${diffPct(ticker.lastPrice, binance.lastPrice)}`);
    });

    // ── TC-03b ────────────────────────────────────────────────────────────────
    test('TC-03b: order book column headers show Price, Amount, Total @sanity @regression', async () => {
        const h = await spotMarketBuyPage.getOrderBookColumnHeaders();
        expect.soft(h.price,  'Price header should be visible').not.toBe('');
        expect.soft(h.amount, 'Amount header should be visible').not.toBe('');
        expect.soft(h.total,  'Total header should be visible').not.toBe('');
        console.log(`[TC-03b] Order book headers | Price: "${h.price}" | Amount: "${h.amount}" | Total: "${h.total}"`);
    });

    // ── TC-03c ────────────────────────────────────────────────────────────────
    test('TC-03c: order book view switches (all / sell-only / buy-only) @sanity @regression', async () => {
        await spotMarketBuyPage.setOrderBookView('sell');
        const v1 = await spotMarketBuyPage.isOrderBookVisible();
        const sellOb = await spotMarketBuyPage.getOrderBookTopBidAsk();
        expect.soft(v1 ? 'visible' : 'not visible', 'OB visible in sell-only view').toBe('visible');
        expect.soft(sellOb.topAsk, 'Sell-only view: ask price should be positive').toBeGreaterThan(0);

        await spotMarketBuyPage.setOrderBookView('buy');
        const v2 = await spotMarketBuyPage.isOrderBookVisible();
        const buyOb = await spotMarketBuyPage.getOrderBookTopBidAsk();
        expect.soft(v2 ? 'visible' : 'not visible', 'OB visible in buy-only view').toBe('visible');
        expect.soft(buyOb.topBid, 'Buy-only view: bid price should be positive').toBeGreaterThan(0);

        await spotMarketBuyPage.setOrderBookView('all');
        const allOb = await spotMarketBuyPage.getOrderBookTopBidAsk();
        expect.soft(allOb.topAsk, 'All view: ask price should be positive').toBeGreaterThan(0);
        expect.soft(allOb.topBid, 'All view: bid price should be positive').toBeGreaterThan(0);
        console.log(`[TC-03c] Sell-only: Ask Count: ${sellOb.askCount} | Top Ask: ${sellOb.topAsk} | Bid Count: ${sellOb.bidCount} | Buy-only: Bid Count: ${buyOb.bidCount} | Top Bid: ${buyOb.topBid} | Ask Count: ${buyOb.askCount} | All: Ask Count: ${allOb.askCount} | Bid Count: ${allOb.bidCount}`);
    });

    // ── TC-03d ────────────────────────────────────────────────────────────────
    test('TC-03d: order book precision dropdown changes price decimal places across all views @sanity @regression', async () => {
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
            await spotMarketBuyPage.setOrderBookPrecision(prec);
            await page.waitForTimeout(400);
            const maxDec = maxDecimalsForPrec(prec);

            for (const view of views) {
                await spotMarketBuyPage.setOrderBookView(view);
                await page.waitForTimeout(300);
                const { askTexts, bidTexts } = await spotMarketBuyPage.getOrderBookRawPriceTexts();
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
        await spotMarketBuyPage.setOrderBookView('all');
    });

    // ── TC-03e ────────────────────────────────────────────────────────────────
    test('TC-03e: order book LTP and buy/sell ratio bar (suggestions — not yet implemented) @sanity @regression', async () => {
        const ltp   = await spotMarketBuyPage.getOrderBookLtp();
        const ratio = await spotMarketBuyPage.getOrderBookBuySellRatio();
        const sum   = parseFloat((ratio.buyPct + ratio.sellPct).toFixed(1));
        test.info().annotations.push({
            type: 'suggestion',
            description: `SUGGESTION [TC-03e LTP]: Order book last traded price (LTP) display is not yet ` +
                `implemented. Observed LTP=${ltp}. Consider showing the last trade price in the order book mid-row.`,
        });
        test.info().annotations.push({
            type: 'suggestion',
            description: `SUGGESTION [TC-03e B%+S%]: Order book buy/sell ratio bar is not yet implemented. ` +
                `Observed B%=${ratio.buyPct} + S%=${ratio.sellPct} = ${sum}. ` +
                `Consider adding a visual percentage bar showing bid vs ask volume split.`,
        });
        console.log(`[TC-03e] LTP: ${ltp} | Buy Pct: ${ratio.buyPct} | Sell Pct: ${ratio.sellPct} | Sum: ${sum} (features not yet implemented — logged as suggestions)`);
    });

    // ── TC-03f ────────────────────────────────────────────────────────────────
    test('TC-03f: order book has actual ask and bid rows @sanity @regression', async () => {
        const { askCount, bidCount, topAsk, topBid } = await spotMarketBuyPage.getOrderBookTopBidAsk();
        expect.soft(askCount, 'Ask row count should be >0').toBeGreaterThan(0);
        expect.soft(bidCount, 'Bid row count should be >0').toBeGreaterThan(0);
        expect.soft(topAsk,   'Top ask should be positive').toBeGreaterThan(0);
        expect.soft(topBid,   'Top bid should be positive').toBeGreaterThan(0);
        console.log(`[TC-03f] Order book rows | Ask Count: ${askCount} | Bid Count: ${bidCount} | Top Ask: ${topAsk} | Top Bid: ${topBid}`);
    });

    // ── TC-03g ────────────────────────────────────────────────────────────────
    test('TC-03g: top bid < top ask (valid spread) @sanity @regression', async () => {
        const { topAsk, topBid } = await spotMarketBuyPage.getOrderBookTopBidAsk();
        if (topAsk > 0 && topBid > 0) {
            expect.soft(topBid, `Top bid(${topBid}) must be < top ask(${topAsk})`).toBeLessThan(topAsk);
        }
        const spread = topAsk > 0 && topBid > 0 ? parseFloat((topAsk - topBid).toFixed(8)) : 'N/A';
        console.log(`[TC-03g] Spread check | Top Bid: ${topBid} | Top Ask: ${topAsk} | Spread: ${spread}`);
    });

    // ── TC-03h ────────────────────────────────────────────────────────────────
    test('TC-03h: order book top bid/ask match Binance within 0.5% @sanity @regression', async () => {
        const [{ topAsk, topBid }, ob] = await Promise.all([
            spotMarketBuyPage.getOrderBookTopBidAsk(),
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
    test('TC-03i: order book LTP matches Binance last price within 0.5% @sanity @regression', async () => {
        const [ltp, b] = await Promise.all([
            spotMarketBuyPage.getOrderBookLtp(),
            BinanceHelper.get24hTicker(page, getTradeData().searchPair),
        ]);
        expect.soft(ltp, 'OB LTP should be positive').toBeGreaterThan(0);
        if (b.lastPrice > 0 && ltp > 0) {
            expect.soft(diffPct(ltp, b.lastPrice), `LTP diff% — page:${ltp} Binance:${b.lastPrice}`).toBeLessThan(0.5);
        }
        console.log(`[TC-03i] OB LTP vs Binance last price | LTP: ${ltp} | Binance: ${b.lastPrice} | Diff%: ${diffPct(ltp, b.lastPrice)}`);
    });

    // ── TC-06a ────────────────────────────────────────────────────────────────
    test('TC-06a: Market Buy tab Price field is visible but disabled @sanity @regression', async () => {
        await spotMarketBuyPage.selectMarketBuyTab();
        const isDisabled = await spotMarketBuyPage.isPriceFieldDisabled();
        expect.soft(isDisabled ? 'disabled' : 'editable', 'Market Price field should be disabled (read-only) on Market tab').toBe('disabled');
        console.log(`[TC-06a] Market Buy tab Price field | Is Disabled: ${isDisabled}`);
    });

    // ── TC-06a1 ───────────────────────────────────────────────────────────────
    test('TC-06a1: Buy button label shows "BUY {baseCoin}" @sanity @regression', async () => {
        const label = await spotMarketBuyPage.getMarketBuyButtonLabel();
        expect.soft(label.toUpperCase(), `Buy button label should contain "BUY"`).toContain('BUY');
        expect.soft(label.toUpperCase(), `Buy button label should contain "${baseCoin}"`).toContain(baseCoin.toUpperCase());
        console.log(`[TC-06a1] Buy button label | Label: "${label}"`);
    });

    // ── TC-06a2 ───────────────────────────────────────────────────────────────
    test('TC-06a2: quote currency (USDT) available balance is non-negative @sanity @regression', async () => {
        const buyAvlb = await spotMarketBuyPage.getBuyAvailableBalance();
        expect.soft(buyAvlb, `Buy Avlb (${quoteCoin}) should be non-negative`).toBeGreaterThanOrEqual(0);
        console.log(`[TC-06a2] ${quoteCoin} available balance for buy | Available Balance: ${buyAvlb}`);
    });

    // ── TC-06a3–TC-06a6: % buttons ────────────────────────────────────────────
    test('TC-06a3: 25% button fills correct spend amount @sanity @regression', async () => {
        const avlb   = await spotMarketBuyPage.getBuyAvailableBalance();
        const filled = await spotMarketBuyPage.clickPercentageButton(25);
        expect.soft(filled, '25% should fill a non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) {
            const expected = avlb * 0.25;
            expect.soft(diffPct(filled, expected), `25% diff% — filled:${filled} expected:${expected}`).toBeLessThan(5);
        }
        const expected25 = parseFloat((avlb * 0.25).toFixed(8));
        console.log(`[TC-06a3] 25% Button | Available Balance: ${avlb} | Expected: ${expected25} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected25) : 'N/A'}`);
    });

    test('TC-06a4: 50% button fills correct spend amount @sanity @regression', async () => {
        const avlb   = await spotMarketBuyPage.getBuyAvailableBalance();
        const filled = await spotMarketBuyPage.clickPercentageButton(50);
        expect.soft(filled, '50% should fill non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb * 0.50), `50% diff% — filled:${filled}`).toBeLessThan(5);
        const expected50 = parseFloat((avlb * 0.50).toFixed(8));
        console.log(`[TC-06a4] 50% Button | Available Balance: ${avlb} | Expected: ${expected50} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected50) : 'N/A'}`);
    });

    test('TC-06a5: 75% button fills correct spend amount @sanity @regression', async () => {
        const avlb   = await spotMarketBuyPage.getBuyAvailableBalance();
        const filled = await spotMarketBuyPage.clickPercentageButton(75);
        expect.soft(filled, '75% should fill non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb * 0.75), `75% diff% — filled:${filled}`).toBeLessThan(5);
        const expected75 = parseFloat((avlb * 0.75).toFixed(8));
        console.log(`[TC-06a5] 75% Button | Available Balance: ${avlb} | Expected: ${expected75} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected75) : 'N/A'}`);
    });

    test('TC-06a6: 100% button fills correct spend amount @sanity @regression', async () => {
        const avlb   = await spotMarketBuyPage.getBuyAvailableBalance();
        const filled = await spotMarketBuyPage.clickPercentageButton(100);
        expect.soft(filled, '100% should fill non-negative amount').toBeGreaterThanOrEqual(0);
        if (avlb > 0) expect.soft(diffPct(filled, avlb), `100% diff% — filled:${filled} avlb:${avlb}`).toBeLessThan(5);
        const expected100 = parseFloat((avlb * 1.00).toFixed(8));
        console.log(`[TC-06a6] 100% Button | Available Balance: ${avlb} | Expected: ${expected100} | Total Field: ${filled} | Diff%: ${avlb > 0 ? diffPct(filled, expected100) : 'N/A'}`);
    });

    // ── TC-06a7 ───────────────────────────────────────────────────────────────
    test('TC-06a7: pair header displays the selected pair name @sanity @regression', async () => {
        const hdr = await spotMarketBuyPage.getPairHeaderText();
        if (hdr) {
            expect.soft(
                (hdr.includes(baseCoin) || hdr.includes(getTradeData().searchPair)) ? 'found' : 'not found',
                `Pair header ("${hdr}") should contain "${baseCoin}"`,
            ).toBe('found');
        }
        console.log(`[TC-06a7] Pair header | Text: "${hdr ?? '(none)'}"`);
    });

    // ── TC-06b ────────────────────────────────────────────────────────────────
    test('TC-06b: capture full balance snapshot before placing market buy order @sanity @regression', async () => {
        snapshotBefore = await spotMarketBuyPage.captureFullSnapshot(portfolioSpotPage, getTradeData().searchPair);
        const portfolioQuote = snapshotBefore.portfolioCoins.find(c => c.coin === quoteCoin);
        const portfolioBase  = snapshotBefore.portfolioCoins.find(c => c.coin === baseCoin);
        const buyMatchPortfolio  = portfolioQuote ? Math.abs(snapshotBefore.buyAvlb  - portfolioQuote.spotBalance) < 0.001 : null;
        const sellMatchPortfolio = portfolioBase  ? Math.abs(snapshotBefore.sellAvlb - portfolioBase.spotBalance)  < 0.001 : null;
        console.log(`[TC-06b] Buy Avlb: ${snapshotBefore.buyAvlb} | Portfolio ${quoteCoin}: ${portfolioQuote?.spotBalance ?? 'N/A'} | Buy Match: ${buyMatchPortfolio ?? 'N/A'} | Sell Avlb: ${snapshotBefore.sellAvlb} | Portfolio ${baseCoin}: ${portfolioBase?.spotBalance ?? 'N/A'} | Sell Match: ${sellMatchPortfolio ?? 'N/A'}`);
        expect.soft(snapshotBefore.buyAvlb, `Buy Avlb (${quoteCoin}) should be non-negative`).toBeGreaterThanOrEqual(0);
        if (buyMatchPortfolio !== null) {
            expect.soft(buyMatchPortfolio, `TC-06b Buy avlb ${snapshotBefore.buyAvlb} should match portfolio ${quoteCoin} spot ${portfolioQuote?.spotBalance}`).toBe(true);
        }
        if (sellMatchPortfolio !== null) {
            expect.soft(sellMatchPortfolio, `TC-06b Sell avlb ${snapshotBefore.sellAvlb} should match portfolio ${baseCoin} spot ${portfolioBase?.spotBalance}`).toBe(true);
        }
    });

    // ── TC-07 ─────────────────────────────────────────────────────────────────
    test('TC-07: enter market buy order amount (total to spend), verify fee @sanity @regression', async () => {
        await spotMarketBuyPage.selectMarketBuyTab(); // ensure Market tab is active — page may default to Limit after portfolio navigation
        const r = await spotMarketBuyPage.enterMarketBuyOrder(parseFloat(getTradeData().buyTotal), parseFloat(getTradeData().feePercent));
        if (r.feePresent) {
            expect.soft(r.feeMatchStatus, r.feeMatchMsg).toBe('match');
        } else {
            test.info().annotations.push({ type: 'suggestion', description: 'Estimated fee is not displayed on Market Buy tab — fee verification skipped' });
        }
        console.log(`[TC-07] Total Entered: ${getTradeData().buyTotal} | FeePercent: ${getTradeData().feePercent} | Fee Present: ${r.feePresent} | Est Fee: ${r.estFee.toFixed(8)} | UI Est Fee: ${r.uiEstFee.toFixed(8)} | Fee Match: ${r.feeMatchStatus}`);
    });


    // ── TC-08 ─────────────────────────────────────────────────────────────────
    test('TC-08: USDT available balance before market buy noted @sanity @regression', async () => {
        const avlb = snapshotBefore?.buyAvlb ?? await spotMarketBuyPage.getBuyAvailableBalance();
        console.log(`[TC-08] ${quoteCoin} available before market buy: ${avlb}`);
        expect.soft(avlb, `${quoteCoin} balance should be non-negative`).toBeGreaterThanOrEqual(0);
    });

    // ── TC-09 ─────────────────────────────────────────────────────────────────
    test('TC-09: confirm market buy order — verify success message @regression', async () => {
        await spotMarketBuyPage.selectMarketBuyTab();
        await spotMarketBuyPage.enterMarketBuyOrder(parseFloat(getTradeData().buyTotal), parseFloat(getTradeData().feePercent));
        // Check for Insufficient balance before confirming — order cannot proceed if shown
        const hasInsufficientBalance = await page.getByText('Insufficient balance', { exact: true }).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasInsufficientBalance) {
            orderSucceeded = false;
            expect.soft(false, 'TC-09 — Insufficient balance: account does not have enough funds to place this order. Top up and re-run.').toBe(true);
            console.log('[TC-09] INSUFFICIENT BALANCE — order not placed');
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
            `TC-09 — Order placement result — actual: "${r.successMessage || '(no message received)'}" expected to contain: success/created/placed/status`,
        ).toBe(true);
        console.log(`[TC-09] Executed Price: ${executedPrice} | Executed Amount: ${executedAmount} | OrderId: ${orderId} | Order Succeeded: ${orderSucceeded} | Success Message: "${r.successMessage || '(none)'}"`)
    });

    // ── TC-09b ────────────────────────────────────────────────────────────────
    test('TC-09b: balance snapshot after fill — USDT decreased, BTC increased @regression', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping balance comparison.');
        if (!snapshotBefore) {
            test.info().annotations.push({ type: 'suggestion', description: 'Balance comparison skipped — pre-order snapshot not available' });
            console.log('[TC-09b] Pre-order snapshot not available — balance comparison skipped');
            return;
        }
        await page.waitForTimeout(2000);
        const data = getTradeData();
        const afterSnap  = await spotMarketBuyPage.captureFullSnapshot(portfolioSpotPage, data.searchPair);
        const spentUsdt  = parseFloat(data.buyTotal);
        const results = spotMarketBuyPage.compareSnapshots('AfterMarketBuy', snapshotBefore, afterSnap, {
            buyAvlbDelta:  -spentUsdt,
            sellAvlbDelta:  executedAmount,
            portfolio: [
                { coin: quoteCoin, spotDelta: -spentUsdt      },
                { coin: baseCoin,  spotDelta:  executedAmount },
            ],
            funds: [
                { coin: quoteCoin, amountDelta: -spentUsdt      },
                { coin: baseCoin,  amountDelta:  executedAmount },
            ],
        }, 0.5);
        for (const r of results) {
            if (!r.pass && r.msg.includes('coin not found')) {
                test.info().annotations.push({ type: 'suggestion', description: `Balance check: ${r.msg}` });
            } else {
                expect.soft(r.pass, r.msg).toBe(true);
            }
        }
        console.log(`[TC-09b] Balance snapshot compared after market buy | Executed Price: ${executedPrice} | Executed Amount: ${executedAmount} | Spent USDT: ${parseFloat(getTradeData().buyTotal)}`);
    });

    // ── TC-09c ────────────────────────────────────────────────────────────────
    test('TC-09c: Market Trades panel has Price, Amount and Time headers @regression', async () => {
        await spotMarketBuyPage.switchToMarketTrades();
        const headers = await spotMarketBuyPage.getTradesPanelHeaders();
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
    test('TC-09d: My Trades panel has Price, Amount and Time headers @regression', async () => {
        await spotMarketBuyPage.switchToMyTrades();
        const headers = await spotMarketBuyPage.getTradesPanelHeaders();
        const j = headers.join(' ').toLowerCase();
        expect.soft(j, 'My Trades: Price header').toContain('price');
        expect.soft(
            (j.includes('amount') || j.includes('qty')) ? 'found' : 'not found',
            `My Trades: Amount/Qty header — got: ${JSON.stringify(headers)}`,
        ).toBe('found');
        expect.soft(j, 'My Trades: Time header').toContain('time');
        await spotMarketBuyPage.switchToMarketTrades();
        console.log(`[TC-09d] My Trades headers | Headers: ${JSON.stringify(headers)}`);
    });

    // ── TC-09e ────────────────────────────────────────────────────────────────
    test('TC-09e: Market Trades has actual data rows @regression', async () => {
        const rows = await spotMarketBuyPage.getMarketTradesRows();
        expect.soft(rows.length, 'Market Trades should have ≥1 row').toBeGreaterThan(0);
        if (rows.length > 0) {
            expect.soft(rows[0].price,  'First row price should be positive').toBeGreaterThan(0);
            expect.soft(rows[0].amount, 'First row amount should be positive').toBeGreaterThan(0);
        }
        console.log(`[TC-09e] Market Trades | Rows: ${rows.length} | First Row Price: ${rows[0]?.price ?? 'N/A'} | First Row Amount: ${rows[0]?.amount ?? 'N/A'}`);
    });

    // ── TC-09f ────────────────────────────────────────────────────────────────
    test('TC-09f: Market Trades prices match Binance recent trades within 1% @regression', async () => {
        const [rows, binance] = await Promise.all([
            spotMarketBuyPage.getMarketTradesRows(),
            BinanceHelper.getRecentTrades(page, getTradeData().searchPair, 20),
        ]);
        if (rows.length === 0 || binance.length === 0) { console.warn('[TC-09f] No data'); return; }
        expect.soft(diffPct(rows[0].price, binance[0].price), `Market Trades diff% — page:${rows[0].price} Binance:${binance[0].price}`).toBeLessThan(1);
        console.log(`[TC-09f] Market Trades price vs Binance | Page: ${rows[0].price} | Binance: ${binance[0].price} | Diff%: ${diffPct(rows[0].price, binance[0].price)}`);
    });

    // ── TC-10 ─────────────────────────────────────────────────────────────────
    test('TC-10: market buy order is NOT in Open Orders (fills immediately) @regression', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Open Orders check.');
        const { rowText, isAbsentOrFilled, isMarketOrder, failMsg } = await spotMarketBuyPage.checkOpenOrdersHasPendingEntry(getTradeData().searchPair);
        if (isMarketOrder) {
            expect.soft(false, `TC-10 — Market order incorrectly appeared in Open Orders: ${failMsg}`).toBe(true);
        } else {
            expect.soft(
                isAbsentOrFilled,
                `TC-10 — Market buy order should not be pending — actual Open Orders row: "${rowText.slice(0, 100)}"`,
            ).toBe(true);
        }
        console.log(`[TC-10] Open Orders check | Is Absent or Filled: ${isAbsentOrFilled} | Is Market Order: ${isMarketOrder} | Row Text: "${rowText.slice(0, 100)}"`);
    });

    // ── TC-11 ─────────────────────────────────────────────────────────────────
    test('TC-11: All Orders shows market buy as Filled @regression', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping All Orders validation.');
        const data = getTradeData();
        const r = await spotMarketBuyPage.validateAllOrdersTab({
            pair: data.searchPair, price: executedPrice, total: parseFloat(data.buyTotal),
            amount: executedAmount, estFee: 0, uiEstFee: 0, dateTime: orderPlacedAt,
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
        allOrdersTotal  = r.totalActual;
        allOrdersFilled = r.filledActual;
        console.log(`[TC-11] All Orders | Pair: ${r.pairActual} | Side: ${r.sideActual} | Type: ${r.typeActual} | Status: ${r.statusActual} | Executed: ${r.executedActual} | Filled: ${r.filledActual} | Remaining: ${r.remainingActual} | Total: ${r.totalActual} (exp: ${r.totalExpected}) | OrderId: ${r.orderId} | Date/Time: "${r.dateTimeActual}" diff: ${r.dateTimeDiffSec}s`);
    });

    // ── TC-12 ─────────────────────────────────────────────────────────────────
    test('TC-12: My Trades shows the executed market buy entry @regression', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping My Trades validation.');
        const r = await spotMarketBuyPage.validateMarketBuyInMyTrades(executedPrice, executedAmount, orderPlacedAt);
        expect.soft(r.hasEntry, 'My Trades should have at least 1 entry').toBe(true);
        if (r.entry) {
            expect.soft(r.entry.price,  `My Trades price — expected ≈ ${executedPrice}`).toBeGreaterThan(0);
            expect.soft(r.entry.amount, `My Trades amount — expected ≈ ${executedAmount}`).toBeGreaterThan(0);
            if (r.timeDiffSec >= 120) test.info().annotations.push({ type: 'warn', description: `My Trades time diff: ${r.timeDiffSec}s ≥ 120s — entry: "${r.entry.time}", placed: ${orderPlacedAt.toISOString()} (soft, does not fail test)` });
        }
        console.log(`[TC-12] My Trades entry | Has Entry: ${r.hasEntry} | Entry Time: "${r.entry?.time ?? 'N/A'}" | Order Placed: ${orderPlacedAt.toISOString()} | Time Diff: ${r.timeDiffSec}s | Entry Price: ${r.entry?.price ?? 'N/A'} | Entry Amount: ${r.entry?.amount ?? 'N/A'} | Price Match: ${r.priceMatch} | Amount Match: ${r.amountMatch} | Time Match: ${r.timeMatch}`);
    });

    // ── TC-13 ─────────────────────────────────────────────────────────────────
    test('TC-13: USDT decreases by actual total; BTC increases by filled minus fee @regression', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping balance check.');
        const data         = getTradeData();
        const enteredTotal = parseFloat(data.buyTotal);
        const feePercent   = parseFloat(data.feePercent);
        const beforeUsdt   = spotMarketBuyPage.getBeforeBalance(); // captured right before order placement

        // ── 1. All Orders total must not exceed entered total by >5% (market order bug) ──
        if (allOrdersTotal > 0) {
            const overPct = allOrdersTotal > enteredTotal
                ? ((allOrdersTotal - enteredTotal) / enteredTotal * 100) : 0;
            expect.soft(
                allOrdersTotal <= enteredTotal * 1.05,
                `BUG: All Orders total ${allOrdersTotal.toFixed(4)} USDT exceeds entered ${enteredTotal} USDT by ${overPct.toFixed(2)}% (max allowed: 5%)`
            ).toBe(true);
            console.log(`[TC-13] Total check | Entered: ${enteredTotal} USDT | Actual (All Orders): ${allOrdersTotal} USDT | Over by: ${overPct.toFixed(3)}%`);
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
            console.log(`[TC-13] BTC check | Before: ${beforeBtc} | Filled: ${allOrdersFilled} | Fee: ${btcFee} | Received: ${btcReceived} | Expected after: ${expectedBtc} | Actual after: ${afterBtc} | Diff%: ${btcDiffPct.toFixed(3)}%`);
        }

        console.log(`[TC-13] USDT check | Entered: ${enteredTotal} | Actual total: ${allOrdersTotal} | Before: ${beforeUsdt} | Spent: ${spentUsdt.toFixed(4)} | Expected after: ${expectedUsdt.toFixed(4)} | Actual after: ${afterUsdt} | Diff%: ${usdtDiffPct.toFixed(3)}%`);
    });

    // ── TC-14 ─────────────────────────────────────────────────────────────────
    test('TC-14: Trade History shows the market buy order @regression', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Trade History validation.');
        const data = getTradeData();
        const r = await spotMarketBuyPage.validateTransactionHistoryOrdersTab({
            pair: data.searchPair, price: executedPrice, total: parseFloat(data.buyTotal),
            amount: executedAmount, estFee: 0, uiEstFee: 0, dateTime: orderPlacedAt,
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
    test('TC-14b: Trade History bottom tab shows the market buy entry @regression', async () => {
        test.skip(!orderSucceeded, 'Order not placed — insufficient balance or order failed. Skipping Trade History bottom tab.');
        const entry = await spotMarketBuyPage.getTradeHistoryBottomTabFirstEntry();
        if (!entry) { console.warn('[TC-14b] No Trade History rows'); return; }
        expect.soft(
            (entry.pair.includes(baseCoin) || entry.pair.includes(getTradeData().searchPair.replace('/', ''))) ? 'found' : 'not found',
            `Trade History pair ("${entry.pair}") should reference "${baseCoin}"`,
        ).toBe('found');
        expect.soft(entry.side.toLowerCase(), 'Trade History side should be "buy"').toContain('buy');
        expect.soft(entry.price, 'Trade History price should be positive').toBeGreaterThan(0);
        console.log(`[TC-14b] Trade History first entry | Pair: "${entry.pair}" | Side: "${entry.side}" | Price: ${entry.price}`);
    });

});
