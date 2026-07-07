import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';

export class PortfolioGridPage extends BasePage {

    private readonly portfolioSidebarButton: Locator;
    private readonly gridTab: Locator;
    private readonly gridTotalBalance: Locator;
    private readonly gridPositionTable: Locator;
    private readonly createGridButton: Locator;

    constructor(page: Page) {
        super(page);

        this.portfolioSidebarButton = page.getByText('Portfolio', { exact: true }).first();

        const tabsBar = page.locator('[class*="tab"], [role="tablist"]').first();
        this.gridTab = tabsBar.getByText('Grid', { exact: true });

        this.gridTotalBalance  = page.locator('span, p, div, h1, h2, h3, h4, h5')
            .filter({ hasText: /[\d.]+\s*USDT/ })
            .first();
        this.gridPositionTable = page.locator('[class*="grid"], [class*="position"], [class*="table"]').first();
        this.createGridButton  = page.getByText('Create Grid', { exact: true }).first();
    }

    // ─── Navigation ──────────────────────────────────────────────────────────────

    async goToGridTab(): Promise<void> {
        await this.portfolioSidebarButton.click();
        await this.page.waitForLoadState('networkidle');
        await this.gridTab.click();
        await this.page.waitForTimeout(500);
    }

    // ─── Visibility checks ────────────────────────────────────────────────────────

    async isGridTabVisible(): Promise<boolean> {
        return await this.gridTab.isVisible();
    }

    async isGridTotalBalanceVisible(): Promise<boolean> {
        return await this.gridTotalBalance.isVisible();
    }

    async isGridPositionTableVisible(): Promise<boolean> {
        return await this.gridPositionTable.isVisible();
    }

    async isCreateGridButtonVisible(): Promise<boolean> {
        return await this.createGridButton.isVisible();
    }

    // ─── Data extraction ──────────────────────────────────────────────────────────

    async getGridBalanceText(): Promise<string | null> {
        return await this.gridTotalBalance.textContent();
    }

}
