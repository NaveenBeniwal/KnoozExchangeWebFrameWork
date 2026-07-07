import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';

export class PortfolioCopyPage extends BasePage {

    private readonly portfolioSidebarButton: Locator;
    private readonly copyTab: Locator;
    private readonly copyTotalBalance: Locator;
    private readonly copyPositionTable: Locator;
    private readonly startCopyingButton: Locator;

    constructor(page: Page) {
        super(page);

        this.portfolioSidebarButton = page.getByText('Portfolio', { exact: true }).first();

        const tabsBar = page.locator('[class*="tab"], [role="tablist"]').first();
        this.copyTab = tabsBar.getByText('Copy', { exact: true });

        this.copyTotalBalance   = page.locator('span, p, div, h1, h2, h3, h4, h5')
            .filter({ hasText: /[\d.]+\s*USDT/ })
            .first();
        this.copyPositionTable  = page.locator('[class*="copy"], [class*="position"], [class*="table"]').first();
        this.startCopyingButton = page.getByText('Start Copying', { exact: true }).first();
    }

    // ─── Navigation ──────────────────────────────────────────────────────────────

    async goToCopyTab(): Promise<void> {
        await this.portfolioSidebarButton.click();
        await this.page.waitForLoadState('networkidle');
        await this.copyTab.click();
        await this.page.waitForTimeout(500);
    }

    // ─── Visibility checks ────────────────────────────────────────────────────────

    async isCopyTabVisible(): Promise<boolean> {
        return await this.copyTab.isVisible();
    }

    async isCopyTotalBalanceVisible(): Promise<boolean> {
        return await this.copyTotalBalance.isVisible();
    }

    async isCopyPositionTableVisible(): Promise<boolean> {
        return await this.copyPositionTable.isVisible();
    }

    async isStartCopyingButtonVisible(): Promise<boolean> {
        return await this.startCopyingButton.isVisible();
    }

    // ─── Data extraction ──────────────────────────────────────────────────────────

    async getCopyBalanceText(): Promise<string | null> {
        return await this.copyTotalBalance.textContent();
    }

}
