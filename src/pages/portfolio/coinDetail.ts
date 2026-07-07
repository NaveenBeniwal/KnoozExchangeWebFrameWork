import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { MarketDataHelper, CoinMarketData } from '../../utils/MarketDataHelper';

export const CHART_PERIODS = ['1H', '1D', '1W', '1M', '1Y'] as const;
export type ChartPeriod = typeof CHART_PERIODS[number];

export const MARKET_STATS = ['Market cap', 'Volume (24h)', 'Circulating supply', 'Popularity'] as const;
export type MarketStat = typeof MARKET_STATS[number];

export const LIVE_STATS = ['Market cap', 'Volume (24h)', 'Circulating supply'] as const;
export type LiveStat = typeof LIVE_STATS[number];

export class CoinDetailPage extends BasePage {

    // ─── Locators ─────────────────────────────────────────────────────────────────

    private readonly portfolioSidebarButton: Locator;
    private readonly spotTab: Locator;
    private readonly overviewTab: Locator;
    private readonly primaryBalanceTab: Locator;
    private readonly priceChangeSup: Locator;
    private readonly chartArea: Locator;
    private readonly marketStatsHeading: Locator;
    private readonly marketCapInfoIcon: Locator;
    private readonly volume24hInfoIcon: Locator;
    private readonly circulatingSupplyInfoIcon: Locator;
    private readonly popularityInfoIcon: Locator;
    private readonly tooltipInner: Locator;
    private readonly overviewTextParagraph: Locator;
    private readonly resourcesHeading: Locator;
    private readonly whitepaperLink: Locator;
    private readonly officialWebsiteLink: Locator;

    // Tracks the last coin's raw price-change text so waitForPriceToStabilize() can tell a
    // genuinely-updated reading apart from the previous coin's value still lingering on screen.
    private lastPriceRawText: string | null = null;

    constructor(page: Page) {
        super(page);

        this.portfolioSidebarButton = page.getByText('Portfolio', { exact: true }).first();
        this.spotTab                = page.getByText('Spot', { exact: true }).first();
        this.overviewTab            = page.getByText('Overview', { exact: true }).first();
        this.primaryBalanceTab      = page.getByText('Primary balance', { exact: true });

        // Price change is always in <sup> (e.g. "+0.00%", "-1.23%").
        // The parent of this <sup> also contains the coin's dollar price.
        this.priceChangeSup = page.locator('sup').filter({ hasText: /%/ }).first();

        // ApexCharts SVG — ID suffix changes per render (e.g. SvgjsSvg5776); match by prefix
        this.chartArea = page.locator('[id^="SvgjsSvg"] > foreignobject').first();

        this.marketStatsHeading = page.getByText('Market stats', { exact: true });

        // Market stat info icons — nth indices confirmed via Playwright Inspector on live page
        this.marketCapInfoIcon         = page.getByRole('img', { name: 'icon' }).nth(2);
        this.volume24hInfoIcon         = page.getByRole('img', { name: 'icon' }).nth(3);
        this.circulatingSupplyInfoIcon = page.getByRole('img', { name: 'icon' }).nth(4);
        this.popularityInfoIcon        = page.getByRole('img', { name: 'icon' }).nth(5);

        // Ant Design keeps a closed tooltip's DOM node around (hidden) rather than removing it, so a
        // plain .first() stays pinned to the very first tooltip ever shown. Scope to :visible so each
        // hover picks up the tooltip that is actually on screen right now.
        this.tooltipInner          = page.locator('.ant-tooltip-inner:visible, [role="tooltip"]:visible').first();
        this.overviewTextParagraph = page.locator('div.scrollportfolio > section.cointdetailPage_tabs_textlineRight > p');
        this.resourcesHeading      = page.getByText('RESOURCES', { exact: true });
        // .last() confirmed via Playwright Inspector on the live page — an earlier duplicate
        // "Whitepaper"/"Official website" text node (unrelated to the Resources section) sits
        // before the real link, so .first() was clicking the wrong element.
        this.whitepaperLink        = page.getByText('Whitepaper', { exact: true }).last();
        this.officialWebsiteLink   = page.getByText('Official website', { exact: true }).last();
    }

    // ─── Navigation ──────────────────────────────────────────────────────────────

    async goToCoinDetail(coinName: string): Promise<void> {
        const row = this.page.locator('tr.ant-table-row').filter({ hasText: coinName }).first();
        const firstCell = row.locator('td.ant-table-cell').first();
        await firstCell.click();
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(500);
        await this.waitForPriceToStabilize();
        console.log(`[CoinDetail] Opened detail page for "${coinName}"`);
    }

    // The price/change <sup> is a persistent widget the SPA updates in place rather than
    // remounting on navigation, so reading it right after a route change can still catch the
    // PREVIOUS coin's cached value before the new coin's price arrives (confirmed live: e.g.
    // Bitcoin's page briefly still showed Tether's ~$1 price). A stale value can itself stay
    // constant across a couple of polls before the real update lands, so "two identical reads"
    // alone isn't proof — we also require the reading to differ from the previous coin's value.
    private async waitForPriceToStabilize(maxAttempts = 10, intervalMs = 400): Promise<void> {
        let previous = await this.priceChangeSup.textContent().catch(() => null);
        for (let i = 0; i < maxAttempts; i++) {
            await this.page.waitForTimeout(intervalMs);
            const current = await this.priceChangeSup.textContent().catch(() => null);
            const stableAcrossReads = current !== null && current === previous;
            const differsFromLastCoin = current !== this.lastPriceRawText;
            if (stableAcrossReads && differsFromLastCoin) {
                this.lastPriceRawText = current;
                return;
            }
            previous = current;
        }
        this.lastPriceRawText = previous;
    }

    // Re-navigate to Spot rather than page.goBack() — goBack() from coin detail
    // returns to Portfolio Overview (not the Spot tab) in this SPA.
    async goBackToSpot(): Promise<void> {
        await this.portfolioSidebarButton.click();
        await this.page.waitForLoadState('networkidle');
        // Wait for any loading overlay to clear before clicking the Spot tab.
        // Without this the loader-container div intercepts pointer events.
        await this.page.locator('.loader-container, .loader').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        await this.spotTab.click();
        await this.page.waitForTimeout(500);
        await this.page.waitForLoadState('networkidle');
        console.log('[CoinDetail] Returned to Spot page');
    }

    // ─── Header ──────────────────────────────────────────────────────────────────

    async isCoinNameVisible(displayName: string): Promise<boolean> {
        return this.page.getByText(displayName, { exact: true }).first().isVisible();
    }

    async isOverviewTabVisible(): Promise<boolean> {
        return this.overviewTab.isVisible();
    }

    async isPrimaryBalanceTabVisible(): Promise<boolean> {
        return this.primaryBalanceTab.isVisible();
    }

    // ─── Price ───────────────────────────────────────────────────────────────────

    async isPriceChangeDisplayVisible(): Promise<boolean> {
        return this.priceChangeSup.isVisible();
    }

    async isPriceVisible(): Promise<boolean> {
        // The dollar price lives in the parent of the % change sup
        return this.priceChangeSup.locator('xpath=..').isVisible();
    }

    async getCurrentPrice(): Promise<number> {
        // Parent contains both the dollar price text and the <sup> % change
        const container  = this.priceChangeSup.locator('xpath=..');
        const fullText   = (await container.textContent()) ?? '';
        const changeText = (await this.priceChangeSup.textContent()) ?? '';
        const priceOnly  = fullText.replace(changeText, '').trim();
        const match      = priceOnly.match(/\$([\d,]+\.?\d*)/);
        const price      = match ? parseFloat(match[1].replace(/,/g, '')) : 0;
        console.log(`[CoinDetail] Live price: $${price} (raw: "${fullText.trim()}")`);
        return price;
    }

    // Returns the raw price-change text exactly as the page renders it, e.g. "+0.52%" or "-1.23%".
    async getPriceChangeRaw(): Promise<string> {
        return ((await this.priceChangeSup.textContent()) ?? '').trim();
    }

    // Returns the 24h price change as a signed number, e.g. +0.52 or -1.23 (percent points).
    async getPriceChangePercent(): Promise<number> {
        const raw   = await this.getPriceChangeRaw();
        const match = raw.match(/([+\-]?\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : 0;
    }

    // ─── Chart time filters ───────────────────────────────────────────────────────

    private getChartPeriodButton(period: ChartPeriod): Locator {
        return this.page.getByText(period, { exact: true }).first();
    }

    async isChartPeriodVisible(period: ChartPeriod): Promise<boolean> {
        return this.getChartPeriodButton(period).isVisible();
    }

    async clickChartPeriod(period: ChartPeriod): Promise<void> {
        console.log(`[CoinDetail] Switching chart to "${period}"`);
        await this.getChartPeriodButton(period).click();
        await this.page.waitForTimeout(1000);
    }

    async isChartPeriodActive(period: ChartPeriod): Promise<boolean> {
        const antActive = this.page
            .locator('.ant-radio-button-wrapper-checked, [aria-checked="true"]')
            .filter({ hasText: period });
        if (await antActive.count() > 0) return true;

        const btn = this.getChartPeriodButton(period);
        return btn.evaluate((node: Element) => {
            const active = (e: Element | null): boolean => {
                if (!e) return false;
                const cls = (e.getAttribute('class') ?? '').toLowerCase();
                return cls.includes('active') || cls.includes('selected') || cls.includes('checked') ||
                    e.getAttribute('aria-selected') === 'true' ||
                    e.getAttribute('aria-checked')  === 'true';
            };
            return active(node) ||
                active(node.parentElement) ||
                (node.parentElement ? active(node.parentElement.parentElement) : false);
        });
    }

    async isChartVisible(): Promise<boolean> {
        const count = await this.chartArea.count();
        if (count === 0) return false;
        return this.chartArea.isVisible();
    }

    // ─── Market stats ─────────────────────────────────────────────────────────────

    async isMarketStatsSectionVisible(): Promise<boolean> {
        return this.marketStatsHeading.isVisible();
    }

    async isMarketStatLabelVisible(label: MarketStat): Promise<boolean> {
        return this.page.getByText(label, { exact: true }).first().isVisible();
    }

    private getStatInfoIcon(label: MarketStat): Locator {
        const map: Record<MarketStat, Locator> = {
            'Market cap':         this.marketCapInfoIcon,
            'Volume (24h)':       this.volume24hInfoIcon,
            'Circulating supply': this.circulatingSupplyInfoIcon,
            'Popularity':         this.popularityInfoIcon,
        };
        return map[label];
    }

    async isMarketStatInfoIconVisible(label: MarketStat): Promise<boolean> {
        return this.getStatInfoIcon(label).isVisible();
    }

    async hoverMarketStatInfoIcon(label: MarketStat): Promise<void> {
        await this.getStatInfoIcon(label).hover();
        await this.page.waitForTimeout(400);
    }

    async isTooltipVisible(_label: MarketStat): Promise<boolean> {
        return this.tooltipInner.isVisible();
    }

    async dismissTooltip(): Promise<void> {
        await this.page.mouse.move(0, 0);
        await this.page.waitForTimeout(300);
    }

    async getTooltipText(_label: MarketStat): Promise<string> {
        return ((await this.tooltipInner.textContent()) ?? '').trim();
    }

    async getMarketStatValue(label: MarketStat): Promise<string> {
        const row = this.page.locator('tr').filter({ hasText: label }).first();
        if (await row.count() > 0) {
            const cells = row.locator('td');
            if (await cells.count() >= 2) {
                return ((await cells.nth(1).textContent()) ?? '').trim();
            }
        }
        const labelEl   = this.page.getByText(label, { exact: true }).first();
        const container = labelEl.locator('xpath=../..'); // two levels up for flex/grid layouts
        const text      = (await container.textContent()) ?? '';
        return text.replace(label, '').replace(/\s+/g, ' ').trim();
    }

    // Returns the popularity rank exactly as the page renders it: "# 1", "# 3", "# null".
    // Mirrors the locator Playwright Inspector reports: page.getByText('# 4', { exact: true }).
    // We don't know the rank value ahead of time so we use getByText with a "# " prefix pattern,
    // scoped to the Popularity label's container — same getByText style used throughout this file.
    async getPopularityRankText(): Promise<string> {
        const label     = this.page.getByText('Popularity', { exact: true }).first();
        const container = label.locator('xpath=../..'); // flex/grid parent holds label + rank value

        // getByText('# 4', { exact: true }) equivalent — finds any "# <word>" child element
        const rankEl = container.getByText(/^# /).first();
        if (await rankEl.count() > 0) {
            return ((await rankEl.textContent()) ?? '').replace(/\s+/g, ' ').trim();
        }

        // Fallback: strip the label from the full container text
        const full = ((await container.textContent()) ?? '').replace('Popularity', '').trim();
        return full.replace(/\s+/g, ' ');
    }

    // ─── Overview text section ────────────────────────────────────────────────────

    // 'Overview' appears twice on the page: first as the tab button, then as the
    // content section heading. We target the second occurrence to reach the section.
    async scrollToOverviewSection(): Promise<void> {
        const sections = this.page.getByText('Overview', { exact: true });
        const count    = await sections.count();
        if (count >= 2) await sections.nth(1).scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(300);
    }

    async isOverviewTextSectionVisible(): Promise<boolean> {
        const sections = this.page.getByText('Overview', { exact: true });
        const count    = await sections.count();
        if (count < 2) return false;
        return sections.nth(1).isVisible();
    }

    async getOverviewText(): Promise<string> {
        const texts = await this.overviewTextParagraph.allTextContents();
        return texts.join(' ').trim();
    }

    // ─── Resources section ────────────────────────────────────────────────────────

    async scrollToResources(): Promise<void> {
        // 5s timeout — if the section is absent the test body guards with isResourcesSectionVisible()
        await this.resourcesHeading.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {
            console.log('[CoinDetail] "Resources" heading not scrollable — section may be absent');
        });
        await this.page.waitForTimeout(300);
    }

    async isResourcesSectionVisible(): Promise<boolean> {
        return this.resourcesHeading.isVisible();
    }

    async isWhitepaperLinkVisible(): Promise<boolean> {
        return this.whitepaperLink.isVisible();
    }

    async isOfficialWebsiteLinkVisible(): Promise<boolean> {
        return this.officialWebsiteLink.isVisible();
    }

    // ─── New tab interactions ─────────────────────────────────────────────────────

    // Retries once on a browser-internal error page (e.g. chrome-error://chromewebdata/ from a
    // destination site's own transient SSL/TLS failure — confirmed live against bitcoin.com) before
    // accepting the result. Distinguishes "flaky external site, worked on retry" from "genuinely
    // broken link" without masking a real, persistent failure — the second attempt's result (error
    // page or not) is still what gets reported.
    private async openLinkNewTabWithRetry(link: Locator, label: string): Promise<Page> {
        for (let attempt = 1; attempt <= 2; attempt++) {
            const [newPage] = await Promise.all([
                this.page.context().waitForEvent('page'),
                link.click(),
            ]);
            await newPage.waitForLoadState('domcontentloaded');
            const url = newPage.url();
            console.log(`[CoinDetail] ${label} tab URL (attempt ${attempt}): ${url}`);
            if (!url.startsWith('chrome-error://') || attempt === 2) return newPage;
            console.log(`[CoinDetail] ${label} hit a browser error page — retrying once`);
            await newPage.close();
            await this.page.waitForTimeout(1000);
        }
        throw new Error(`unreachable: ${label} retry loop should always return`);
    }

    async clickWhitepaperAndGetNewTab(): Promise<Page> {
        return this.openLinkNewTabWithRetry(this.whitepaperLink, 'Whitepaper');
    }

    async clickOfficialWebsiteAndGetNewTab(): Promise<Page> {
        return this.openLinkNewTabWithRetry(this.officialWebsiteLink, 'Official website');
    }

    async getPageTitle(targetPage: Page): Promise<string> {
        return targetPage.title();
    }

    async getFaviconUrls(targetPage: Page): Promise<string[]> {
        return targetPage.evaluate(() =>
            Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]'))
                .map(l => l.href)
                .filter(h => h.length > 0)
        );
    }

    // ─── AAA check methods — page does all computation, spec only asserts ─────────

    // Standard 3-line trace for every interactive check: what we did, what we expected, what we got.
    private logStep(step: string, expected: string, actual: string): void {
        console.log(
            `[CoinDetail] Step     : ${step}\n` +
            `[CoinDetail] Expected : ${expected}\n` +
            `[CoinDetail] Actual   : ${actual}`
        );
    }

    async getHeaderElementsStatus(displayName: string): Promise<{
        nameVisible:              'visible' | 'not visible';
        overviewTabVisible:       'visible' | 'not visible';
        primaryBalanceTabVisible: 'visible' | 'not visible';
    }> {
        const [name, overview, balance] = await Promise.all([
            this.isCoinNameVisible(displayName),
            this.isOverviewTabVisible(),
            this.isPrimaryBalanceTabVisible(),
        ]);
        this.logStep(
            `Opened "${displayName}" detail page and checked the header`,
            'coin name, "Overview" tab and "Primary balance" tab all visible',
            `name: ${name} | overview tab: ${overview} | primary balance tab: ${balance}`,
        );
        return {
            nameVisible:              name    ? 'visible' : 'not visible',
            overviewTabVisible:       overview ? 'visible' : 'not visible',
            primaryBalanceTabVisible: balance  ? 'visible' : 'not visible',
        };
    }

    async getPriceElementsStatus(displayName: string): Promise<{
        priceChangeVisible: 'visible' | 'not visible';
        priceVisible:       'visible' | 'not visible';
    }> {
        const [change, price] = await Promise.all([
            this.isPriceChangeDisplayVisible(),
            this.isPriceVisible(),
        ]);
        this.logStep(
            `Opened "${displayName}" detail page and checked the price display`,
            'live price and 24h change % both visible',
            `price visible: ${price} | change % visible: ${change}`,
        );
        return {
            priceChangeVisible: change ? 'visible' : 'not visible',
            priceVisible:       price  ? 'visible' : 'not visible',
        };
    }

    async checkLivePriceAgainstBinance(
        priceMin: number,
        priceMax: number,
        live: CoinMarketData | undefined,
        displayName: string,
        priceTolerance = 0.02,
        // The page and Binance/CoinGecko each compute "24h change %" against their own rolling
        // 24h window, sampled a few seconds apart — during normal volatility that alone can cause
        // several points of drift even though the underlying price matches almost exactly. ±8pp
        // gives room for that natural timing/measurement gap without ignoring a genuinely wrong value.
        changeTolerance = 8,
    ): Promise<{
        price:             number;
        positiveStatus:    'positive' | 'zero or negative';
        positiveMsg:       string;
        rangeStatus:       'in range' | 'out of range';
        rangeMsg:          string;
        priceTolStatus:    string;
        priceTolExpected:  string;
        priceTolMsg:       string;
        changeTolStatus:   string;
        changeTolExpected: string;
        changeTolMsg:      string;
        hasBinanceData:    boolean;
    }> {
        const price         = await this.getCurrentPrice();
        const inRange       = price >= priceMin && price <= priceMax;
        const pageChangeRaw = await this.getPriceChangeRaw();
        const pageChange    = await this.getPriceChangePercent();

        const result = {
            price,
            positiveStatus:    (price > 0 ? 'positive' : 'zero or negative') as 'positive' | 'zero or negative',
            positiveMsg:       `${displayName} — price must be greater than zero\n  Received price: $${price}`,
            rangeStatus:       (inRange ? 'in range' : 'out of range') as 'in range' | 'out of range',
            rangeMsg:          `${displayName} — live price out of expected CSV range\n  Expected range : $${priceMin} – $${priceMax}\n  Received price : $${price}`,
            priceTolStatus:    '',
            priceTolExpected:  '',
            priceTolMsg:       '',
            changeTolStatus:   '',
            changeTolExpected: '',
            changeTolMsg:      '',
            hasBinanceData:    false,
        };

        if (live && live.currentPrice > 0) {
            result.hasBinanceData    = true;
            const priceOk            = MarketDataHelper.withinTolerance(price, live.currentPrice, priceTolerance);
            const priceDiff          = (price - live.currentPrice) / live.currentPrice * 100;
            const priceLow           = (live.currentPrice * (1 - priceTolerance)).toFixed(2);
            const priceHigh          = (live.currentPrice * (1 + priceTolerance)).toFixed(2);
            result.priceTolExpected  = `~$${live.currentPrice.toFixed(2)}`;
            result.priceTolStatus    = priceOk ? result.priceTolExpected : `$${price.toFixed(2)}`;
            result.priceTolMsg       =
                `${displayName} — page price diverges from Binance by more than ${priceTolerance * 100}%\n` +
                `  Expected : ~$${live.currentPrice.toFixed(2)}  (acceptable: $${priceLow} – $${priceHigh})\n` +
                `  Received : $${price.toFixed(2)}`;

            const liveChange          = live.priceChange24h;
            const changeOk            = Math.abs(pageChange - liveChange) <= changeTolerance;
            const changeGap           = pageChange - liveChange;
            result.changeTolExpected  = `~${liveChange.toFixed(2)}%`;
            result.changeTolStatus    = changeOk ? result.changeTolExpected : `${pageChange.toFixed(2)}%`;
            result.changeTolMsg       =
                `${displayName} — page 24h change % diverges from Binance by more than ${changeTolerance}pp\n` +
                `  Expected : ~${liveChange.toFixed(2)}%  (acceptable: ${(liveChange - changeTolerance).toFixed(2)}% – ${(liveChange + changeTolerance).toFixed(2)}%)\n` +
                `  Received : ${pageChangeRaw} → parsed as ${pageChange.toFixed(2)}%`;

            this.logStep(
                `Opened "${displayName}" detail page and read live price + 24h change %`,
                `price ≈ $${live.currentPrice.toFixed(2)} (±${priceTolerance * 100}%), change % ≈ ${liveChange.toFixed(2)}% (±${changeTolerance}pp), within CSV range $${priceMin}–$${priceMax}`,
                `price $${price.toFixed(2)} (diff ${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(3)}%), change ${pageChangeRaw} (gap ${changeGap >= 0 ? '+' : ''}${changeGap.toFixed(2)}pp)`,
            );
            console.log(
                `\n[CoinDetail] ── ${displayName} ──────────────────────────────\n` +
                `  Price    │ Page: $${price.toFixed(2).padStart(12)} │ Binance: $${live.currentPrice.toFixed(2).padStart(12)} │ Diff: ${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(3)}% │ ${priceOk ? '✓ within ±2%' : '✗ outside ±2%'}\n` +
                `  Change%  │ Page: ${pageChangeRaw.padStart(8)}   │ Binance: ${liveChange.toFixed(2).padStart(8)}%    │ Gap:  ${changeGap >= 0 ? '+' : ''}${changeGap.toFixed(2)}pp  │ ${changeOk ? `✓ within ±${changeTolerance}pp` : `✗ outside ±${changeTolerance}pp`}\n` +
                `  CSV Range│ $${priceMin} – $${priceMax} │ ${inRange ? '✓ in range' : '✗ out of range'}`
            );
        } else {
            console.log(
                `\n[CoinDetail] ── ${displayName} ──────────────────────────────\n` +
                `  Price    │ Page: $${price.toFixed(2)} │ Binance: N/A (data unavailable)\n` +
                `  Change%  │ Page: ${pageChangeRaw}\n` +
                `  CSV Range│ $${priceMin} – $${priceMax} │ ${inRange ? '✓ in range' : '✗ out of range'}`
            );
        }

        return result;
    }

    async getChartPeriodVisibilityStatus(period: ChartPeriod): Promise<'visible' | 'not visible'> {
        const isVisible = await this.isChartPeriodVisible(period);
        this.logStep(`Checked chart period button "${period}"`, 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible ? 'visible' : 'not visible';
    }

    async clickChartPeriodAndGetStatus(period: ChartPeriod): Promise<{
        chartVisible: 'visible' | 'not visible';
        periodActive: 'active' | 'not active';
    }> {
        await this.clickChartPeriod(period);
        const [chartVis, isActive] = await Promise.all([
            this.isChartVisible(),
            this.isChartPeriodActive(period),
        ]);
        this.logStep(
            `Clicked chart period button "${period}"`,
            'chart stays visible and the button becomes active',
            `chart visible: ${chartVis} | active: ${isActive}`,
        );
        return {
            chartVisible: chartVis ? 'visible' : 'not visible',
            periodActive: isActive ? 'active'  : 'not active',
        };
    }

    async getMarketStatsSectionVisibilityStatus(): Promise<'visible' | 'not visible'> {
        const isVisible = await this.isMarketStatsSectionVisible();
        return isVisible ? 'visible' : 'not visible';
    }

    async getMarketStatLabelVisibilityStatus(stat: MarketStat, displayName: string): Promise<'visible' | 'not visible'> {
        const isVisible = await this.isMarketStatLabelVisible(stat);
        this.logStep(`Checked "${stat}" stat label for "${displayName}"`, 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible ? 'visible' : 'not visible';
    }

    async checkMarketStatTooltip(
        stat: MarketStat,
        expectedTooltip: string,
        displayName: string,
    ): Promise<{
        iconVisible:    'visible' | 'not visible';
        tooltipVisible: 'visible' | 'not visible';
        tooltipText:    string;
        tooltipStatus:  string;
        hasCsvText:     boolean;
    }> {
        const isIconVisible = await this.isMarketStatInfoIconVisible(stat);
        const result = {
            iconVisible:    (isIconVisible ? 'visible' : 'not visible') as 'visible' | 'not visible',
            tooltipVisible: 'not visible' as 'visible' | 'not visible',
            tooltipText:    '',
            tooltipStatus:  'empty',
            hasCsvText:     expectedTooltip.length > 0,
        };

        if (isIconVisible) {
            await this.hoverMarketStatInfoIcon(stat);
            const isTooltipVisible = await this.isTooltipVisible(stat);
            result.tooltipVisible = isTooltipVisible ? 'visible' : 'not visible';

            if (isTooltipVisible) {
                result.tooltipText   = await this.getTooltipText(stat);
                result.tooltipStatus = result.hasCsvText
                    ? result.tooltipText
                    : (result.tooltipText.length > 0 ? 'has content' : 'empty');
                this.logStep(
                    `Hovered the "${stat}" info icon for "${displayName}"`,
                    result.hasCsvText ? `tooltip text: "${expectedTooltip}"` : 'a non-empty tooltip',
                    `tooltip text: "${result.tooltipText}"`,
                );
            }

            await this.dismissTooltip();
        }

        console.log(`[CoinDetail] "${displayName}" stat "${stat}" — icon visible: ${isIconVisible}`);
        return result;
    }

    private static readonly STAT_FIELD: Record<LiveStat, keyof CoinMarketData> = {
        'Market cap':         'marketCap',
        'Volume (24h)':       'volume24h',
        'Circulating supply': 'circulatingSupply',
    };

    // Volume (24h) is compared against CoinMarketCap (see checkMarketStatLiveValue caller), which
    // Knooz's own numbers track closely — confirmed live: Tether/Bitcoin/Ethereum all matched
    // within 2%. ±5% covers normal timing drift between when the page rendered and when we
    // sampled CMC (e.g. BNB was ~3.5% off due to this, not a real data gap) without going back to
    // the 40%+ margins CoinGecko needed — a failure at ±5% is still a genuine finding worth checking.
    private static readonly STAT_TOLERANCE: Record<LiveStat, number> = {
        'Market cap':         0.25,
        'Volume (24h)':       0.05,
        'Circulating supply': 0.10,
    };

    async checkMarketStatLiveValue(
        stat: LiveStat,
        live: CoinMarketData | undefined,
        displayName: string,
        tolerance = CoinDetailPage.STAT_TOLERANCE[stat],
    ): Promise<{
        nonEmptyStatus: 'valid' | 'invalid';
        nonEmptyMsg:    string;
        liveStatus:     string;
        liveExpected:   string;
        liveMsg:        string;
        hasLiveData:    boolean;
    }> {
        const pageRaw    = await this.getMarketStatValue(stat as MarketStat);
        const pageVal    = MarketDataHelper.parsePageValue(pageRaw);
        const isNonEmpty = pageRaw.length > 0 && /\d/.test(pageRaw);

        const result = {
            nonEmptyStatus: (isNonEmpty ? 'valid' : 'invalid') as 'valid' | 'invalid',
            nonEmptyMsg:    `${displayName} — "${stat}" must show a non-empty numeric value\n  Received: "${pageRaw || '(empty)'}"`,
            liveStatus:     '',
            liveExpected:   '',
            liveMsg:        '',
            hasLiveData:    false,
        };

        if (live) {
            result.hasLiveData   = true;
            const liveVal        = live[CoinDetailPage.STAT_FIELD[stat]] as number;
            const inTolerance    = MarketDataHelper.withinTolerance(pageVal, liveVal, tolerance);
            const isCurrency     = stat !== 'Circulating supply';
            const fmt            = (n: number) => MarketDataHelper.formatLargeNumber(n, isCurrency);
            result.liveExpected  = `~${fmt(liveVal)}  (acceptable: ${fmt(liveVal * (1 - tolerance))} – ${fmt(liveVal * (1 + tolerance))})`;
            result.liveStatus    = inTolerance ? result.liveExpected : `"${pageRaw}"  →  ${fmt(pageVal)}`;
            result.liveMsg       =
                `${displayName} — "${stat}" page value vs live market data (±${tolerance * 100}%)\n` +
                `  If the page shows "0", the page selector may need updating.`;

            this.logStep(
                `Read "${stat}" value for "${displayName}"`,
                result.liveExpected,
                `"${pageRaw}" → ${fmt(pageVal)} (${inTolerance ? 'OK ✓' : 'MISMATCH ✗'})`,
            );
        } else {
            this.logStep(
                `Read "${stat}" value for "${displayName}"`,
                'a live reference (add coingeckoId to CSV to enable live validation)',
                `"${pageRaw}" (no live reference available)`,
            );
        }

        return result;
    }

    // The Volume (24h) stat shows the trading volume with a 24h change % appended
    // (e.g. "$18B+39.3%"). That figure is how much the TRADING VOLUME moved, which is
    // an unrelated metric to the coin's PRICE change — no free API exposes a live
    // "volume change %" to compare against. So this only sanity-checks that the parsed
    // number is a real, plausible percentage, per the original design intent.
    async checkVolumeChange24hPercent(
        displayName: string,
        minPct = -100,
        maxPct = 100000,
    ): Promise<{
        changePercent: number | null;
        hasValue:      boolean;
        sanityStatus:  'sane' | 'insane';
        sanityMsg:     string;
    }> {
        const raw      = await this.getMarketStatValue('Volume (24h)');
        const pct      = MarketDataHelper.parseChangePercent(raw);
        const hasValue = pct !== null;
        const isSane   = hasValue && (pct as number) >= minPct && (pct as number) <= maxPct;

        this.logStep(
            `Read "Volume (24h)" change % for "${displayName}"`,
            `a plausible percentage between ${minPct}% and ${maxPct}%`,
            hasValue ? `${(pct as number) >= 0 ? '+' : ''}${pct}%` : `(not shown in "${raw}")`,
        );

        return {
            changePercent: pct,
            hasValue,
            sanityStatus:  isSane ? 'sane' : 'insane',
            sanityMsg:
                `${displayName} — Volume (24h) change % should be a plausible percentage (between ${minPct}% and ${maxPct}%)\n` +
                `  Received: "${raw}" → parsed as ${hasValue ? `${pct}%` : '(no % found)'}`,
        };
    }

    async checkPopularityRank(csvPopularity: string, displayName: string): Promise<{
        actualRank:     string;
        hasExpected:    boolean;
        expectedRank:   string;
        hasValueStatus: 'has value' | 'empty';
        valueMsg:       string;
        rankMsg:        string;
    }> {
        const actualRank  = await this.getPopularityRankText();
        const expectedRank = csvPopularity.trim();
        const hasExpected  = expectedRank.length > 0;

        this.logStep(
            `Read "Popularity" rank for "${displayName}"`,
            hasExpected ? `# ${expectedRank}` : '(no rank set in CSV)',
            `"${actualRank}"`,
        );

        return {
            actualRank,
            hasExpected,
            expectedRank:   `# ${expectedRank}`,
            hasValueStatus: actualRank.length > 0 ? 'has value' : 'empty',
            valueMsg:
                `${displayName} — Popularity stat should display a rank value\n` +
                `  Tip: add the admin-assigned rank to the "popularity" column in coinDetailData.csv`,
            rankMsg:
                `${displayName} — Popularity rank (admin-assigned in platform)\n` +
                `  If the page shows "# null", the admin has not yet set the rank in the platform.`,
        };
    }

    async checkOverviewSection(displayName: string): Promise<{
        sectionVisible: 'visible' | 'not visible';
        actualText:     string;
        contentStatus:  'has content' | 'empty';
    }> {
        await this.scrollToOverviewSection();
        const isVisible = await this.isOverviewTextSectionVisible();
        let actualText  = '';

        if (isVisible) {
            actualText = await this.getOverviewText();
        }
        this.logStep(
            `Scrolled to the Overview text section for "${displayName}"`,
            'section visible with non-empty text',
            isVisible ? `visible — "${actualText}"` : 'not visible',
        );

        return {
            sectionVisible: isVisible ? 'visible' : 'not visible',
            actualText,
            contentStatus: actualText.length > 0 ? 'has content' : 'empty',
        };
    }

    async checkResourcesSection(displayName: string): Promise<{
        sectionVisible:    'visible' | 'not visible';
        whitepaperVisible: 'visible' | 'not visible';
        websiteVisible:    'visible' | 'not visible';
    }> {
        await this.scrollToResources();
        const [section, whitepaper, website] = await Promise.all([
            this.isResourcesSectionVisible(),
            this.isWhitepaperLinkVisible(),
            this.isOfficialWebsiteLinkVisible(),
        ]);
        this.logStep(
            `Scrolled to the Resources section for "${displayName}"`,
            '"RESOURCES" heading, "Whitepaper" link and "Official website" link all visible',
            `section: ${section} | whitepaper link: ${whitepaper} | website link: ${website}`,
        );
        return {
            sectionVisible:    section    ? 'visible' : 'not visible',
            whitepaperVisible: whitepaper ? 'visible' : 'not visible',
            websiteVisible:    website    ? 'visible' : 'not visible',
        };
    }

    async checkWhitepaperTab(
        whitepaperUrlContains: string,
        displayName: string,
    ): Promise<{
        tabOpened:     'opened' | 'not opened';
        tabOpenedMsg:  string;
        urlMatches:    'correct url' | 'wrong url';
        urlMatchesMsg: string;
        hasUrlFragment:boolean;
        titleStatus:   'has title' | 'no title';
        titleMsg:      string;
        isPdf:         boolean;
        url:           string;
    }> {
        const whitepaperPage = await this.clickWhitepaperAndGetNewTab();
        const url            = whitepaperPage.url();
        const isBrowserErrorPage = url.startsWith('chrome-error://');
        const isPdf          = !isBrowserErrorPage && url.toLowerCase().includes('.pdf');
        const title          = isPdf ? '' : await this.getPageTitle(whitepaperPage);
        const hasUrlFragment = whitepaperUrlContains.length > 0;
        const urlMatch       = hasUrlFragment
            ? url.toLowerCase().includes(whitepaperUrlContains.toLowerCase())
            : true;

        this.logStep(
            `Clicked "Whitepaper" link for "${displayName}"`,
            hasUrlFragment ? `new tab URL containing "${whitepaperUrlContains}"` : 'a new tab to open',
            isBrowserErrorPage
                ? `browser failed to load the destination (${url}) — likely an SSL/connectivity issue on the host's end, not a Knooz page issue`
                : `URL: "${url}" | ${isPdf ? 'PDF (title skipped)' : `title: "${title}"`}`,
        );

        await whitepaperPage.close();
        return {
            tabOpened:      (url.length > 0 && !isBrowserErrorPage) ? 'opened' : 'not opened',
            tabOpenedMsg:   isBrowserErrorPage
                ? `${displayName} — "Whitepaper" tab opened but the destination failed to load (browser error page)\n` +
                  `  This is an external host failure (e.g. SSL/TLS error), not a Knooz page defect — retry to confirm it isn't transient.`
                : `${displayName} — clicking "Whitepaper" should open a new tab\n  URL received: "${url}"`,
            urlMatches:     urlMatch ? 'correct url' : 'wrong url',
            urlMatchesMsg:
                `${displayName} — whitepaper URL should contain "${whitepaperUrlContains}"\n` +
                `  Expected URL to contain : "${whitepaperUrlContains}"\n` +
                `  Actual URL opened       : "${url}"`,
            hasUrlFragment,
            titleStatus:    title.length > 0 ? 'has title' : 'no title',
            titleMsg:
                `${displayName} — whitepaper tab should have a non-empty page title\n` +
                `  Title received : "${title}"\n` +
                `  URL            : "${url}"`,
            isPdf,
            url,
        };
    }

    async checkOfficialWebsiteTab(
        officialWebsiteContains: string,
        websiteTitleContains: string,
        displayName: string,
    ): Promise<{
        tabOpened:          'opened' | 'not opened';
        tabOpenedMsg:       string;
        urlMatches:         'correct site' | 'wrong site';
        urlMatchesMsg:      string;
        hasUrlDomain:       boolean;
        hasTitle:           'has title' | 'no title';
        hasTitleMsg:        string;
        titleMatches:       'correct title' | 'wrong title';
        titleMatchesMsg:    string;
        hasTitleFragment:   boolean;
        hasFavicon:         'has favicon' | 'no favicon';
        hasFaviconMsg:      string;
        ownFaviconStatus:   string;
        ownFaviconMsg:      string;
        hasOwnFaviconCheck: boolean;
        url:                string;
    }> {
        const websitePage = await this.clickOfficialWebsiteAndGetNewTab();
        const url         = websitePage.url();
        const title       = await this.getPageTitle(websitePage);
        const favicons    = await this.getFaviconUrls(websitePage);
        const coinDomain  = officialWebsiteContains.toLowerCase();
        const hasFavicon  = favicons.length > 0;
        const hasOwn      = hasFavicon && coinDomain.length > 0
            ? favicons.some(f => f.toLowerCase().includes(coinDomain))
            : false;

        // Chrome renders its own internal error document (chrome-error://chromewebdata/) when the
        // destination site itself fails to load (e.g. an SSL/TLS handshake failure on their end) —
        // the tab did open, but never actually reached the real site, so treat that as "not opened"
        // rather than reporting a misleadingly generic "wrong site".
        const isBrowserErrorPage = url.startsWith('chrome-error://');

        this.logStep(
            `Clicked "Official website" link for "${displayName}"`,
            `URL containing "${officialWebsiteContains}", title containing "${websiteTitleContains}", favicon from that domain`,
            isBrowserErrorPage
                ? `browser failed to load the destination site (${url}) — likely an SSL/connectivity issue on ${officialWebsiteContains}'s end, not a Knooz page issue`
                : `URL: "${url}" | title: "${title}" | favicons: [${favicons.join(', ') || 'none'}]`,
        );

        await websitePage.close();
        return {
            tabOpened:          (url.length > 0 && !isBrowserErrorPage) ? 'opened' : 'not opened',
            tabOpenedMsg:       isBrowserErrorPage
                ? `${displayName} — "Official Website" tab opened but the destination site failed to load (browser error page)\n` +
                  `  This is an external site failure (e.g. SSL/TLS error on ${officialWebsiteContains}), not a Knooz page defect — retry to confirm it isn't transient.\n` +
                  `  URL attempted: "${officialWebsiteContains}"`
                : `${displayName} — clicking "Official Website" should open a new tab\n  URL received: "${url}"`,
            urlMatches:         url.toLowerCase().includes(coinDomain) ? 'correct site' : 'wrong site',
            urlMatchesMsg:
                `${displayName} — official website URL should contain "${officialWebsiteContains}"\n` +
                `  Expected URL to contain : "${officialWebsiteContains}"\n` +
                `  Actual URL opened       : "${url}"`,
            hasUrlDomain:       officialWebsiteContains.length > 0,
            hasTitle:           title.length > 0 ? 'has title' : 'no title',
            hasTitleMsg:        `${displayName} — official website tab should have a non-empty page title\n  Title received: "${title}"`,
            titleMatches:       title.toLowerCase().includes(websiteTitleContains.toLowerCase()) ? 'correct title' : 'wrong title',
            titleMatchesMsg:
                `${displayName} — official website tab title should contain "${websiteTitleContains}"\n` +
                `  Expected title to contain : "${websiteTitleContains}"\n` +
                `  Actual title              : "${title}"`,
            hasTitleFragment:   websiteTitleContains.length > 0,
            hasFavicon:         hasFavicon ? 'has favicon' : 'no favicon',
            hasFaviconMsg:
                `${displayName} — official website tab should have a favicon\n` +
                `  URL            : ${url}\n` +
                `  Found favicons : [${favicons.join(', ') || 'none'}]`,
            ownFaviconStatus:   hasOwn ? `coin domain favicon (${coinDomain})` : 'no coin domain favicon',
            ownFaviconMsg:
                `${displayName} — tab favicon should come from the coin's own domain\n` +
                `  Expected domain : ${coinDomain}\n` +
                `  Found favicons  : [${favicons.join(', ') || 'none'}]`,
            hasOwnFaviconCheck: hasFavicon && coinDomain.length > 0,
            url,
        };
    }
}
