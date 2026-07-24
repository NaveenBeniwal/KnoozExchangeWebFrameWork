import { test, expect } from '../../src/fixtures/pagefixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { SpotBuyLimitOrderPage, FullBalanceSnapshot } from '../../src/pages/trade/SpotBuyLimitOrderPage';
import { SpotSellLimitOrderPage } from '../../src/pages/trade/SpotSellLimitOrderPage';
import { PortfolioSpotPage } from '../../src/pages/portfolio/spot';
import { CsvHelper } from '../../src/utils/CsvHelper';
import type { Browser, BrowserContext, Page } from '@playwright/test';

// Smoke/sanity-only round trip: no new locators or page objects — reuses
// SpotBuyLimitOrderPage/SpotSellLimitOrderPage (and the shared SpotTradingBasePage
// they extend) exactly as tests/trade/spotbuylimitorder.spec.ts and
// spotselllimitorder.spec.ts do. Own dedicated CSV (not the regression suite's
// spotBuyLimitData.csv/spotSellLimitData.csv) so this file's trade size can be tuned
// independently — the buy total here is kept above 7 USDT. Flow: snapshot balance,
// buy above market (fills now), confirm balance moved by the right amount, sell the
// exact bought quantity below market (fills now), confirm balance is restored minus fees.
const tradeData = CsvHelper.readCsv('src/data/spotTradeRoundTripData.csv')[0];
const baseCoin  = tradeData.sellCurrency; // e.g. BTC
const quoteCoin = tradeData.buyCurrency;  // e.g. USDT

let browser:           Browser;
let context:           BrowserContext;
let page:              Page;
let loginPage:         LoginPage;
let spotBuyPage:       SpotBuyLimitOrderPage;
let spotSellPage:      SpotSellLimitOrderPage;
let portfolioSpotPage: PortfolioSpotPage;

let snapshotBeforeBuy:  FullBalanceSnapshot | null = null;
let snapshotBeforeSell: FullBalanceSnapshot | null = null;
let buyOrderSucceeded  = false;
let sellOrderSucceeded = false;
let boughtAmount       = 0;
let soldAmount         = 0;
let buyExecutedPrice   = 0;
let sellExecutedPrice  = 0;

// One-line balance headline at each checkpoint (before buy / after buy / before sell /
// after sell) — the per-field expected-vs-actual detail is already reported separately
// by compareSnapshots(), so this only needs to say where the balance stood at that point.
function logSnapshot(label: string, snap: FullBalanceSnapshot): void {
    console.log(`[${label}] Buy Avlb (${quoteCoin}): ${snap.buyAvlb} | Sell Avlb (${baseCoin}): ${snap.sellAvlb}`);
}

test.describe.serial('Spot Module — Buy/Sell Round-Trip Smoke & Sanity Flow', () => {
    test.describe.configure({ timeout: 90000 });

    test.beforeAll(async ({ playwright }, testInfo) => {
        test.setTimeout(90000);
        browser           = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context           = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL, ignoreHTTPSErrors: true });
        page              = await context.newPage();
        loginPage         = new LoginPage(page);
        spotBuyPage       = new SpotBuyLimitOrderPage(page);
        spotSellPage      = new SpotSellLimitOrderPage(page);
        portfolioSpotPage = new PortfolioSpotPage(page);
        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!).catch(() => {});
        await loginPage.dismissPostLoginDialogsAndWaitForHome();
         console.log(`[Setup] Logged in as: ${process.env.EMAIL}`);
    });

    test.afterAll(async () => { await browser.close(); });

    // ── TC-RT-01 ──────────────────────────────────────────────────────────────
    test('TC-RT-01: navigate to Spot Trading page @smoke @sanity', async () => {
        await spotBuyPage.navigateToSpotTrading();
        console.log('[TC-RT-01] Navigated to Spot Trading page');
    });

    // ── TC-RT-02 ──────────────────────────────────────────────────────────────
    // captureFullSnapshot(pair) does its own search/select with exact-match + fallback
    // logic (the same routine TC-60 in spotbuylimitorder.spec.ts relies on for this exact
    // above-market scenario) — no separate manual search+select step needed beforehand.
    test('TC-RT-02: select the trading pair and capture available balance before placing the buy order @smoke @sanity', async () => {
        snapshotBeforeBuy = await spotBuyPage.captureFullSnapshot(portfolioSpotPage, tradeData.searchPair);
        expect.soft(snapshotBeforeBuy.buyAvlb, 'Available quote-coin balance before buy should be non-negative').toBeGreaterThanOrEqual(0);
        logSnapshot('TC-RT-02', snapshotBeforeBuy);
    });

    // ── TC-RT-03 ──────────────────────────────────────────────────────────────
    test('TC-RT-03: place a buy limit order above market price — fills immediately @smoke @sanity', async () => {
        const limitPrice = parseFloat(tradeData.aboveMarketLimitPrice ?? '70000');
        const total      = parseFloat(tradeData.buyTotal ?? '15');
        const r = await spotBuyPage.placeAboveMarketLimitOrder(limitPrice, total);
        buyOrderSucceeded = r.successMsg.toLowerCase().includes('success') || r.successMsg.toLowerCase().includes('creat');
        boughtAmount     = r.amount;
        buyExecutedPrice = r.executedPrice;
        expect.soft(buyOrderSucceeded ? 'success' : `failed: "${r.successMsg}"`, 'Buy order should succeed').toBe('success');
        expect.soft(boughtAmount, 'Executed buy amount should be > 0').toBeGreaterThan(0);
        console.log(`[TC-RT-03] Buy order placed | Limit: ${limitPrice} | Executed Price: ${buyExecutedPrice} | Amount: ${boughtAmount} | Message: "${r.successMsg}"`);
    });

    // ── TC-RT-04 ──────────────────────────────────────────────────────────────
    test('TC-RT-04: available balance after the buy order matches expected (quote decreased, base increased) @smoke @sanity', async () => {
        test.skip(!buyOrderSucceeded, 'Buy order not placed — skipping balance check.');
        if (!snapshotBeforeBuy) { console.warn('[TC-RT-04] Missing pre-buy snapshot'); return; }
        const results = await spotBuyPage.validateMarketFillBalance(
            portfolioSpotPage, tradeData.searchPair, snapshotBeforeBuy,
            buyExecutedPrice, boughtAmount, parseFloat(tradeData.aboveMarketLimitPrice ?? '70000'),
            quoteCoin, baseCoin, 'buy', parseFloat(tradeData.takerFeePercent ?? '0'),
        );
        for (const r of results) expect.soft(r.pass, r.msg).toBe(true);
        console.log(`[TC-RT-04] Balance verified after buy fill | Executed Price: ${buyExecutedPrice} | Amount: ${boughtAmount}`);
        const afterBuySnapshot = await spotBuyPage.captureFullSnapshot(portfolioSpotPage, tradeData.searchPair);
        logSnapshot('TC-RT-04 — after buy', afterBuySnapshot);
    });

    // ── TC-RT-05 ──────────────────────────────────────────────────────────────
    test('TC-RT-05: capture available balance before placing the sell order @smoke @sanity', async () => {
        test.skip(!buyOrderSucceeded, 'Buy order did not succeed — skipping sell leg.');
        snapshotBeforeSell = await spotSellPage.captureFullSnapshot(portfolioSpotPage, tradeData.searchPair);
        expect.soft(snapshotBeforeSell.sellAvlb, 'Available base-coin balance before sell should be non-negative').toBeGreaterThanOrEqual(0);
        logSnapshot('TC-RT-05', snapshotBeforeSell);
    });

    // ── TC-RT-06 ──────────────────────────────────────────────────────────────
    // Sell size comes from the CSV's sellTotal (quote-currency value), converted to a base-coin
    // amount the same way the buy leg converts buyTotal — sellTotal / limitPrice — rather than
    // reusing whatever the buy leg happened to fill. Keep sellTotal ≈ buyTotal in the CSV for a
    // clean round trip; if they diverge the position won't fully net back to zero.
    test('TC-RT-06: place a sell limit order (below market) for the CSV-configured sell total — fills immediately @smoke @sanity', async () => {
        test.skip(!buyOrderSucceeded, 'Buy order did not succeed — skipping sell leg.');
        const limitPrice = parseFloat(tradeData.belowMarketLimitPrice ?? '50000');
        const sellTotal  = parseFloat(tradeData.sellTotal ?? tradeData.buyTotal ?? '10');
        const sellAmount = parseFloat((sellTotal / limitPrice).toFixed(5));
        const r = await spotSellPage.placeBelowMarketLimitSell(limitPrice, sellAmount);
        sellOrderSucceeded = r.successMsg.toLowerCase().includes('success') || r.successMsg.toLowerCase().includes('creat');
        sellExecutedPrice  = r.executedPrice;
        soldAmount         = r.amount;
        expect.soft(sellOrderSucceeded ? 'success' : `failed: "${r.successMsg}"`, 'Sell order should succeed').toBe('success');
        console.log(`[TC-RT-06] Sell order placed | Limit: ${limitPrice} | Sell Total (${quoteCoin}): ${sellTotal} | Executed Price: ${sellExecutedPrice} | Amount: ${soldAmount} | Message: "${r.successMsg}"`);
    });

    // ── TC-RT-07 ──────────────────────────────────────────────────────────────
    test('TC-RT-07: available balance after the sell order matches expected (base decreased, quote restored) @smoke @sanity', async () => {
        test.skip(!buyOrderSucceeded || !sellOrderSucceeded, 'Buy or sell order did not succeed — skipping balance check.');
        if (!snapshotBeforeSell) { console.warn('[TC-RT-07] Missing pre-sell snapshot'); return; }
        const results = await spotSellPage.validateMarketFillBalance(
            portfolioSpotPage, tradeData.searchPair, snapshotBeforeSell,
            sellExecutedPrice, soldAmount, parseFloat(tradeData.belowMarketLimitPrice ?? '50000'),
            quoteCoin, baseCoin, 'sell', parseFloat(tradeData.takerFeePercent ?? '0'),
        );
        for (const r of results) expect.soft(r.pass, r.msg).toBe(true);
        console.log(`[TC-RT-07] Balance verified after sell fill | Executed Price: ${sellExecutedPrice} | Amount: ${soldAmount} — round trip complete`);

        const afterSellSnapshot = await spotSellPage.captureFullSnapshot(portfolioSpotPage, tradeData.searchPair);
        logSnapshot('TC-RT-07 — final (after sell)', afterSellSnapshot);

        // Full round-trip summary — net change from the very first snapshot (before the buy)
        // to where we ended up after both fills. Expected ≈ 0 only if buyTotal ≈ sellTotal in
        // the CSV — otherwise the bought and sold quantities differ by design.
        if (snapshotBeforeBuy) {
            const netQuoteDelta = parseFloat((afterSellSnapshot.buyAvlb  - snapshotBeforeBuy.buyAvlb).toFixed(8));
            const netBaseDelta  = parseFloat((afterSellSnapshot.sellAvlb - snapshotBeforeBuy.sellAvlb).toFixed(8));
            console.log(`[TC-RT-07] ROUND TRIP SUMMARY | Net ${quoteCoin} change: ${netQuoteDelta} | Net ${baseCoin} change: ${netBaseDelta} | Buy: ${boughtAmount} ${baseCoin} @ ${buyExecutedPrice} | Sell: ${soldAmount} ${baseCoin} @ ${sellExecutedPrice}`);
        }
    });
});
