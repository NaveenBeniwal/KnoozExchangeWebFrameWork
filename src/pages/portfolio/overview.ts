import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';

export class PortfolioOverviewPage extends BasePage {

    private readonly portfolioSidebarButton: Locator;
    private readonly backButton: Locator;
    private readonly depositWithdrawButton: Locator;
    private readonly estimatedBalanceLabel: Locator;
    private readonly balanceAmount: Locator;
    private readonly balanceToggleIcon: Locator;
    private readonly overviewTab: Locator;
    private readonly spotTab: Locator;
    private readonly fundingTab: Locator;
    private readonly gridTab: Locator;
    private readonly copyTab: Locator;
    private readonly myAssetsHeading: Locator;
    private readonly walletSectionHeading: Locator;
    private readonly walletSpotRow: Locator;
    private readonly walletFundingRow: Locator;
    private readonly walletGridRow: Locator;
    private readonly walletCopyRow: Locator;
    private readonly coinViewSectionHeading: Locator;
    private readonly coinTetherUSDT: Locator;
    private readonly coinEthereum: Locator;
    private readonly coinBitcoin: Locator;

    constructor(page: Page) {
        super(page);

        this.portfolioSidebarButton = page.getByText('Portfolio', { exact: true }).first();
        this.backButton             = page.getByRole('heading', { name: 'Back', level: 3 });
        this.depositWithdrawButton  = page.getByText('Deposit & Withdraw', { exact: true }).first();
        this.estimatedBalanceLabel  = page.getByRole('heading', { name: 'Estimated Balance:' });

        this.balanceAmount = page.locator('span, p, div, h1, h2, h3, h4, h5')
            .filter({ hasText: /[\d.]+\s*USDT/ })
            .first();

        this.balanceToggleIcon = page.getByRole('img', { name: 'eye' });

        this.overviewTab = page.getByText('Overview', { exact: true }).first();
        this.spotTab     = page.getByText('Spot',     { exact: true }).first();
        this.fundingTab  = page.getByText('Funding',  { exact: true }).first();
        this.gridTab     = page.getByText('Grid',     { exact: true }).first();
        this.copyTab     = page.getByText('Copy',     { exact: true }).first();

        this.myAssetsHeading      = page.getByRole('heading', { name: 'My Assets' });
        this.walletSectionHeading = page.getByRole('heading', { name: 'Wallet', level: 4 });

        this.walletSpotRow    = page.locator(`p:has-text("Spot")`);
        this.walletFundingRow = page.locator(`p:has-text("Funding")`);
        this.walletGridRow    = page.locator(`p:has-text("Grid")`);
        this.walletCopyRow    = page.locator(`p:has-text("Copy")`);

        this.coinViewSectionHeading = page.getByRole('heading', { name: 'Coin View', level: 4 });
        this.coinTetherUSDT = page.getByText('Tether USDT', { exact: true }).first();
        this.coinEthereum   = page.getByText('Ethereum',    { exact: true }).first();
        this.coinBitcoin    = page.getByText('Bitcoin',     { exact: true }).first();
    }

    // ─── Navigation ──────────────────────────────────────────────────────────────

    async goToPortfolio(): Promise<void> {
        await this.portfolioSidebarButton.click();
        await this.page.waitForTimeout(1000);
        await this.page.waitForLoadState('networkidle');
        console.log('[Portfolio] Overview page loaded');
    }

    // ─── Visibility checks ────────────────────────────────────────────────────────

    async isBackButtonVisible(): Promise<boolean> {
        const isVisible = await this.backButton.isVisible();
        console.log(`[PortfolioOverviewPage][isBackButtonVisible] visible: ${isVisible}`);
        return isVisible;
    }

    async isDepositWithdrawButtonVisible(): Promise<boolean> {
        const isVisible = await this.depositWithdrawButton.isVisible();
        console.log(`[PortfolioOverviewPage][isDepositWithdrawButtonVisible] visible: ${isVisible}`);
        return isVisible;
    }

    async isEstimatedBalanceVisible(): Promise<boolean> {
        const isVisible = await this.estimatedBalanceLabel.isVisible();
        console.log(`[PortfolioOverviewPage][isEstimatedBalanceVisible] visible: ${isVisible}`);
        return isVisible;
    }

    async getBalanceText(): Promise<string | null> {
        const text = await this.balanceAmount.textContent();
        console.log(`[PortfolioOverviewPage][getBalanceText] text: "${text}"`);
        return text;
    }

    async isTabVisible(tabName: 'Overview' | 'Spot' | 'Funding' | 'Grid' | 'Copy'): Promise<boolean> {
        const tabs: Record<string, Locator> = {
            Overview: this.overviewTab,
            Spot:     this.spotTab,
            Funding:  this.fundingTab,
            Grid:     this.gridTab,
            Copy:     this.copyTab
        };
        const isVisible = await tabs[tabName].isVisible();
        console.log(`[PortfolioOverviewPage][isTabVisible] tab: ${tabName} | visible: ${isVisible}`);
        return isVisible;
    }

    async clickTab(tabName: 'Overview' | 'Spot' | 'Funding' | 'Grid' | 'Copy'): Promise<void> {
        console.log(`[PortfolioOverviewPage][clickTab] Clicking tab: ${tabName}`);
        const tabs: Record<string, Locator> = {
            Overview: this.overviewTab,
            Spot:     this.spotTab,
            Funding:  this.fundingTab,
            Grid:     this.gridTab,
            Copy:     this.copyTab
        };
        await tabs[tabName].click();
        console.log(`[PortfolioOverviewPage][clickTab] Tab clicked: ${tabName}`);
    }

    async isMyAssetsVisible(): Promise<boolean> {
        const isVisible = await this.myAssetsHeading.isVisible();
        console.log(`[PortfolioOverviewPage][isMyAssetsVisible] visible: ${isVisible}`);
        return isVisible;
    }

    async isWalletSectionVisible(): Promise<boolean> {
        const isVisible = await this.walletSectionHeading.isVisible();
        console.log(`[PortfolioOverviewPage][isWalletSectionVisible] visible: ${isVisible}`);
        return isVisible;
    }

    async isBalanceToggleIconVisible(): Promise<boolean> {
        const isVisible = await this.balanceToggleIcon.isVisible();
        console.log(`[PortfolioOverviewPage][isBalanceToggleIconVisible] visible: ${isVisible}`);
        return isVisible;
    }

    async isCoinViewSectionVisible(): Promise<boolean> {
        const isVisible = await this.coinViewSectionHeading.isVisible();
        console.log(`[PortfolioOverviewPage][isCoinViewSectionVisible] visible: ${isVisible}`);
        return isVisible;
    }

    async isWalletRowVisible(row: 'Spot' | 'Funding' | 'Grid' | 'Copy'): Promise<boolean> {
        const rows: Record<string, Locator> = {
            Spot:    this.walletSpotRow,
            Funding: this.walletFundingRow,
            Grid:    this.walletGridRow,
            Copy:    this.walletCopyRow
        };
        const isVisible = await rows[row].isVisible();
        console.log(`[PortfolioOverviewPage][isWalletRowVisible] row: ${row} | visible: ${isVisible}`);
        return isVisible;
    }

    async isCoinVisible(coin: 'Tether USDT' | 'Ethereum' | 'Bitcoin'): Promise<boolean> {
        const coins: Record<string, Locator> = {
            'Tether USDT': this.coinTetherUSDT,
            'Ethereum':    this.coinEthereum,
            'Bitcoin':     this.coinBitcoin,
        };
        const isVisible = await coins[coin].isVisible();
        console.log(`[PortfolioOverviewPage][isCoinVisible] coin: ${coin} | visible: ${isVisible}`);
        return isVisible;
    }

    // ─── Private parsing helpers ──────────────────────────────────────────────────

    private parseUsdtAmount(text: string): number {
        const match = text.match(/([\d.]+)\s*USDT/);
        return match ? parseFloat(match[1]) : 0;
    }

    private parseUsdValue(text: string): number {
        const approxMatch = text.match(/[≈~]\$?([\d,.]+)/);
        if (approxMatch) return parseFloat(approxMatch[1].replace(',', ''));
        return this.parseUsdtAmount(text);
    }

    private parsePercentage(text: string): number {
        const match = text.match(/(\d+)%/);
        return match ? parseInt(match[1]) : 0;
    }

    // ─── Estimated Balance ────────────────────────────────────────────────────────

    // The header total can render before a per-wallet balance (e.g. Copy trading) finishes an
    // async update, so an immediate read can undercount by exactly that wallet's amount (observed
    // live: header showed the total minus the Copy balance). Poll until the text stops changing —
    // requiring it to also differ from the very first reading — before trusting it.
    private async waitForBalanceToStabilize(maxAttempts = 8, intervalMs = 400): Promise<void> {
        const first = await this.balanceAmount.textContent().catch(() => null);
        let previous = first;
        for (let i = 0; i < maxAttempts; i++) {
            await this.page.waitForTimeout(intervalMs);
            const current = await this.balanceAmount.textContent().catch(() => null);
            if (current !== null && current === previous) return;
            previous = current;
        }
    }

    async getEstimatedBalanceAmount(): Promise<number> {
        await this.waitForBalanceToStabilize();
        const text = await this.balanceAmount.textContent() ?? '';
        const amount = this.parseUsdtAmount(text);
        console.log(`[Portfolio] Estimated balance: ${amount} USDT`);
        return amount;
    }

    // ─── Wallet row data ──────────────────────────────────────────────────────────
    async getWalletRowData(wallet: string): Promise<{ amount: number; displayedRatio: number }> {
        // .ant-table-cell indices (0-2 = headers, then 3 cells per wallet row):
        //   Spot: ratio=4  amount=5
        //   Funding: ratio=7  amount=8
        //   Grid: ratio=10 amount=11
        //   Copy: ratio=13 amount=14
        const cellIndices: Record<string, { ratio: number; amount: number }> = {
            Spot:    { ratio: 4,  amount: 5  },
            Funding: { ratio: 7,  amount: 8  },
            Grid:    { ratio: 10, amount: 11 },
            Copy:    { ratio: 13, amount: 14 },
        };
        const { ratio: ri, amount: ai } = cellIndices[wallet];
        const cells = this.page.locator('.ant-table-cell');

        const ratioText  = await cells.nth(ri).textContent() ?? '';
        const amountText = await cells.nth(ai).textContent() ?? '';

        const amount         = this.parseUsdtAmount(amountText);
        const displayedRatio = this.parsePercentage(ratioText);
        console.log(`[Portfolio] Wallet  ${wallet.padEnd(7)} | amount: ${String(amount).padEnd(18)} USDT | ratio: ${displayedRatio}%`);
        return { amount, displayedRatio };
    }

    // ─── Coin View row data ───────────────────────────────────────────────────────

    async getCoinRowData(coin: string): Promise<{ usdValue: number; displayedRatio: number }> {
        // .ant-table-cell indices continue after the Wallet table (indices 0-14).
        // Coin View headers occupy 15-17, then 3 cells per coin row:
        //   Tether USDT: ratio=19 amount=20
        //   Ethereum:    ratio=22 amount=23
        //   Bitcoin:     ratio=25 amount=26
        //   XYZ:         ratio=28 amount=29
        const cellIndices: Record<string, { ratio: number; amount: number }> = {
            'Tether USDT': { ratio: 19, amount: 20 },
            'Ethereum':    { ratio: 22, amount: 23 },
            'Bitcoin':     { ratio: 25, amount: 26 },
            'XYZ':         { ratio: 28, amount: 29 },
        };
        const { ratio: ri, amount: ai } = cellIndices[coin];
        const cells = this.page.locator('.ant-table-cell');

        const ratioText  = await cells.nth(ri).textContent() ?? '';
        const amountText = await cells.nth(ai).textContent() ?? '';

        const usdValue       = this.parseUsdValue(amountText);
        const displayedRatio = this.parsePercentage(ratioText);
        console.log(`[Portfolio] Coin    ${coin.padEnd(12)} | usdValue: ${String(usdValue).padEnd(10)} | ratio: ${displayedRatio}%`);
        return { usdValue, displayedRatio };
    }

    // ─── Ratio math ───────────────────────────────────────────────────────────────

    calculateExpectedRatio(partAmount: number, totalAmount: number): number {
        return totalAmount === 0 ? 0 : Math.round((partAmount / totalAmount) * 100);
    }

}
