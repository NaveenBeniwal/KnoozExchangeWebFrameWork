# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: trade/spotMarketBuyOrder.spec.ts >> Spot Module — Market Buy Order Positive Flow >> TC-02b: 24h ticker header matches Binance reference data (exact match) @sanity
- Location: tests/trade/spotMarketBuyOrder.spec.ts:99:5

# Error details

```
Error: TC-02b 24h High — page:64425 Binance:0

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 64425
```

```
Error: TC-02b 24h Low — page:62101 Binance:0

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 62101
```

# Test source

```ts
  7   | import type { Browser, BrowserContext, Page } from '@playwright/test';
  8   | 
  9   | const getTradeData = () => CsvHelper.readCsv('src/data/spotMarketBuyData.csv')[0];
  10  | const baseCoin  = getTradeData().sellCurrency;
  11  | const quoteCoin = getTradeData().buyCurrency;
  12  | 
  13  | let browser: Browser;
  14  | let context: BrowserContext;
  15  | let page: Page;
  16  | let loginPage: LoginPage;
  17  | let spotMarketBuyPage: SpotMarketBuyOrderPage;
  18  | let portfolioSpotPage: PortfolioSpotPage;
  19  | 
  20  | let executedPrice   = 0;
  21  | let executedAmount  = 0;
  22  | let orderPlacedAt   = new Date();
  23  | let snapshotBefore: FullBalanceSnapshot | null = null;
  24  | let orderSucceeded  = false;
  25  | let orderId         = '';
  26  | let allOrdersTotal  = 0; // actual USDT total from All Orders (btcQty × executedPrice)
  27  | let allOrdersFilled = 0; // actual BTC amount filled from All Orders
  28  | 
  29  | const diffPct = (actual: number, ref: number) =>
  30  |     ref > 0 ? parseFloat((Math.abs(actual - ref) / ref * 100).toFixed(3)) : 0;
  31  | 
  32  | test.describe.serial('Spot Module — Market Buy Order Positive Flow', () => {
  33  | 
  34  |     test.beforeAll(async ({ playwright }, testInfo) => {
  35  |         browser = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
  36  |         context = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
  37  |         page               = await context.newPage();
  38  |         loginPage          = new LoginPage(page);
  39  |         spotMarketBuyPage  = new SpotMarketBuyOrderPage(page);
  40  |         portfolioSpotPage  = new PortfolioSpotPage(page);
  41  |         await loginPage.goToLoginPage();
  42  |         await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!).catch(() => {});
  43  |         await loginPage.dismissPostLoginDialogsAndWaitForHome();
  44  |     });
  45  | 
  46  |     test.afterAll(async () => { await browser.close(); });
  47  | 
  48  |     // ── TC-01 ─────────────────────────────────────────────────────────────────
  49  |     test('TC-01: navigate to Spot Trading page @smoke @sanity', async () => {
  50  |         await spotMarketBuyPage.navigateToSpotTrading();
  51  |         console.log('[TC-01] Navigated to Spot Trading page');
  52  |     });
  53  | 
  54  |     // ── TC-02 ─────────────────────────────────────────────────────────────────
  55  |     test('TC-02: Spot Trading page shows all expected labels @smoke @sanity', async () => {
  56  |         const r = await spotMarketBuyPage.getSpotPageLabelsStatus();
  57  |         expect.soft(r.depthViewText,    'Depth View label').toBe('Depth View');
  58  |         expect.soft(r.orderBookText,    'Order Book heading').toBe('Order Book');
  59  |         expect.soft(r.buyTabText,       'Buy tab').toBe('Buy');
  60  |         expect.soft(r.sellTabText,      'Sell tab').toBe('Sell');
  61  |         expect.soft(r.limitTabText,     'Limit tab').toBe('Limit');
  62  |         expect.soft(r.marketTabText,    'Market tab').toBe('Market');
  63  |         expect.soft(r.marketTradesText, 'Market Trades label').toBe('Market Trades');
  64  |         expect.soft(r.myTradesText,     'My Trades label').toBe('My Trades');
  65  |         expect.soft(r.allOrdersText,    'All Orders tab').toBe('All Orders');
  66  |         expect.soft(r.tradeHistoryText, 'Trade History label').toBe('Trade History');
  67  |         console.log(`[TC-02] Depth View: "${r.depthViewText}" | Order Book: "${r.orderBookText}" | Buy: "${r.buyTabText}" | Sell: "${r.sellTabText}" | Limit: "${r.limitTabText}" | Market: "${r.marketTabText}" | Market Trades: "${r.marketTradesText}" | My Trades: "${r.myTradesText}" | All Orders: "${r.allOrdersText}" | Trade History: "${r.tradeHistoryText}"`);
  68  |     });
  69  | 
  70  |     // ── TC-03 ─────────────────────────────────────────────────────────────────
  71  |     test('TC-03: search currency pair @sanity', async () => {
  72  |         await spotMarketBuyPage.searchCurrencyPair(getTradeData().searchPair);
  73  |         console.log(`[TC-03] Searched pair: ${getTradeData().searchPair}`);
  74  |     });
  75  | 
  76  |     // ── TC-04 ─────────────────────────────────────────────────────────────────
  77  |     test('TC-04: mark currency pair as favorite @sanity', async () => {
  78  |         const r = await spotMarketBuyPage.markAsFavorite(getTradeData().searchPair);
  79  |         expect.soft(r.favoriteAddedStatus, r.favoriteMsg).toBe('added');
  80  |         console.log(`[TC-04] Marked ${getTradeData().searchPair} as favorite | Status: "${r.favoriteAddedStatus}" | Message: "${r.favoriteMsg}"`);
  81  |     });
  82  | 
  83  |     // ── TC-05 ─────────────────────────────────────────────────────────────────
  84  |     test('TC-05: unmark currency pair from favorites @sanity', async () => {
  85  |         const r = await spotMarketBuyPage.unmarkFavorite(getTradeData().searchPair);
  86  |         expect.soft(r.favoriteRemovedStatus, r.favoriteMsg).toBe('removed');
  87  |         console.log(`[TC-05] Unmarked ${getTradeData().searchPair} from favorites | Status: "${r.favoriteRemovedStatus}" | Message: "${r.favoriteMsg}"`);
  88  |     });
  89  | 
  90  |     // ── TC-06 ─────────────────────────────────────────────────────────────────
  91  |     // Pair is active from here — all Binance comparisons use getTradeData().searchPair
  92  |     test('TC-06: select currency pair from ALL tab @sanity', async () => {
  93  |         await spotMarketBuyPage.selectCurrencyPair();
  94  |         console.log('[TC-06] Currency pair selected from ALL tab');
  95  |     });
  96  | 
  97  |     // ── TC-02b ────────────────────────────────────────────────────────────────
  98  |     // Positioned after TC-06 so the page shows the selected pair before comparing with Binance
  99  |     test('TC-02b: 24h ticker header matches Binance reference data (exact match) @sanity', async () => {
  100 |         const [binance, ticker] = await Promise.all([
  101 |             BinanceHelper.get24hTicker(page, getTradeData().searchPair),
  102 |             spotMarketBuyPage.getTickerHeaderData(),
  103 |         ]);
  104 |         expect.soft(ticker.lastPrice, 'Last Price should be positive').toBeGreaterThan(0);
  105 |         expect.soft(diffPct(ticker.lastPrice, binance.lastPrice), `TC-02b Last Price diff% — page:${ticker.lastPrice} Binance:${binance.lastPrice} (live price may shift 2-5s during fetch)`).toBeLessThan(1);
  106 |         expect.soft(ticker.high24h,   `TC-02b 24h High — page:${ticker.high24h} Binance:${binance.highPrice}`).toBe(binance.highPrice);
> 107 |         expect.soft(ticker.low24h,    `TC-02b 24h Low — page:${ticker.low24h} Binance:${binance.lowPrice}`).toBe(binance.lowPrice);
      |                                                                                                             ^ Error: TC-02b 24h Low — page:62101 Binance:0
  108 |         console.log(`[TC-02b] Verified 24h ticker for ${getTradeData().searchPair} | Page Last: ${ticker.lastPrice} | Page High: ${ticker.high24h} | Page Low: ${ticker.low24h} | Binance Last: ${binance.lastPrice} | Binance High: ${binance.highPrice} | Binance Low: ${binance.lowPrice} | Last Diff%: ${diffPct(ticker.lastPrice, binance.lastPrice)}`);
  109 |     });
  110 | 
  111 |     // ── TC-03b ────────────────────────────────────────────────────────────────
  112 |     test('TC-03b: order book column headers show Price, Amount, Total @sanity', async () => {
  113 |         const h = await spotMarketBuyPage.getOrderBookColumnHeaders();
  114 |         expect.soft(h.price,  'Price header should be visible').not.toBe('');
  115 |         expect.soft(h.amount, 'Amount header should be visible').not.toBe('');
  116 |         expect.soft(h.total,  'Total header should be visible').not.toBe('');
  117 |         console.log(`[TC-03b] Order book headers | Price: "${h.price}" | Amount: "${h.amount}" | Total: "${h.total}"`);
  118 |     });
  119 | 
  120 |     // ── TC-03c ────────────────────────────────────────────────────────────────
  121 |     test('TC-03c: order book view switches (all / sell-only / buy-only) @sanity', async () => {
  122 |         await spotMarketBuyPage.setOrderBookView('sell');
  123 |         const v1 = await spotMarketBuyPage.isOrderBookVisible();
  124 |         const sellOb = await spotMarketBuyPage.getOrderBookTopBidAsk();
  125 |         expect.soft(v1 ? 'visible' : 'not visible', 'OB visible in sell-only view').toBe('visible');
  126 |         expect.soft(sellOb.topAsk, 'Sell-only view: ask price should be positive').toBeGreaterThan(0);
  127 | 
  128 |         await spotMarketBuyPage.setOrderBookView('buy');
  129 |         const v2 = await spotMarketBuyPage.isOrderBookVisible();
  130 |         const buyOb = await spotMarketBuyPage.getOrderBookTopBidAsk();
  131 |         expect.soft(v2 ? 'visible' : 'not visible', 'OB visible in buy-only view').toBe('visible');
  132 |         expect.soft(buyOb.topBid, 'Buy-only view: bid price should be positive').toBeGreaterThan(0);
  133 | 
  134 |         await spotMarketBuyPage.setOrderBookView('all');
  135 |         const allOb = await spotMarketBuyPage.getOrderBookTopBidAsk();
  136 |         expect.soft(allOb.topAsk, 'All view: ask price should be positive').toBeGreaterThan(0);
  137 |         expect.soft(allOb.topBid, 'All view: bid price should be positive').toBeGreaterThan(0);
  138 |         console.log(`[TC-03c] Sell-only: Ask Count: ${sellOb.askCount} | Top Ask: ${sellOb.topAsk} | Bid Count: ${sellOb.bidCount} | Buy-only: Bid Count: ${buyOb.bidCount} | Top Bid: ${buyOb.topBid} | Ask Count: ${buyOb.askCount} | All: Ask Count: ${allOb.askCount} | Bid Count: ${allOb.bidCount}`);
  139 |     });
  140 | 
  141 |     // ── TC-03d ────────────────────────────────────────────────────────────────
  142 |     test('TC-03d: order book precision dropdown changes price decimal places across all views @sanity', async () => {
  143 |         const maxDecimalsForPrec = (prec: string): number =>
  144 |             prec === '0.01' ? 2 : prec === '0.1' ? 1 : 0;
  145 |         const countDecimals = (text: string): number => {
  146 |             const m = text.match(/\.(\d+)$/);
  147 |             return m ? m[1].length : 0;
  148 |         };
  149 | 
  150 |         // Cycle: 0.01 (default) → 0.1 → 1 → 0.01 (restore)
  151 |         const precisions = ['0.01', '0.1', '1', '0.01'];
  152 |         const views: Array<'all' | 'sell' | 'buy'> = ['all', 'sell', 'buy'];
  153 | 
  154 |         for (const prec of precisions) {
  155 |             await spotMarketBuyPage.setOrderBookPrecision(prec);
  156 |             await page.waitForTimeout(400);
  157 |             const maxDec = maxDecimalsForPrec(prec);
  158 | 
  159 |             for (const view of views) {
  160 |                 await spotMarketBuyPage.setOrderBookView(view);
  161 |                 await page.waitForTimeout(300);
  162 |                 const { askTexts, bidTexts } = await spotMarketBuyPage.getOrderBookRawPriceTexts();
  163 |                 const sampleTexts = [...askTexts, ...bidTexts].slice(0, 4);
  164 | 
  165 |                 for (const text of sampleTexts) {
  166 |                     const dec = countDecimals(text);
  167 |                     expect.soft(
  168 |                         dec <= maxDec,
  169 |                         `TC-03d prec=${prec} view=${view}: price "${text}" has ${dec} decimals — expected ≤${maxDec}`,
  170 |                     ).toBe(true);
  171 |                 }
  172 |                 console.log(`[TC-03d] Precision: ${prec} | View: ${view} | Max Decimals: ${maxDec} | Ask: ${JSON.stringify(askTexts.slice(0, 2))} | Bid: ${JSON.stringify(bidTexts.slice(0, 2))}`);
  173 |             }
  174 |         }
  175 | 
  176 |         // End in all-view at 0.01 precision
  177 |         await spotMarketBuyPage.setOrderBookView('all');
  178 |     });
  179 | 
  180 |     // ── TC-03e ────────────────────────────────────────────────────────────────
  181 |     test('TC-03e: order book LTP and buy/sell ratio bar (suggestions — not yet implemented) @sanity', async () => {
  182 |         const ltp   = await spotMarketBuyPage.getOrderBookLtp();
  183 |         const ratio = await spotMarketBuyPage.getOrderBookBuySellRatio();
  184 |         const sum   = parseFloat((ratio.buyPct + ratio.sellPct).toFixed(1));
  185 |         test.info().annotations.push({
  186 |             type: 'suggestion',
  187 |             description: `SUGGESTION [TC-03e LTP]: Order book last traded price (LTP) display is not yet ` +
  188 |                 `implemented. Observed LTP=${ltp}. Consider showing the last trade price in the order book mid-row.`,
  189 |         });
  190 |         test.info().annotations.push({
  191 |             type: 'suggestion',
  192 |             description: `SUGGESTION [TC-03e B%+S%]: Order book buy/sell ratio bar is not yet implemented. ` +
  193 |                 `Observed B%=${ratio.buyPct} + S%=${ratio.sellPct} = ${sum}. ` +
  194 |                 `Consider adding a visual percentage bar showing bid vs ask volume split.`,
  195 |         });
  196 |         console.log(`[TC-03e] LTP: ${ltp} | Buy Pct: ${ratio.buyPct} | Sell Pct: ${ratio.sellPct} | Sum: ${sum} (features not yet implemented — logged as suggestions)`);
  197 |     });
  198 | 
  199 |     // ── TC-03f ────────────────────────────────────────────────────────────────
  200 |     test('TC-03f: order book has actual ask and bid rows @sanity', async () => {
  201 |         const { askCount, bidCount, topAsk, topBid } = await spotMarketBuyPage.getOrderBookTopBidAsk();
  202 |         expect.soft(askCount, 'Ask row count should be >0').toBeGreaterThan(0);
  203 |         expect.soft(bidCount, 'Bid row count should be >0').toBeGreaterThan(0);
  204 |         expect.soft(topAsk,   'Top ask should be positive').toBeGreaterThan(0);
  205 |         expect.soft(topBid,   'Top bid should be positive').toBeGreaterThan(0);
  206 |         console.log(`[TC-03f] Order book rows | Ask Count: ${askCount} | Bid Count: ${bidCount} | Top Ask: ${topAsk} | Top Bid: ${topBid}`);
  207 |     });
```