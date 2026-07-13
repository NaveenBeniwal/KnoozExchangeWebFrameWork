# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: trade/spotSellLimitOrder.spec.ts >> Spot Module — Sell Limit Order Positive Flow >> TC-07: 24h ticker header matches Binance reference data (exact match) @sanity
- Location: tests/trade/spotSellLimitOrder.spec.ts:119:5

# Error details

```
Error: TC-07 24h High — page:64425 Binance:0

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 64425
```

```
Error: TC-07 24h Low — page:62500.76 Binance:0

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 62500.76
```

# Test source

```ts
  27  | let snapshotAfterOrder:         FullBalanceSnapshot | null = null;
  28  | let snapshotBeforeBelowMarket:  FullBalanceSnapshot | null = null;
  29  | let belowMarketOrderDetails: { limitPrice: number; executedPrice: number; amount: number; placedAt: Date; orderId: string } | null = null;
  30  | 
  31  | // Set in TC-09: true when limit price < market price at order time (fills immediately)
  32  | let orderFilledImmediately = false;
  33  | let marketPriceAtOrder     = 0;
  34  | 
  35  | // Actual BTC amount from All Orders — used in TC-13 for balance check
  36  | let allOrdersAmountActual = 0;
  37  | 
  38  | // Cancel All scenario (TC-20 onwards)
  39  | let snapshotBeforeMultiOrders: FullBalanceSnapshot | null = null;
  40  | let multiOrdersSucceeded = false;
  41  | let multiOrderActualSellAmounts: number[] = [];
  42  | let multiOrderActualBuyTotals:   number[] = [];
  43  | 
  44  | const diffPct = (actual: number, ref: number) =>
  45  |     ref > 0 ? parseFloat((Math.abs(actual - ref) / ref * 100).toFixed(3)) : 0;
  46  | 
  47  | test.describe.serial('Spot Module — Sell Limit Order Positive Flow', () => {
  48  | 
  49  |     test.beforeAll(async ({ playwright }, testInfo) => {
  50  |         browser = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
  51  |         context = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL, ignoreHTTPSErrors: true });
  52  |         page              = await context.newPage();
  53  |         loginPage         = new LoginPage(page);
  54  |         spotSellPage      = new SpotSellLimitOrderPage(page);
  55  |         portfolioSpotPage = new PortfolioSpotPage(page);
  56  |         await loginPage.goToLoginPage();
  57  |         await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!).catch(() => {});
  58  |         await loginPage.dismissPostLoginDialogsAndWaitForHome();
  59  |     });
  60  | 
  61  |     test.afterAll(async () => { await browser.close(); });
  62  | 
  63  |     // ── TC-01 ─────────────────────────────────────────────────────────────────
  64  |     test('TC-01: navigate to Spot Trading page @smoke @sanity', async () => {
  65  |         await spotSellPage.navigateToSpotTrading();
  66  |         console.log('[TC-01] Navigated to Spot Trading page');
  67  |     });
  68  | 
  69  |     // ── TC-02 ─────────────────────────────────────────────────────────────────
  70  |     test('TC-02: Spot Trading page shows all expected labels @smoke @sanity', async () => {
  71  |         const r = await spotSellPage.getSpotPageLabelsStatus();
  72  |         expect.soft(r.tradingText,       'Trading page heading').toBe('Trading');
  73  |         expect.soft(r.spotText,          'Spot label').toBe('Spot');
  74  |         expect.soft(r.depthViewText,    'Depth View label').toBe('Depth View');
  75  |         expect.soft(r.orderBookText,    'Order Book heading').toBe('Order Book');
  76  |         expect.soft(r.buyTabText,       'Buy tab').toBe('Buy');
  77  |         expect.soft(r.sellTabText,      'Sell tab').toBe('Sell');
  78  |         expect.soft(r.limitTabText,     'Limit tab').toBe('Limit');
  79  |         expect.soft(r.marketTabText,    'Market tab').toBe('Market');
  80  |         expect.soft(r.stopTabText,       'Stop tab').toBe('Stop');
  81  |         expect.soft(r.marketTradesText, 'Market Trades label').toBe('Market Trades');
  82  |         expect.soft(r.myTradesText,     'My Trades label').toBe('My Trades');
  83  |         expect.soft(r.openOrdersTabText, 'Open Orders tab').toBe('Open Orders');
  84  |         expect.soft(r.allOrdersText,    'All Orders tab').toBe('All Orders');
  85  |         expect.soft(r.tradeHistoryText, 'Trade History label').toBe('Trade History');
  86  |         console.log(`[TC-02] Depth View: "${r.depthViewText}" | Order Book: "${r.orderBookText}" | Buy: "${r.buyTabText}" | Sell: "${r.sellTabText}" | Limit: "${r.limitTabText}" | Market: "${r.marketTabText}" | Market Trades: "${r.marketTradesText}" | My Trades: "${r.myTradesText}" | All Orders: "${r.allOrdersText}" | Trade History: "${r.tradeHistoryText}"`);
  87  |     });
  88  | 
  89  |     // ── TC-03 ─────────────────────────────────────────────────────────────────
  90  |     test('TC-03: search currency pair in dropdown @sanity', async () => {
  91  |         await spotSellPage.searchCurrencyPair(tradeData.searchPair);
  92  |         console.log(`[TC-03] Searched pair: ${tradeData.searchPair}`);
  93  |     });
  94  | 
  95  |     // ── TC-04 ─────────────────────────────────────────────────────────────────
  96  |     test('TC-04: mark currency pair as favorite @sanity', async () => {
  97  |         const r = await spotSellPage.markAsFavorite(tradeData.searchPair);
  98  |         expect.soft(r.favoriteAddedStatus, r.favoriteMsg).toBe('added');
  99  |         console.log(`[TC-04] Marked ${tradeData.searchPair} as favorite | Status: "${r.favoriteAddedStatus}" | Message: "${r.favoriteMsg}"`);
  100 |     });
  101 | 
  102 |     // ── TC-05 ─────────────────────────────────────────────────────────────────
  103 |     test('TC-05: unmark currency pair from favorites @sanity', async () => {
  104 |         const r = await spotSellPage.unmarkFavorite(tradeData.searchPair);
  105 |         expect.soft(r.noRecordsStatus,    r.noRecordsMsg).toBe('visible');
  106 |         expect.soft(r.favoriteRemovedStatus, r.favoriteMsg).toBe('removed');
  107 |         console.log(`[TC-05] Unmarked ${tradeData.searchPair} from favorites | Status: "${r.favoriteRemovedStatus}" | Message: "${r.favoriteMsg}" | No Records Status: "${r.noRecordsStatus}"`);
  108 |     });
  109 | 
  110 |     // ── TC-06 ─────────────────────────────────────────────────────────────────
  111 |     // Pair is active from here — all Binance comparisons use tradeData.searchPair
  112 |     test('TC-06: select currency pair from ALL tab @sanity', async () => {
  113 |         await spotSellPage.selectCurrencyPair();
  114 |         console.log('[TC-06] Currency pair selected from ALL tab');
  115 |     });
  116 | 
  117 |     // ── TC-07 ─────────────────────────────────────────────────────────────────
  118 |     // Positioned after TC-06 so the page shows the selected pair before comparing with Binance
  119 |     test('TC-07: 24h ticker header matches Binance reference data (exact match) @sanity', async () => {
  120 |         const [binance, ticker] = await Promise.all([
  121 |             BinanceHelper.get24hTicker(page, tradeData.searchPair),
  122 |             spotSellPage.getTickerHeaderData(),
  123 |         ]);
  124 |         expect.soft(ticker.lastPrice, 'Last Price should be a positive number').toBeGreaterThan(0);
  125 |         expect.soft(diffPct(ticker.lastPrice, binance.lastPrice),      `TC-07 Last Price diff% — page:${ticker.lastPrice} Binance:${binance.lastPrice} (live price may shift 2-5s during fetch)`).toBeLessThan(1);
  126 |         expect.soft(ticker.high24h,        `TC-07 24h High — page:${ticker.high24h} Binance:${binance.highPrice}`).toBe(binance.highPrice);
> 127 |         expect.soft(ticker.low24h,         `TC-07 24h Low — page:${ticker.low24h} Binance:${binance.lowPrice}`).toBe(binance.lowPrice);
      |                                                                                                                 ^ Error: TC-07 24h Low — page:62500.76 Binance:0
  128 |         expect.soft(diffPct(ticker.volume24hBase,  binance.volume), `TC-07 Volume(base) diff% — page:${ticker.volume24hBase} Binance:${binance.volume} (volume changes with every trade)`).toBeLessThan(1);
  129 |         // Quote volume: exchange counts both buyer+seller side (~2× Binance). Log as info only, not a test failure.
  130 |         const quoteDiffPct = diffPct(ticker.volume24hQuote, binance.quoteVolume);
  131 |         if (quoteDiffPct >= 1) test.info().annotations.push({ type: 'info', description: `TC-07 Volume(quote) diff: ${quoteDiffPct.toFixed(2)}% — page:${ticker.volume24hQuote} Binance:${binance.quoteVolume} — exchange counts both sides of each trade (~2× Binance), not a bug` });
  132 |         console.log(`[TC-07] Verified 24h ticker for ${tradeData.searchPair} | Page Last: ${ticker.lastPrice} | Page High: ${ticker.high24h} | Page Low: ${ticker.low24h} | Page Vol Base: ${ticker.volume24hBase} | Page Vol Quote: ${ticker.volume24hQuote} | Binance Last: ${binance.lastPrice} | Binance High: ${binance.highPrice} | Binance Low: ${binance.lowPrice} | Binance Vol: ${binance.volume} | Binance Quote Vol: ${binance.quoteVolume} | Last Diff%: ${diffPct(ticker.lastPrice, binance.lastPrice)} | Vol Base Diff%: ${diffPct(ticker.volume24hBase, binance.volume)} | Vol Quote Diff%: ${quoteDiffPct}`);
  133 |     });
  134 | 
  135 |     // ── TC-08 ─────────────────────────────────────────────────────────────────
  136 |     test('TC-08: order book column headers show Price, Amount and Total @sanity', async () => {
  137 |         const h = await spotSellPage.getOrderBookColumnHeaders();
  138 |         expect.soft(h.price,  'Price header should be visible').not.toBe('');
  139 |         expect.soft(h.amount, 'Amount header should be visible').not.toBe('');
  140 |         expect.soft(h.total,  'Total header should be visible').not.toBe('');
  141 |         console.log(`[TC-08] Order book headers | Price: "${h.price}" | Amount: "${h.amount}" | Total: "${h.total}"`);
  142 |     });
  143 | 
  144 |     // ── TC-09 ─────────────────────────────────────────────────────────────────
  145 |     test('TC-09: order book view switches (all / sell-only / buy-only) @sanity', async () => {
  146 |         await spotSellPage.setOrderBookView('sell');
  147 |         const v1 = await spotSellPage.isOrderBookVisible();
  148 |         expect.soft(v1 ? 'visible' : 'not visible', 'OB visible in sell-only view').toBe('visible');
  149 |         await spotSellPage.setOrderBookView('buy');
  150 |         const v2 = await spotSellPage.isOrderBookVisible();
  151 |         expect.soft(v2 ? 'visible' : 'not visible', 'OB visible in buy-only view').toBe('visible');
  152 |         await spotSellPage.setOrderBookView('all');
  153 |         console.log(`[TC-09] Order book view switch | Sell-only Visible: ${v1} | Buy-only Visible: ${v2} | Restored to all`);
  154 |     });
  155 | 
  156 |     // ── TC-10 ─────────────────────────────────────────────────────────────────
  157 |     test('TC-10: order book precision dropdown changes price decimal places across all views @sanity', async () => {
  158 |         const precisions: string[]                  = ['0.01', '0.1', '1', '0.01'];
  159 |         const views: Array<'all' | 'sell' | 'buy'> = ['all', 'sell', 'buy'];
  160 |         const r = await spotSellPage.validateOrderBookPrecisionDecimals(precisions, views);
  161 |         for (const f of r.failures) { expect.soft(false, `TC-10: ${f.msg}`).toBe(true); }
  162 |         console.log(`[TC-10] Passed: ${r.passed} | Failures: ${r.failures.length}`);
  163 |     });
  164 | 
  165 |     // ── TC-11 ─────────────────────────────────────────────────────────────────
  166 |     test('TC-11: order book LTP and buy/sell ratio bar (suggestions — not yet implemented) @sanity', async () => {
  167 |         const ltp   = await spotSellPage.getOrderBookLtp();
  168 |         const ratio = await spotSellPage.getOrderBookBuySellRatio();
  169 |         const sum   = parseFloat((ratio.buyPct + ratio.sellPct).toFixed(1));
  170 |         // LTP display in orderbook not yet implemented — recorded as suggestion
  171 |         test.info().annotations.push({
  172 |             type: 'suggestion',
  173 |             description: `SUGGESTION [TC-11 LTP]: Order book last traded price (LTP) display is not yet ` +
  174 |                 `implemented. Observed LTP=${ltp}. Consider showing the last trade price in the order book mid-row.`,
  175 |         });
  176 |         // Buy/sell ratio bar not yet implemented — recorded as suggestion
  177 |         test.info().annotations.push({
  178 |             type: 'suggestion',
  179 |             description: `SUGGESTION [TC-11 B%+S%]: Order book buy/sell ratio bar is not yet implemented. ` +
  180 |                 `Observed B%=${ratio.buyPct} + S%=${ratio.sellPct} = ${sum}. ` +
  181 |                 `Consider adding a visual percentage bar showing bid vs ask volume split.`,
  182 |         });
  183 |         console.log(`[TC-11] LTP: ${ltp} | Buy Pct: ${ratio.buyPct} | Sell Pct: ${ratio.sellPct} | Sum: ${sum} (features not yet implemented — logged as suggestions)`);
  184 |     });
  185 | 
  186 |     // ── TC-12 ─────────────────────────────────────────────────────────────────
  187 |     test('TC-12: order book has actual ask and bid rows @sanity', async () => {
  188 |         const { askCount, bidCount, topAsk, topBid } = await spotSellPage.getOrderBookTopBidAsk();
  189 |         expect.soft(askCount, 'Ask row count should be >0').toBeGreaterThan(0);
  190 |         expect.soft(bidCount, 'Bid row count should be >0').toBeGreaterThan(0);
  191 |         expect.soft(topAsk,   'Top ask should be positive').toBeGreaterThan(0);
  192 |         expect.soft(topBid,   'Top bid should be positive').toBeGreaterThan(0);
  193 |         console.log(`[TC-12] Order book rows | Ask Count: ${askCount} | Bid Count: ${bidCount} | Top Ask: ${topAsk} | Top Bid: ${topBid}`);
  194 |     });
  195 | 
  196 |     // ── TC-13 ─────────────────────────────────────────────────────────────────
  197 |     test('TC-13: top bid < top ask (valid spread) @sanity', async () => {
  198 |         const { topAsk, topBid } = await spotSellPage.getOrderBookTopBidAsk();
  199 |         if (topAsk > 0 && topBid > 0) {
  200 |             expect.soft(topBid, `Top bid(${topBid}) must be < top ask(${topAsk})`).toBeLessThan(topAsk);
  201 |         }
  202 |         const spread = topAsk > 0 && topBid > 0 ? parseFloat((topAsk - topBid).toFixed(8)) : 'N/A';
  203 |         console.log(`[TC-13] Spread check | Top Bid: ${topBid} | Top Ask: ${topAsk} | Spread: ${spread}`);
  204 |     });
  205 | 
  206 |     // ── TC-14 ─────────────────────────────────────────────────────────────────
  207 |     test('TC-14: order book top bid/ask match Binance within 0.5% @sanity', async () => {
  208 |         const [{ topAsk, topBid }, ob] = await Promise.all([
  209 |             spotSellPage.getOrderBookTopBidAsk(),
  210 |             BinanceHelper.getOrderBook(page, tradeData.searchPair, 5),
  211 |         ]);
  212 |         const binanceBid = ob.bids[0]?.price ?? 0;
  213 |         const binanceAsk = ob.asks[0]?.price ?? 0;
  214 |         if (binanceBid > 0 && topBid > 0) {
  215 |             expect.soft(diffPct(topBid, binanceBid), `Bid diff% — page:${topBid} Binance:${binanceBid}`).toBeLessThan(0.5);
  216 |         }
  217 |         if (binanceAsk > 0 && topAsk > 0) {
  218 |             expect.soft(diffPct(topAsk, binanceAsk), `Ask diff% — page:${topAsk} Binance:${binanceAsk}`).toBeLessThan(0.5);
  219 |         }
  220 |         console.log(`[TC-14] Bid/Ask vs Binance | Page Bid: ${topBid} | Page Ask: ${topAsk} | Binance Bid: ${binanceBid} | Binance Ask: ${binanceAsk} | Bid Diff%: ${diffPct(topBid, binanceBid)} | Ask Diff%: ${diffPct(topAsk, binanceAsk)}`);
  221 |     });
  222 | 
  223 |     // ── TC-15 ─────────────────────────────────────────────────────────────────
  224 |     test('TC-15: order book LTP matches Binance last price within 0.5% @sanity', async () => {
  225 |         const [ltp, b] = await Promise.all([
  226 |             spotSellPage.getOrderBookLtp(),
  227 |             BinanceHelper.get24hTicker(page, tradeData.searchPair),
```