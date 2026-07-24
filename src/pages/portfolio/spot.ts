import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';

// Represents one row from the Portfolio → Spot balance table.
export interface CoinBalance {
    coin:        string;   // symbol extracted from the balance text (e.g. "ETH", "USDT")
    spotBalance: number;
    inOrder:     number;
    total:       number;
    totalUsd:    number;
}

export class PortfolioSpotPage extends BasePage {

    // ─── Locators ─────────────────────────────────────────────────────────────────

    private readonly portfolioSidebarButton: Locator;
    private readonly estimatedBalanceLabel:  Locator;
    private readonly estimatedBalanceAmount: Locator;
    private readonly totalPnlLabel: Locator;
    private readonly totalPnlValue: Locator;
    private readonly depositWithdrawButton:  Locator;
    private readonly spotTab: Locator;
    private readonly searchField: Locator;
    private readonly hideZeroBalanceToggle: Locator;
    private readonly coinHeader: Locator;
    private readonly spotBalanceHeader: Locator;
    private readonly inOrderHeader: Locator;
    private readonly totalHeader: Locator;
    private readonly actionHeader: Locator;
    private readonly todayPnlHeader: Locator;
    private readonly tradeHeader: Locator;

    constructor(page: Page) {
        super(page);

        this.portfolioSidebarButton = page.getByText('Portfolio', { exact: true }).first();
        this.estimatedBalanceLabel  = page.getByText('Estimated Balance:', { exact: false });

        // Bold/strong element that shows "X.XXXXXXXX USDT" in the header banner
        this.estimatedBalanceAmount = page.locator('b, strong, span, p, div').filter({ hasText: /\d+\.\d+\s*USDT/ }).first();

        this.totalPnlLabel = page.getByRole('heading', { name: 'Total PNL :', level: 4 });
        this.totalPnlValue = page.locator('b, strong, span, p').filter({ hasText: /[\d.]+\s*USDT/ }).nth(1);

        this.depositWithdrawButton = page.getByText('Deposit & Withdraw', { exact: true });
        this.spotTab = page.getByText('Spot', { exact: true }).first();
        this.searchField = page.getByPlaceholder('Search currency');
        this.hideZeroBalanceToggle = page.locator('.ant-checkbox-input');
        this.coinHeader = page.getByText('Coin', { exact: true });
        this.spotBalanceHeader = page.getByText('Spot Balance', { exact: true });
        this.inOrderHeader = page.getByText('In Order', { exact: true });
        this.totalHeader = page.getByText('Total', { exact: true });
        this.actionHeader = page.getByText('Action', { exact: true });
        this.todayPnlHeader = page.getByText('Today PNL', { exact: true });
        this.tradeHeader = page.getByText('Trade', { exact: true }).first();
    }

    // ─── Navigation ──────────────────────────────────────────────────────────────

    async goToSpotTab(): Promise<void> {
        await this.portfolioSidebarButton.click();
        await this.page.waitForLoadState('domcontentloaded').catch(() => {});
        await this.page.waitForTimeout(600);
        await this.spotTab.click();
        await this.page.waitForTimeout(500);
        await this.page.waitForLoadState('domcontentloaded').catch(() => {});
        console.log('[Spot] Spot page loaded');
    }

    // ─── Visibility checks ────────────────────────────────────────────────────────

    async isEstimatedBalanceLabelVisible(): Promise<boolean> {
        return this.estimatedBalanceLabel.isVisible();
    }

    async isEstimatedBalanceAmountVisible(): Promise<boolean> {
        return this.estimatedBalanceAmount.isVisible();
    }

    async isTotalPnlLabelVisible(): Promise<boolean> {
        return this.totalPnlLabel.isVisible();
    }

    async isTotalPnlValueVisible(): Promise<boolean> {
        return this.totalPnlValue.isVisible();
    }

    async isDepositWithdrawButtonVisible(): Promise<boolean> {
        return this.depositWithdrawButton.isVisible();
    }

    async isSpotTabVisible(): Promise<boolean> {
        return this.spotTab.isVisible();
    }

    async isSearchFieldVisible(): Promise<boolean> {
        return this.searchField.isVisible();
    }

    async isHideZeroBalanceVisible(): Promise<boolean> {
        return this.hideZeroBalanceToggle.isVisible();
    }

    async isTableHeaderVisible(header: string): Promise<boolean> {
        const map: Record<string, Locator> = {
            'Coin':         this.coinHeader,
            'Spot Balance': this.spotBalanceHeader,
            'In Order':     this.inOrderHeader,
            'Total':        this.totalHeader,
            'Action':       this.actionHeader,
            'Today PNL':    this.todayPnlHeader,
            'Trade':        this.tradeHeader,
        };
        return (map[header] ?? this.page.locator('th.ant-table-cell').filter({ hasText: header }).first()).isVisible();
    }

    async isCoinRowVisible(coin: string): Promise<boolean> {
        const count = await this.page.locator('tr.ant-table-row')
            .filter({ hasText: coin }).count();
        return count > 0;
    }

    async isActionButtonVisible(coin: string, action: 'Deposit' | 'Withdraw' | 'Transfer'): Promise<boolean> {
        const row = this.page.locator('tr.ant-table-row').filter({ hasText: coin }).first();
        const count = await row.getByText(action, { exact: true }).count();
        return count > 0;
    }

    // ─── Balance extraction ───────────────────────────────────────────────────────

    async getEstimatedBalanceAmount(): Promise<number> {
        const text   = await this.estimatedBalanceAmount.textContent() ?? '';
        const amount = this.parseNativeAmount(text);
        console.log(`[Spot] Estimated balance: ${amount} USDT`);
        return amount;
    }

    // ─── Coin row data ────────────────────────────────────────────────────────────
    // Spot table columns (0-indexed within tr.ant-table-row):
    //   0 = Coin  1 = Spot Balance  2 = In Order  3 = Total  4 = Action  5 = Today PNL  6 = Trade

    async getCoinRowData(coin: string): Promise<{
        spotBalanceNative: number;
        inOrderNative:     number;
        totalNative:       number;
        totalUsd:          number;
    }> {
        const row   = this.page.locator('tr.ant-table-row').filter({ hasText: coin }).first();
        const cells = row.locator('td.ant-table-cell');

        const spotText  = await cells.nth(1).textContent() ?? '';
        const orderText = await cells.nth(2).textContent() ?? '';
        const totalText = await cells.nth(3).textContent() ?? '';

        const spotBalanceNative = this.parseNativeAmount(spotText);
        const inOrderNative     = this.parseNativeAmount(orderText);
        const totalNative       = this.parseNativeAmount(totalText);
        const totalUsd          = this.parseUsdValue(totalText);

        console.log(
            `[Spot] ${coin.padEnd(12)} | spot: ${String(spotBalanceNative).padEnd(14)}` +
            ` | inOrder: ${String(inOrderNative).padEnd(14)}` +
            ` | total: ${totalNative} | ≈$${totalUsd}`
        );
        return { spotBalanceNative, inOrderNative, totalNative, totalUsd };
    }

    // ─── All-coin balance snapshot ────────────────────────────────────────────────

    // Reads every visible row from the Spot table and returns a CoinBalance per row.
    // Dynamic: works for 4, 5, 8, 10, 15 ... any number of rows currently rendered.
    async getAllCoinBalances(): Promise<CoinBalance[]> {
        const rows  = this.page.locator('tr.ant-table-row');
        const count = await rows.count();
        const balances: CoinBalance[] = [];

        for (let i = 0; i < count; i++) {
            const row   = rows.nth(i);
            const cells = row.locator('td.ant-table-cell');

            const spotText    = (await cells.nth(1).textContent() ?? '').trim();
            const inOrderText = (await cells.nth(2).textContent() ?? '').trim();
            const totalText   = (await cells.nth(3).textContent() ?? '').trim();

            // Extract symbol from balance text, e.g. "47.05227243 USDT" → "USDT"
            const symMatch = spotText.match(/([A-Z0-9]+)\s*$/);
            const coin     = symMatch ? symMatch[1] : `COIN_${i}`;

            const spotBalance = this.parseNativeAmount(spotText);
            const inOrder     = this.parseNativeAmount(inOrderText);
            const total       = this.parseNativeAmount(totalText);
            const totalUsd    = this.parseUsdValue(totalText);

            balances.push({ coin, spotBalance, inOrder, total, totalUsd });
        }
        return balances;
    }

    // ─── Search functionality ─────────────────────────────────────────────────────

    async searchCurrency(query: string): Promise<void> {
        console.log(`[Spot] Searching: "${query}"`);
        await this.searchField.fill(query);
        await this.page.waitForTimeout(500);
    }

    async clearSearch(): Promise<void> {
        console.log('[Spot] Clearing search');
        await this.searchField.clear();
        await this.page.waitForTimeout(500);
    }

    async getVisibleRowCount(): Promise<number> {
        return this.page.locator('tr.ant-table-row').count();
    }

    // ─── Hide Zero Balance ────────────────────────────────────────────────────────

    async isHideZeroBalanceChecked(): Promise<boolean> {
        return this.hideZeroBalanceToggle.isChecked();
    }

    async setHideZeroBalance(enable: boolean): Promise<void> {
        const current = await this.isHideZeroBalanceChecked();
        if (current !== enable) {
            console.log(`[Spot] ${enable ? 'Enabling' : 'Disabling'} "Hide Zero Balance"`);
            await this.hideZeroBalanceToggle.click({ force: true });
            // Poll until the DOM checkbox actually reflects the new state
            // (React re-renders asynchronously — a fixed timeout is unreliable across cycles)
            await this.page.waitForFunction(
                (expected: boolean) => {
                    const el = document.querySelector('.ant-checkbox-input') as HTMLInputElement | null;
                    return el?.checked === expected;
                },
                enable,
                { timeout: 5000 }
            );
            // Give the table list one extra tick to finish re-rendering
            await this.page.waitForTimeout(300);
        }
    }

    async getZeroBalanceCoinNames(allCoins: string[]): Promise<string[]> {
        const zero: string[] = [];
        for (const coin of allCoins) {
            const { totalUsd } = await this.getCoinRowData(coin);
            if (totalUsd === 0) zero.push(coin);
        }
        console.log(`[Spot] Zero-balance coins: [${zero.join(', ') || 'none'}]`);
        return zero;
    }

    // ─── Private parsing helpers ──────────────────────────────────────────────────

    private parseNativeAmount(text: string): number {
        const match = text.match(/([\d]+\.[\d]+|[\d]+)/);
        return match ? parseFloat(match[1]) : 0;
    }

    private parseUsdValue(text: string): number {
        const approx = text.match(/[≈~]\$?([\d,.]+)/);
        if (approx) return parseFloat(approx[1].replace(',', ''));
        return this.parseNativeAmount(text);
    }
}
