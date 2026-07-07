import { test, expect } from '../../src/fixtures/pagefixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { PortfolioSpotPage } from '../../src/pages/portfolio/spot';
import { CsvHelper } from '../../src/utils/CsvHelper';
import { MarketDataHelper } from '../../src/utils/MarketDataHelper';
import { CoinMarketCapHelper } from '../../src/utils/CoinMarketCapHelper';
import {
    CoinDetailPage,
    CHART_PERIODS,
    MARKET_STATS,
    LIVE_STATS,
    MarketStat,
} from '../../src/pages/portfolio/coinDetail';
import type { Browser, BrowserContext, Page } from '@playwright/test';

const coinData = CsvHelper.readCsv('src/data/coinDetailData.csv');

// First coin (Tether USDT) used for chart and platform-wide tests to avoid
// repeating external navigations for functionality identical across all coins.
const primaryCoin = coinData[0];

// Maps each market stat label to the CSV column that holds its expected tooltip text.
// To support a new stat: add it to MARKET_STATS in coinDetail.ts, add the matching column
// to coinDetailData.csv, and add the entry here — no other code changes needed.
const STAT_TOOLTIP_COLUMN: Record<MarketStat, string> = {
    'Market cap':         'tooltipMarketCap',
    'Volume (24h)':       'tooltipVolume24h',
    'Circulating supply': 'tooltipCirculatingSupply',
    'Popularity':         'tooltipPopularity',
};

let browser:           Browser;
let context:           BrowserContext;
let page:              Page;
let loginPage:         LoginPage;
let portfolioSpotPage: PortfolioSpotPage;
let coinDetailPage:    CoinDetailPage;

// Single shared login (one browser/context/page for the whole file) instead of re-logging in fresh
// before every test — 12 fresh logins across 4 parallel workers were hammering the same staging
// account/server concurrently, which pushed the beforeEach hook past its 30s timeout on almost every test.
// mode: 'default' (not .serial()) keeps all 12 tests in this one worker/login but — like expect.soft
// within a test — lets every test run independently: one test failing does not skip the rest.
test.describe('Portfolio Module — Coin Detail Page', () => {
    test.describe.configure({ mode: 'default' });

    test.beforeAll(async ({ playwright }, testInfo) => {
        test.setTimeout(60000); // login can be slow if a prior worker had to restart mid-file
        browser           = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context           = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
        page              = await context.newPage();
        loginPage         = new LoginPage(page);
        portfolioSpotPage = new PortfolioSpotPage(page);
        coinDetailPage    = new CoinDetailPage(page);
        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!);
        await portfolioSpotPage.goToSpotTab();
    });

    test.afterAll(async () => { await browser.close(); });

// ─── Header ──────────────────────────────────────────────────────────────────

test('coin detail page shows coin name, Overview tab and Primary balance tab', async () => {
    for (const item of coinData) {
        await coinDetailPage.goToCoinDetail(item.name);

        const r = await coinDetailPage.getHeaderElementsStatus(item.displayName);
        expect.soft(r.nameVisible,              `${item.displayName} — coin name heading on detail page`).toBe('visible');
        expect.soft(r.overviewTabVisible,       `${item.displayName} — "Overview" tab`).toBe('visible');
        expect.soft(r.primaryBalanceTabVisible, `${item.displayName} — "Primary balance" tab`).toBe('visible');

        await coinDetailPage.goBackToSpot();
    }
});

// ─── Price ───────────────────────────────────────────────────────────────────

test('coin detail page shows a live price and a price change percentage', async () => {
    for (const item of coinData) {
        await coinDetailPage.goToCoinDetail(item.name);

        const r = await coinDetailPage.getPriceElementsStatus(item.displayName);
        expect.soft(r.priceChangeVisible, `${item.displayName} — current price element should be visible`).toBe('visible');
        expect.soft(r.priceVisible,       `${item.displayName} — price change percentage should be visible`).toBe('visible');

        await coinDetailPage.goBackToSpot();
    }
});

test('live price is within the expected range defined in CSV and must be positive', async () => {
    // Arrange: fetch live Binance prices via CoinGecko once before any navigation
    const cgIds    = coinData.map(c => c.coingeckoId).filter(Boolean);
    const liveData = await MarketDataHelper.fetchMarketData(cgIds);

    for (const item of coinData) {
        // Act
        await coinDetailPage.goToCoinDetail(item.name);
        const r = await coinDetailPage.checkLivePriceAgainstBinance(
            parseFloat(item.priceMin),
            parseFloat(item.priceMax),
            liveData.get(item.coingeckoId),
            item.displayName,
        );

        // Assert
        if (parseFloat(item.priceMin) > 0) {
            expect.soft(r.positiveStatus, r.positiveMsg).toBe('positive');
        }
        expect.soft(r.rangeStatus, r.rangeMsg).toBe('in range');
        if (r.hasBinanceData) {
            expect.soft(r.priceTolStatus,  r.priceTolMsg).toBe(r.priceTolExpected);
            expect.soft(r.changeTolStatus, r.changeTolMsg).toBe(r.changeTolExpected);
        }

        await coinDetailPage.goBackToSpot();
    }
});

// ─── Chart time filters ───────────────────────────────────────────────────────

test('all five chart time period buttons are visible', async () => {
    await coinDetailPage.goToCoinDetail(primaryCoin.name);

    for (const period of CHART_PERIODS) {
        const status = await coinDetailPage.getChartPeriodVisibilityStatus(period);
        expect.soft(
            status,
            `Chart period button "${period}" should be visible on ${primaryCoin.displayName} detail page`,
        ).toBe('visible');
    }

    await coinDetailPage.goBackToSpot();
});

test('clicking each chart time period keeps chart visible and marks period as active', async () => {
    await coinDetailPage.goToCoinDetail(primaryCoin.name);

    for (const period of CHART_PERIODS) {
        const r = await coinDetailPage.clickChartPeriodAndGetStatus(period);
        expect.soft(r.chartVisible, `Chart should remain visible after selecting "${period}" period`).toBe('visible');
        expect.soft(
            r.periodActive,
            `"${period}" button should be in active/selected state after clicking\n` +
            `  (Checks CSS class or aria-checked — adjust selector if framework differs)`,
        ).toBe('active');
    }

    await coinDetailPage.goBackToSpot();
});

// ─── Market stats ─────────────────────────────────────────────────────────────

test('market stats section with all four stat labels is visible', async () => {
    for (const item of coinData) {
        await coinDetailPage.goToCoinDetail(item.name);

        const sectionStatus = await coinDetailPage.getMarketStatsSectionVisibilityStatus();
        expect.soft(sectionStatus, `${item.displayName} — "Market stats" section heading`).toBe('visible');

        for (const stat of MARKET_STATS) {
            const labelStatus = await coinDetailPage.getMarketStatLabelVisibilityStatus(stat, item.displayName);
            expect.soft(labelStatus, `${item.displayName} — Market stat label "${stat}"`).toBe('visible');
        }

        await coinDetailPage.goBackToSpot();
    }
});

test('market stats info icons are visible, show a tooltip, and tooltip text matches CSV', async () => {
    test.setTimeout(120000);

    for (const item of coinData) {
        await coinDetailPage.goToCoinDetail(item.name);

        for (const stat of MARKET_STATS) {
            const csvColumn       = STAT_TOOLTIP_COLUMN[stat];
            const expectedTooltip = (item[csvColumn] ?? '').trim();

            // Act
            const r = await coinDetailPage.checkMarketStatTooltip(stat, expectedTooltip, item.displayName);

            // Assert
            expect.soft(r.iconVisible, `${item.displayName} — info icon next to "${stat}" label`).toBe('visible');

            if (r.iconVisible === 'visible') {
                expect.soft(
                    r.tooltipVisible,
                    `${item.displayName} — tooltip should appear when hovering the "${stat}" info icon`,
                ).toBe('visible');

                if (r.tooltipVisible === 'visible') {
                    if (r.hasCsvText) {
                        expect.soft(
                            r.tooltipStatus,
                            `${item.displayName} — "${stat}" tooltip text must match CSV column "${csvColumn}"\n` +
                            `  Expected : "${expectedTooltip}"\n` +
                            `  Received : "${r.tooltipText}"`,
                        ).toBe(expectedTooltip);
                    } else {
                        expect.soft(
                            r.tooltipStatus,
                            `${item.displayName} — "${stat}" tooltip text should not be empty`,
                        ).toBe('has content');
                    }
                }
            }
        }

        await coinDetailPage.goBackToSpot();
    }
});

// ─── Market stats live values + volume change % + popularity rank ─────────────

// Market cap, Volume (24h), and Circulating supply are live market data. The test:
//   1. Fetches current values from CoinGecko's public API once before any navigation.
//   2. Additionally fetches Volume (24h) from CoinMarketCap: CoinGecko's "total_volume" discounts
//      some exchange volume as low-trust and can diverge from Knooz's own number by 40-80%+,
//      while Knooz's figure tracks CoinMarketCap closely (confirmed by direct comparison) — so
//      Volume (24h) is checked against CoinMarketCap, Market cap/Circulating supply against
//      CoinGecko (those already match well there).
//   3. Compares what the page displays against the live reference value within ±25%
//      (Market cap/Circulating supply) or ±2% (Volume, now a same-methodology comparison).
//   4. Still asserts a non-empty numeric value for every coin regardless of API data.
//   5. Validates the Volume 24h change % is a real number within a sane range
//      (no free API provides this directly — we parse it from the page display).
//
// Popularity is an admin-assigned rank stored per coin in the CSV.
test('market stats show valid live values and popularity rank matches CSV', async () => {
    test.setTimeout(90000);

    // Arrange: fetch live reference data once before any page navigation
    const cgIds         = coinData.map(c => c.coingeckoId).filter(Boolean);
    const liveData       = await MarketDataHelper.fetchMarketData(cgIds);
    const cmcIds         = coinData.map(c => c.cmcId).filter(Boolean);
    const cmcVolumeData  = await CoinMarketCapHelper.fetchVolumeData(cmcIds);

    for (const item of coinData) {
        await coinDetailPage.goToCoinDetail(item.name);
        const cgLive = item.coingeckoId ? liveData.get(item.coingeckoId) : undefined;
        const cmcVol = item.cmcId ? cmcVolumeData.get(item.cmcId) : undefined;
        // Swap in CoinMarketCap's volume when available; keep CoinGecko for market cap/circulating supply.
        const live = cgLive && cmcVol ? { ...cgLive, volume24h: cmcVol.volume24h } : cgLive;

        // ── Live market stats ────────────────────────────────────────────────────
        for (const stat of LIVE_STATS) {
            const r = await coinDetailPage.checkMarketStatLiveValue(stat, live, item.displayName);
            expect.soft(r.nonEmptyStatus, r.nonEmptyMsg).toBe('valid');
            if (r.hasLiveData) {
                expect.soft(r.liveStatus, r.liveMsg).toBe(r.liveExpected);
            }
        }

        // ── Volume (24h) change % — sanity range check only (see method doc) ─────
        const vcr = await coinDetailPage.checkVolumeChange24hPercent(item.displayName);
        if (vcr.hasValue) {
            expect.soft(vcr.sanityStatus, vcr.sanityMsg).toBe('sane');
        }

        // ── Popularity rank (admin-assigned, stored in CSV per coin) ─────────────
        const pr = await coinDetailPage.checkPopularityRank(item.popularity, item.displayName);
        if (pr.hasExpected) {
            expect.soft(pr.actualRank, pr.rankMsg).toBe(pr.expectedRank);
        } else {
            expect.soft(pr.hasValueStatus, pr.valueMsg).toBe('has value');
        }

        await coinDetailPage.goBackToSpot();
    }
});

// ─── Overview text section ────────────────────────────────────────────────────

test('overview text section is visible and content matches expected text from CSV', async () => {
    for (const item of coinData) {
        await coinDetailPage.goToCoinDetail(item.name);

        // Act
        const r = await coinDetailPage.checkOverviewSection(item.displayName);

        // Assert
        expect.soft(
            r.sectionVisible,
            `${item.displayName} — overview text paragraph (div.scrollportfolio > section.cointdetailPage_tabs_textlineRight > p)`,
        ).toBe('visible');

        if (r.sectionVisible === 'visible') {
            if (item.overviewText.trim().length > 0) {
                expect.soft(
                    r.actualText,
                    `${item.displayName} — overview text must match the expected value in coinDetailData.csv\n` +
                    `  Expected (CSV) : "${item.overviewText.trim()}"\n` +
                    `  Received (page): "${r.actualText}"`,
                ).toBe(item.overviewText.trim());
            } else {
                expect.soft(
                    r.contentStatus,
                    `${item.displayName} — overview text paragraph should not be empty`,
                ).toBe('has content');

                if (r.contentStatus === 'has content') {
                    const rowIndex = coinData.indexOf(item);
                    CsvHelper.updateRow('src/data/coinDetailData.csv', rowIndex, 'overviewText', r.actualText);
                    console.log(`[CoinDetail] "${item.displayName}" overview text captured to CSV (row ${rowIndex})`);
                }
            }
        }

        await coinDetailPage.goBackToSpot();
    }
});

// ─── Resources section ────────────────────────────────────────────────────────

test('Resources section shows Whitepaper and Official Website links', async () => {
    test.setTimeout(90000);

    for (const item of coinData) {
        await coinDetailPage.goToCoinDetail(item.name);

        // Act: scroll + collect all three states in one call
        const r = await coinDetailPage.checkResourcesSection(item.displayName);

        // Assert: each error message shows the other two elements for context
        expect.soft(
            r.sectionVisible,
            `${item.displayName} — section heading (searched exact text: "RESOURCES")\n` +
            `  Whitepaper link visible  : ${r.whitepaperVisible === 'visible'}\n` +
            `  Official website visible : ${r.websiteVisible === 'visible'}`,
        ).toBe('visible');

        expect.soft(
            r.whitepaperVisible,
            `${item.displayName} — link (searched exact text: "Whitepaper")\n` +
            `  RESOURCES heading visible : ${r.sectionVisible === 'visible'}`,
        ).toBe('visible');

        expect.soft(
            r.websiteVisible,
            `${item.displayName} — link (searched exact text: "Official website")\n` +
            `  RESOURCES heading visible : ${r.sectionVisible === 'visible'}`,
        ).toBe('visible');

        await coinDetailPage.goBackToSpot();
    }
});

// ─── Whitepaper link opens in new tab ─────────────────────────────────────────

test('clicking Whitepaper opens the document in a new browser tab', async () => {
    test.setTimeout(120000);

    for (const item of coinData) {
        await coinDetailPage.goToCoinDetail(item.name);
        await coinDetailPage.scrollToResources();

        const isVisible = await coinDetailPage.isWhitepaperLinkVisible();
        expect.soft(
            isVisible ? 'visible' : 'not visible',
            `${item.displayName} — link (searched exact text: "Whitepaper") should be visible on the Resources section`,
        ).toBe('visible');
        if (!isVisible) {
            await coinDetailPage.goBackToSpot();
            continue;
        }

        // Act
        const r = await coinDetailPage.checkWhitepaperTab(item.whitepaperUrlContains, item.displayName);

        // Assert
        expect.soft(r.tabOpened,  r.tabOpenedMsg).toBe('opened');
        if (r.hasUrlFragment) {
            expect.soft(r.urlMatches, r.urlMatchesMsg).toBe('correct url');
        }
        if (!r.isPdf) {
            expect.soft(r.titleStatus, r.titleMsg).toBe('has title');
        }

        await coinDetailPage.goBackToSpot();
    }
});

// ─── Official Website link opens in new tab with correct coin branding ────────

test('clicking Official Website opens the correct coin site in a new tab with its own favicon', async () => {
    test.setTimeout(120000);

    for (const item of coinData) {
        await coinDetailPage.goToCoinDetail(item.name);
        await coinDetailPage.scrollToResources();

        const isVisible = await coinDetailPage.isOfficialWebsiteLinkVisible();
        expect.soft(
            isVisible ? 'visible' : 'not visible',
            `${item.displayName} — link (searched exact text: "Official website") should be visible on the Resources section`,
        ).toBe('visible');
        if (!isVisible) {
            await coinDetailPage.goBackToSpot();
            continue;
        }

        // Act
        const r = await coinDetailPage.checkOfficialWebsiteTab(
            item.officialWebsiteContains,
            item.websiteTitleContains,
            item.displayName,
        );

        // Assert
        expect.soft(r.tabOpened,  r.tabOpenedMsg).toBe('opened');
        if (r.hasUrlDomain) {
            expect.soft(r.urlMatches, r.urlMatchesMsg).toBe('correct site');
        }
        expect.soft(r.hasTitle, r.hasTitleMsg).toBe('has title');
        if (r.hasTitleFragment) {
            expect.soft(r.titleMatches, r.titleMatchesMsg).toBe('correct title');
        }
        expect.soft(r.hasFavicon, r.hasFaviconMsg).toBe('has favicon');
        if (r.hasOwnFaviconCheck) {
            expect.soft(
                r.ownFaviconStatus,
                r.ownFaviconMsg,
            ).toBe(`coin domain favicon (${item.officialWebsiteContains.toLowerCase()})`);
        }

        await coinDetailPage.goBackToSpot();
    }
});

});
