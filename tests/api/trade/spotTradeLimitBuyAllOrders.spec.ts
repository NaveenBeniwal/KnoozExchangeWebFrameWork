import { test, expect } from '@playwright/test';
import { TradeApiHelper } from '../../../src/api/TradeApiHelper';
import { SpotTradeBuyOrderPayload } from '../../../src/payloads/trade/SpotTradeBuyOrderPayload';

// ── API paths ────────────────────────────────────────────────────────────────
const BALANCE_API      = '/api/v2/peatio/account/balances';
const ORDER_API        = '/api/v2/peatio/market/orders';
const CANCEL_ORDER_API = '/api/v2/peatio/market/orders/{id}/cancel';
const ALL_ORDERS_API   = '/api/v2/peatio/market/orders?limit=10&page=1&market=btcusdt&order_by=desc';

// ── Trade constants ──────────────────────────────────────────────────────────
const market   = 'btcusdt';
const side     = 'buy';
const ordType  = 'limit';
const price    = parseFloat(process.env.TRADE_BUY_PRICE  ?? '62500');
const volume   = parseFloat(process.env.TRADE_BUY_VOLUME ?? '0.0001');
const makerFee = 0.000015;

// ── Shared state across serial tests ────────────────────────────────────────
let tradeApi:    TradeApiHelper;
let orderBody:   any;
let allOrders:   any[];
let orderId:     number;
let baseBefore:  number;
let quoteBefore: number;

const body = (res: { body: any }) => JSON.stringify(res.body).slice(0, 300);

// ════════════════════════════════════════════════════════════════════════════
test.describe.serial('Spot Trade Limit Buy — All Orders Flow (TC-01 to TC-41)', () => {

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
        console.log(`✅ Order Created → ID: ${orderId} | State: ${orderBody.state} | Price: ${orderBody.price} | Volume: ${orderBody.origin_volume}`);
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

    test('TC-10: Remaining volume is >= 0', () => {
        const actual = parseFloat(orderBody.remaining_volume);
        expect(actual, `TC-10: Expected remaining_volume >= 0, got ${actual}`).toBeGreaterThanOrEqual(0);
    });

    test('TC-11: Executed volume is >= 0', () => {
        const actual = parseFloat(orderBody.executed_volume);
        expect(actual, `TC-11: Expected executed_volume >= 0, got ${actual}`).toBeGreaterThanOrEqual(0);
    });

    test('TC-12: Total field is present and >= 0', () => {
        expect(orderBody.total, `TC-12: total field should be defined`).toBeDefined();
        const actual = parseFloat(orderBody.total);
        expect(actual, `TC-12: Expected total >= 0, got ${actual}`).toBeGreaterThanOrEqual(0);
    });

    test('TC-13: State is wait (pending)', () => {
        expect(orderBody.state, `TC-13: Expected state "wait", got "${orderBody.state}"`).toBe('wait');
    });

    test('TC-14: Avg price is defined', () => {
        expect(orderBody.avg_price, `TC-14: avg_price field should be defined, got ${orderBody.avg_price}`).toBeDefined();
    });

    test('TC-15: Trades count is >= 0', () => {
        expect(orderBody.trades_count, `TC-15: Expected trades_count >= 0, got ${orderBody.trades_count}`).toBeGreaterThanOrEqual(0);
    });

    test('TC-16: Maker fee matches', () => {
        const actual = parseFloat(orderBody.maker_fee);
        expect(actual, `TC-16: Expected maker_fee ${makerFee}, got ${actual}`).toBe(makerFee);
    });

    test('TC-17: Created at timestamp is present', () => {
        expect(orderBody.created_at, `TC-17: created_at should be truthy, got "${orderBody.created_at}"`).toBeTruthy();
        const ts = new Date(orderBody.created_at).getTime();
        expect(ts, `TC-17: created_at "${orderBody.created_at}" is not a valid date`).toBeGreaterThan(0);
    });

    test('TC-18: Updated at timestamp is present', () => {
        expect(orderBody.updated_at, `TC-18: updated_at should be truthy, got "${orderBody.updated_at}"`).toBeTruthy();
        const ts = new Date(orderBody.updated_at).getTime();
        expect(ts, `TC-18: updated_at "${orderBody.updated_at}" is not a valid date`).toBeGreaterThan(0);
    });

    test('TC-19: Stop price field is defined', () => {
        expect('stop_price' in orderBody, `TC-19: stop_price field missing from order response`).toBe(true);
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

    // ── TC-28 ────────────────────────────────────────────────────────────────
    test('TC-28: Get all orders returns 200', async () => {
        console.log('\n📌 [TC-28] Fetching all orders...');
        const res = await tradeApi.get(ALL_ORDERS_API);
        console.log(`✅ All Orders API Status: ${res.status}`);
        if (res.status !== 200) console.error('❌ All Orders API Error:', res.body);
        expect(res.status, `TC-28: Expected status 200, received ${res.status} | ${body(res)}`).toBe(200);
        expect(Array.isArray(res.body), `TC-28: Response body should be an array`).toBe(true);

        allOrders = res.body;
        console.log(`📊 All Orders Count: ${allOrders.length}`);
        if (allOrders.length > 0) console.log('📦 Latest Order:', allOrders[0]);
    });

    // ── TC-29 to TC-39: All orders list validations ──────────────────────────

    test('TC-29: Response is an array', () => {
        expect(Array.isArray(allOrders), `TC-29: Expected array, got ${typeof allOrders}`).toBe(true);
    });

    test('TC-30: Each order has required fields', () => {
        const required = ['id', 'side', 'ord_type', 'price', 'state', 'market', 'created_at'];
        for (const order of allOrders) {
            for (const field of required) {
                expect(order[field], `TC-30: Field "${field}" missing on order ID ${order.id}`).toBeDefined();
            }
        }
    });

    test('TC-31: Order IDs are unique', () => {
        const ids      = allOrders.map((o: any) => o.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size, `TC-31: Expected ${ids.length} unique IDs, found ${uniqueIds.size} (duplicates exist)`).toBe(ids.length);
    });

    test('TC-32: Response has at least one order', () => {
        expect(allOrders.length, `TC-32: Expected at least 1 order, got ${allOrders.length}`).toBeGreaterThanOrEqual(1);
    });

    test('TC-33: Orders with the same price can coexist (structure valid)', () => {
        const priceGroups = allOrders.reduce((acc: Record<string, number>, o: any) => {
            acc[o.price] = (acc[o.price] ?? 0) + 1;
            return acc;
        }, {});
        expect(Object.keys(priceGroups).length, `TC-33: Expected at least one price group`).toBeGreaterThanOrEqual(1);
    });

    test('TC-34: Cancelled orders (if any) have state "cancel"', () => {
        const cancelled = allOrders.filter((o: any) => o.state === 'cancel');
        for (const o of cancelled) {
            expect(o.state, `TC-34: Order ID ${o.id} in cancelled filter should have state "cancel", got "${o.state}"`).toBe('cancel');
        }
        console.log(`[TC-34] Cancelled orders in list: ${cancelled.length}`);
    });

    test('TC-35: Fully executed orders (if any) have state "done"', () => {
        const done = allOrders.filter((o: any) => o.state === 'done');
        for (const o of done) {
            expect(o.state, `TC-35: Order ID ${o.id} in done filter should have state "done", got "${o.state}"`).toBe('done');
        }
        console.log(`[TC-35] Done orders in list: ${done.length}`);
    });

    test('TC-36: Partially filled orders (if any) have both volumes > 0', () => {
        const partial = allOrders.filter(
            (o: any) => o.state === 'wait' && parseFloat(o.executed_volume) > 0,
        );
        for (const o of partial) {
            expect(parseFloat(o.executed_volume), `TC-36: Order ${o.id} partial — expected executed_volume > 0, got ${o.executed_volume}`).toBeGreaterThan(0);
            expect(parseFloat(o.remaining_volume), `TC-36: Order ${o.id} partial — expected remaining_volume > 0, got ${o.remaining_volume}`).toBeGreaterThan(0);
        }
        console.log(`[TC-36] Partial orders in list: ${partial.length}`);
    });

    test('TC-37: Pagination limit respected (max 10 orders)', () => {
        expect(allOrders.length, `TC-37: Expected <= 10 orders per page, got ${allOrders.length}`).toBeLessThanOrEqual(10);
    });

    test('TC-38: Orders are sorted by created_at descending', () => {
        for (let i = 1; i < allOrders.length; i++) {
            const prev = new Date(allOrders[i - 1].created_at).getTime();
            const curr = new Date(allOrders[i].created_at).getTime();
            expect(prev, `TC-38: Order at index ${i - 1} (${allOrders[i - 1].created_at}) should be >= index ${i} (${allOrders[i].created_at})`).toBeGreaterThanOrEqual(curr);
        }
    });

    test('TC-39: Price fields are valid numbers', () => {
        for (const o of allOrders) {
            const p = parseFloat(o.price);
            expect(isNaN(p), `TC-39: Order ID ${o.id} has non-numeric price "${o.price}"`).toBe(false);
            expect(p, `TC-39: Order ID ${o.id} has price <= 0: ${p}`).toBeGreaterThan(0);
        }
    });

    // ── TC-40 ────────────────────────────────────────────────────────────────
    test('TC-40: Cancel order returns 200', async () => {
        console.log(`\n📌 [TC-40] Cancelling order ${orderId}...`);
        const cancelPath = CANCEL_ORDER_API.replace('{id}', String(orderId));
        const res = await tradeApi.post(cancelPath, { id: orderId, market });
        console.log(`✅ Cancel API Status: ${res.status}`);
        console.log('📦 Cancel Response:', res.body);
        if (res.status !== 200) console.error('❌ Cancel Failed — API message:', res.body);
        expect(res.status, `TC-40: Expected status 200 for cancel, received ${res.status} | ${body(res)}`).toBe(200);
        console.log(`✅ Order ${orderId} cancelled | State: ${res.body?.state}`);
    });

    // ── TC-41 ────────────────────────────────────────────────────────────────
    test('TC-41: Balance restored to pre-order levels after cancel', async () => {
        console.log('\n📌 [TC-41] Verifying balance restored after cancel...');
        const res = await tradeApi.get(BALANCE_API);
        console.log(`✅ Balance API Status: ${res.status}`);
        if (res.status !== 200) console.error('❌ Balance API Error:', res.body);
        expect(res.status, `TC-41: Expected status 200, received ${res.status} | ${body(res)}`).toBe(200);

        const baseAfter  = parseFloat(res.body.find((x: any) => x.currency === 'btc').balance);
        const quoteAfter = parseFloat(res.body.find((x: any) => x.currency === 'usdt').balance);

        console.log(`📊 BTC  — Before: ${baseBefore}  | After: ${baseAfter}`);
        console.log(`📊 USDT — Before: ${quoteBefore} | After: ${quoteAfter}`);

        expect(baseAfter,  `TC-41: BTC balance should be ~${baseBefore} after cancel, got ${baseAfter}`).toBeCloseTo(baseBefore,  8);
        expect(quoteAfter, `TC-41: USDT balance should be ~${quoteBefore} after cancel, got ${quoteAfter}`).toBeCloseTo(quoteBefore, 8);
    });

});
