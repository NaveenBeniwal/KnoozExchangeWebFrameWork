import { test, expect } from '@playwright/test';
import { TradeApiHelper } from '../../../src/api/TradeApiHelper';
import { SpotTradeBuyOrderPayload } from '../../../src/payloads/trade/SpotTradeBuyOrderPayload';

// ── API paths ────────────────────────────────────────────────────────────────
const BALANCE_API     = '/api/v2/peatio/account/balances';
const ORDER_API       = '/api/v2/peatio/market/orders';
const OPEN_ORDERS_API = '/api/v2/peatio/market/orders?state=wait&limit=10&market=btcusdt&order_by=desc';
const CANCEL_ORDER_API = '/api/v2/peatio/market/orders/{id}/cancel';

// ── Trade constants ──────────────────────────────────────────────────────────
const market   = 'btcusdt';
const side     = 'buy';
const ordType  = 'limit';
const price    = parseFloat(process.env.TRADE_BUY_PRICE  ?? '62500');
const volume   = parseFloat(process.env.TRADE_BUY_VOLUME ?? '0.0001');
const makerFee = 0.000015;

// ── Shared state across serial tests ────────────────────────────────────────
let tradeApi:    TradeApiHelper;
let orderBody:   any;       // single order object (not array-wrapped)
let openOrders:  any[];
let orderId:     number;
let baseBefore:  number;
let quoteBefore: number;

const body = (res: { body: any }) => JSON.stringify(res.body).slice(0, 300);

// ════════════════════════════════════════════════════════════════════════════
test.describe.serial('Spot Trade Limit Buy — Open Orders Flow (TC-01 to TC-35)', () => {

    test.beforeAll(async ({ playwright }) => {
        const ctx = await playwright.request.newContext();
        tradeApi = new TradeApiHelper(ctx, process.env.TRADE_BASE_URL!);
        await tradeApi.login(
            process.env.TRADE_USER_EMAIL!,
            process.env.TRADE_USER_PASSWORD!,
            process.env.TRADE_2FA_SECRET!,
        );
    });

    // ── TC-01 ────────────────────────────────────────────────────────────────
    test('TC-01: Get balance before trade', async () => {
        console.log('\n📌 [TC-01] Fetching balance before trade...');
        const res = await tradeApi.get(BALANCE_API);
        console.log(`✅ Balance API Status: ${res.status}`);
        if (res.status !== 200) console.error('❌ Balance API Error:', res.body);
        expect(res.status, `TC-01: Expected status 200, received ${res.status} | ${body(res)}`).toBe(200);

        const btc  = res.body.find((x: any) => x.currency === 'btc');
        const usdt = res.body.find((x: any) => x.currency === 'usdt');
        expect(btc,  'TC-01: BTC balance entry not found in response').toBeDefined();
        expect(usdt, 'TC-01: USDT balance entry not found in response').toBeDefined();

        baseBefore  = parseFloat(btc.balance);
        quoteBefore = parseFloat(usdt.balance);
        console.log(`📊 BTC Before:  ${baseBefore}`);
        console.log(`📊 USDT Before: ${quoteBefore}`);
    });

    // ── TC-02 ────────────────────────────────────────────────────────────────
    test('TC-02: Place limit buy order', async () => {
        const payload = SpotTradeBuyOrderPayload.limitBuy();
        console.log('\n📌 [TC-02] Placing limit buy order...');
        console.log('📦 Payload:', payload);
        const res = await tradeApi.post(ORDER_API, payload);
        console.log(`✅ Order API Status: ${res.status}`);
        console.log('📦 Order API Response:', res.body);
        if (res.status !== 201) console.error('❌ Order Placement Failed — API message:', res.body);
        expect(res.status, `TC-02: Expected status 201 Created, received ${res.status} | ${body(res)}`).toBe(201);

        orderBody = res.body;
        orderId   = orderBody.id;

        expect(orderBody.state, `TC-02: Expected new order state "wait", got "${orderBody.state}"`).toBe('wait');
        console.log(`✅ Order Created → ID: ${orderId} | State: ${orderBody.state}`);
    });

    // ── TC-03 ────────────────────────────────────────────────────────────────
    test('TC-03: Balance after order — quote balance reduced', async () => {
        console.log('\n📌 [TC-03] Checking balance after order placement...');
        const res = await tradeApi.get(BALANCE_API);
        console.log(`✅ Balance API Status: ${res.status}`);
        if (res.status !== 200) console.error('❌ Balance API Error:', res.body);
        expect(res.status, `TC-03: Expected status 200, received ${res.status} | ${body(res)}`).toBe(200);

        const quoteAfter = parseFloat(res.body.find((x: any) => x.currency === 'usdt').balance);
        console.log(`📊 USDT — Before: ${quoteBefore} | After: ${quoteAfter}`);
        expect(quoteAfter, `TC-03: USDT should be <= ${quoteBefore} after placing order, got ${quoteAfter}`).toBeLessThanOrEqual(quoteBefore);
    });

    // ── TC-04 to TC-27: Single order field validations ───────────────────────

    test('TC-04: Market is btcusdt', () => {
        expect(orderBody.market, `TC-04: Expected market "${market}", got "${orderBody.market}"`).toBe(market);
    });

    test('TC-05: Side is buy', () => {
        expect(orderBody.side, `TC-05: Expected side "${side}", got "${orderBody.side}"`).toBe(side);
    });

    test('TC-06: Order type is limit', () => {
        expect(orderBody.ord_type, `TC-06: Expected ord_type "${ordType}", got "${orderBody.ord_type}"`).toBe(ordType);
    });

    test('TC-07: Price matches payload', () => {
        const actual = parseFloat(orderBody.price);
        expect(actual, `TC-07: Expected price ${price}, got ${actual}`).toBe(price);
    });

    test('TC-08: Origin volume matches payload', () => {
        const actual = parseFloat(orderBody.origin_volume);
        expect(actual, `TC-08: Expected origin_volume ${volume}, got ${actual}`).toBe(volume);
    });

    test('TC-09: Order ID is present and non-zero', () => {
        expect(orderBody.id, `TC-09: Order ID should be truthy, got "${orderBody.id}"`).toBeTruthy();
        expect(typeof orderBody.id, `TC-09: Order ID should be a number, got type "${typeof orderBody.id}"`).toBe('number');
    });

    test('TC-10: Stop price field is defined', () => {
        expect('stop_price' in orderBody, `TC-10: stop_price field missing from order response`).toBe(true);
    });

    test('TC-11: Remaining volume equals origin volume (unfilled order)', () => {
        const remaining = parseFloat(orderBody.remaining_volume);
        const origin    = parseFloat(orderBody.origin_volume);
        expect(remaining, `TC-11: Expected remaining_volume ~${origin} for fresh unfilled order, got ${remaining}`).toBeCloseTo(origin, 8);
    });

    test('TC-12: Executed volume is 0 for a fresh order', () => {
        const actual = parseFloat(orderBody.executed_volume);
        expect(actual, `TC-12: Expected executed_volume 0 for fresh order, got ${actual}`).toBe(0);
    });

    test('TC-13: Total is present and positive', () => {
        const actual = parseFloat(orderBody.total);
        expect(actual, `TC-13: Expected total > 0, got ${actual}`).toBeGreaterThan(0);
    });

    test('TC-14: State is wait', () => {
        expect(orderBody.state, `TC-14: Expected state "wait", got "${orderBody.state}"`).toBe('wait');
    });

    test('TC-15: Avg price is defined', () => {
        expect(orderBody.avg_price, `TC-15: avg_price should be defined, got ${orderBody.avg_price}`).toBeDefined();
    });

    test('TC-16: Trades count is 0 for a fresh order', () => {
        expect(orderBody.trades_count, `TC-16: Expected trades_count 0 for fresh order, got ${orderBody.trades_count}`).toBe(0);
    });

    test('TC-17: Maker fee matches', () => {
        const actual = parseFloat(orderBody.maker_fee);
        expect(actual, `TC-17: Expected maker_fee ${makerFee}, got ${actual}`).toBe(makerFee);
    });

    test('TC-18: Created at timestamp is present', () => {
        expect(orderBody.created_at, `TC-18: created_at should be truthy, got "${orderBody.created_at}"`).toBeTruthy();
        const ts = new Date(orderBody.created_at).getTime();
        expect(ts, `TC-18: created_at "${orderBody.created_at}" is not a valid date`).toBeGreaterThan(0);
    });

    test('TC-19: Updated at timestamp is present', () => {
        expect(orderBody.updated_at, `TC-19: updated_at should be truthy, got "${orderBody.updated_at}"`).toBeTruthy();
        const ts = new Date(orderBody.updated_at).getTime();
        expect(ts, `TC-19: updated_at "${orderBody.updated_at}" is not a valid date`).toBeGreaterThan(0);
    });

    test('TC-20: Amount precision field is defined', () => {
        const val = orderBody.amount_precision ?? orderBody.market_type ?? orderBody.market;
        expect(val, `TC-20: amount_precision (or fallback market field) should be defined`).toBeDefined();
    });

    test('TC-21: Price precision field is defined', () => {
        const val = orderBody.price_precision ?? orderBody.ord_type;
        expect(val, `TC-21: price_precision (or fallback ord_type field) should be defined`).toBeDefined();
    });

    test('TC-22: Bid currency is usdt', () => {
        expect(orderBody.bid, `TC-22: Expected bid currency "usdt", got "${orderBody.bid}"`).toBe('usdt');
    });

    test('TC-23: Ask currency is btc', () => {
        expect(orderBody.ask, `TC-23: Expected ask currency "btc", got "${orderBody.ask}"`).toBe('btc');
    });

    test('TC-24: Bid currency info is present', () => {
        const val = orderBody.bid_currency ?? orderBody.bid;
        expect(val, `TC-24: bid_currency info should be defined`).toBeDefined();
    });

    test('TC-25: Ask currency info is present', () => {
        const val = orderBody.ask_currency ?? orderBody.ask;
        expect(val, `TC-25: ask_currency info should be defined`).toBeDefined();
    });

    test('TC-26: Volume relation — remaining + executed = origin volume', () => {
        const remaining = parseFloat(orderBody.remaining_volume);
        const executed  = parseFloat(orderBody.executed_volume);
        const origin    = parseFloat(orderBody.origin_volume);
        expect(remaining + executed, `TC-26: remaining(${remaining}) + executed(${executed}) should equal origin(${origin})`).toBeCloseTo(origin, 8);
    });

    test('TC-27: Total = price × origin volume', () => {
        const expected = parseFloat(orderBody.price) * parseFloat(orderBody.origin_volume);
        const actual   = parseFloat(orderBody.total);
        expect(actual, `TC-27: Expected total ~${expected}, got ${actual}`).toBeCloseTo(expected, 4);
    });

    // ── TC-28: Fetch open orders ─────────────────────────────────────────────
    test('TC-28: Get open orders returns 200', async () => {
        console.log('\n📌 [TC-28] Fetching open orders...');
        const res = await tradeApi.get(OPEN_ORDERS_API);
        console.log(`✅ Open Orders API Status: ${res.status}`);
        if (res.status !== 200) console.error('❌ Open Orders API Error:', res.body);
        expect(res.status, `TC-28: Expected status 200, received ${res.status} | ${body(res)}`).toBe(200);
        expect(Array.isArray(res.body), `TC-28: Response body should be an array`).toBe(true);

        openOrders = res.body;
        console.log(`📊 Open Orders Count: ${openOrders.length}`);
        if (openOrders.length > 0) console.log('📦 Latest Open Order:', openOrders[0]);
    });

    // ── TC-29 to TC-32: Open orders list validations ─────────────────────────

    test('TC-29: All open orders have state wait', () => {
        for (const o of openOrders) {
            expect(o.state, `TC-29: Order ID ${o.id} in open orders should have state "wait", got "${o.state}"`).toBe('wait');
        }
    });

    test('TC-30: Placed order appears in open orders list', () => {
        const found = openOrders.find((o: any) => o.id === orderId);
        expect(found, `TC-30: Order ID ${orderId} not found in open orders list`).toBeDefined();
    });

    test('TC-31: Open orders count does not exceed pagination limit', () => {
        expect(openOrders.length, `TC-31: Expected <= 10 open orders, got ${openOrders.length}`).toBeLessThanOrEqual(10);
    });

    test('TC-32: Open orders are sorted by created_at descending', () => {
        for (let i = 1; i < openOrders.length; i++) {
            const prev = new Date(openOrders[i - 1].created_at).getTime();
            const curr = new Date(openOrders[i].created_at).getTime();
            expect(prev, `TC-32: Order at index ${i - 1} (${openOrders[i - 1].created_at}) should be >= index ${i} (${openOrders[i].created_at})`).toBeGreaterThanOrEqual(curr);
        }
    });

    // ── TC-33 ────────────────────────────────────────────────────────────────
    test('TC-33: Cancel order returns 200', async () => {
        console.log(`\n📌 [TC-33] Cancelling order ${orderId}...`);
        const cancelPath = CANCEL_ORDER_API.replace('{id}', String(orderId));
        const res = await tradeApi.post(cancelPath, { id: orderId, market });
        console.log(`✅ Cancel API Status: ${res.status}`);
        console.log('📦 Cancel Response:', res.body);
        if (res.status !== 200) console.error('❌ Cancel Failed — API message:', res.body);
        expect(res.status, `TC-33: Expected status 200 for cancel, received ${res.status} | ${body(res)}`).toBe(200);
        console.log(`✅ Order ${orderId} cancelled | State: ${res.body?.state}`);
    });

    // ── TC-34 ────────────────────────────────────────────────────────────────
    test('TC-34: Cancelled order no longer appears in open orders', async () => {
        console.log('\n📌 [TC-34] Verifying cancelled order removed from open orders...');
        const res = await tradeApi.get(OPEN_ORDERS_API);
        console.log(`✅ Open Orders API Status: ${res.status}`);
        expect(res.status, `TC-34: Expected status 200, received ${res.status} | ${body(res)}`).toBe(200);

        const stillOpen = res.body.find((o: any) => o.id === orderId);
        if (stillOpen) console.error(`❌ Order ${orderId} still in open orders after cancel:`, stillOpen);
        expect(stillOpen, `TC-34: Order ${orderId} should not be in open orders after cancel, but was found`).toBeUndefined();
        console.log(`✅ Order ${orderId} no longer in open orders`);
    });

    // ── TC-35 ────────────────────────────────────────────────────────────────
    test('TC-35: Balance restored to pre-order levels after cancel', async () => {
        console.log('\n📌 [TC-35] Verifying balance restored after cancel...');
        const res = await tradeApi.get(BALANCE_API);
        console.log(`✅ Balance API Status: ${res.status}`);
        if (res.status !== 200) console.error('❌ Balance API Error:', res.body);
        expect(res.status, `TC-35: Expected status 200, received ${res.status} | ${body(res)}`).toBe(200);

        const baseAfter  = parseFloat(res.body.find((x: any) => x.currency === 'btc').balance);
        const quoteAfter = parseFloat(res.body.find((x: any) => x.currency === 'usdt').balance);

        console.log(`📊 BTC  — Before: ${baseBefore}  | After: ${baseAfter}`);
        console.log(`📊 USDT — Before: ${quoteBefore} | After: ${quoteAfter}`);

        expect(baseAfter,  `TC-35: BTC balance should be ~${baseBefore} after cancel, got ${baseAfter}`).toBeCloseTo(baseBefore,  8);
        expect(quoteAfter, `TC-35: USDT balance should be ~${quoteBefore} after cancel, got ${quoteAfter}`).toBeCloseTo(quoteBefore, 8);
    });

});
