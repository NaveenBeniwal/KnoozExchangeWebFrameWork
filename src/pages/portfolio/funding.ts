import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';

export type FundingAction = 'Deposit' | 'Withdraw' | 'Transfer';
export type WithdrawTab = 'Deposit Address' | 'Knooz User';
export type TransferDirection = 'Funding' | 'Spot';

// Represents one row from the Portfolio → Funding balance table.
export interface FundingBalance {
    coin:           string;   // symbol extracted from the balance text (e.g. "ETH", "USDT")
    fundingBalance: number;
    inOrder:        number;
    total:          number;
    totalUsd:       number;
}

export class PortfolioFundingPage extends BasePage {

    // ─── Locators ─────────────────────────────────────────────────────────────────

    private readonly portfolioSidebarButton: Locator;
    private readonly spotTab: Locator;
    // Scopes every table/header/checkbox query to the currently-active tab pane — confirmed live
    // that navigating Portfolio > Spot > Funding (per this page's own navigation path) leaves the
    // Spot tab's content mounted-but-hidden in the DOM rather than unmounted, so any unscoped
    // page-wide query for "tr.ant-table-row" or a header label matches both tabs' rows at once.
    private readonly activeTabPane: Locator;
    private readonly fundingRows: Locator;
    private readonly estimatedBalanceLabel:  Locator;
    private readonly estimatedBalanceAmount: Locator;
    private readonly estimatedBalanceContainer: Locator;
    private readonly estimatedBalanceUsdValue: Locator;
    private readonly balanceToggleIcon: Locator;
    private readonly depositWithdrawButton:  Locator;
    private readonly fundingTab: Locator;
    private readonly searchField: Locator;
    private readonly searchIcon: Locator;
    private readonly hideZeroBalanceToggle: Locator;
    private readonly noDataMessage: Locator;
    private readonly coinHeader: Locator;
    private readonly fundingBalanceHeader: Locator;
    private readonly inOrderHeader: Locator;
    private readonly totalHeader: Locator;
    private readonly actionHeader: Locator;
    private readonly footerText: Locator;

    // Deposit modal
    private readonly depositModalTitle: Locator;
    private readonly depositAssetField: Locator;
    private readonly depositNetworkField: Locator;
    private readonly depositAddressText: Locator;
    private readonly depositCopyIcon: Locator;
    private readonly depositQrImage: Locator;
    private readonly depositImportantSection: Locator;

    // Withdraw modal
    private readonly withdrawModalTitle: Locator;
    private readonly withdrawAmountInput: Locator;
    private readonly withdrawAvailableBalanceText: Locator;
    private readonly withdrawMaxLink: Locator;
    private readonly withdrawAssetField: Locator;
    private readonly withdrawNetworkField: Locator;
    private readonly withdrawImportantSection: Locator;
    private readonly withdrawDepositAddressTab: Locator;
    private readonly withdrawKnoozUserTab: Locator;
    private readonly withdrawAddressInput: Locator;
    private readonly withdrawEnable2FALink: Locator;
    private readonly withdrawContinueButton: Locator;

    // Transfer modal
    private readonly transferModal: Locator;
    private readonly transferModalTitle: Locator;
    private readonly transferSwapIcon: Locator;
    private readonly transferCoinField: Locator;
    private readonly transferCoinDropdownIcon: Locator;
    private readonly transferQuantityText: Locator;
    private readonly transferAmountInput: Locator;
    private readonly transferAmountValidationMessage: Locator;
    private readonly transferMaxLink: Locator;
    private readonly transferConfirmButton: Locator;
    private readonly transferSuccessMessage: Locator;

    // Select Coin panel (opened from the Transfer modal's Coin dropdown)
    private readonly selectCoinTitle: Locator;
    private readonly selectCoinBackButton: Locator;
    private readonly selectCoinCloseButton: Locator;
    private readonly selectCoinSearchInput: Locator;

    // Shared across all three modals — only one Ant modal is ever open at a time
    private readonly modalCloseButton: Locator;

    constructor(page: Page) {
        super(page);

        this.portfolioSidebarButton = page.getByText('Portfolio', { exact: true }).first();
        this.spotTab = page.getByText('Spot', { exact: true }).first();
        this.activeTabPane = page.locator('.ant-tabs-tabpane-active');
        this.fundingRows   = this.activeTabPane.locator('tr.ant-table-row');
        this.estimatedBalanceLabel  = page.locator(`h4:has-text("Estimated Balance:")`);
        // Scoped to the label's own container, not the whole page — an unscoped page-wide regex
        // match previously grabbed an unrelated element (confirmed live: read back "2" instead of
        // the real ~370 USDT total, most likely an unrelated badge/counter elsewhere on the page
        // whose combined text happened to satisfy the /\d+\.\d+\s*USDT/ filter).
        this.estimatedBalanceContainer = this.estimatedBalanceLabel.locator('..');
        this.estimatedBalanceAmount = this.estimatedBalanceContainer.locator('b, strong, span, p, div').filter({ hasText: /\d+\.\d+\s*USDT/ }).last();
        this.estimatedBalanceUsdValue = page.locator('.arabicspotValue').first();
        this.balanceToggleIcon = page.getByRole('img', { name: 'eye' });

        this.depositWithdrawButton = page.getByText('Deposit & Withdraw', { exact: true });
        this.fundingTab = page.getByText('Funding', { exact: true }).first();
        // .last() on these: confirmed live that navigating Portfolio > Spot > Funding leaves the
        // Spot tab's content mounted-but-hidden in the DOM (rather than unmounted), so page-wide
        // text/checkbox lookups match both tabs' copies — the Funding tab's real one, being the
        // currently active/later-rendered pane, reliably comes last in DOM order.
        this.searchField = page.getByPlaceholder('Search currency').last();
        this.searchIcon  = page.getByRole('img', { name: 'search' }).last();
        this.hideZeroBalanceToggle = page.locator('.ant-checkbox-input').last();
        this.noDataMessage = page.getByText('No data', { exact: true }).last();
        this.footerText = page.getByText(/Knooz © \d{4} All Rights Reserved/);

        this.coinHeader           = page.getByText('Coin', { exact: true }).last();
        this.fundingBalanceHeader = page.getByText('Funding Balance', { exact: true }).last();
        this.inOrderHeader        = page.getByText('In Order', { exact: true }).last();
        this.totalHeader          = page.getByText('Total', { exact: true }).last();
        this.actionHeader         = page.getByText('Action', { exact: true }).last();

        // ─── Deposit modal ──────────────────────────────────────────────────────────
        const depositModal = page.locator(`.ant-modal-content:has-text("Deposit")`);
        this.depositModalTitle   = depositModal.locator(`h2:has-text("Deposit")`);
        this.depositAssetField   = depositModal.getByText('Asset', { exact: true }).locator('..');
        this.depositNetworkField = depositModal.getByText('Network', { exact: true }).locator('..');
        // Confirmed live element for the address value itself (no label-text stripping needed).
        this.depositAddressText  = depositModal.locator(`.grey.twelve.text-right`).first();
        // Confirmed live element for the copy icon — .first() (not .last(), which resolved to
        // nothing visible in this modal specifically).
        this.depositCopyIcon     = depositModal.getByRole('img', { name: 'icon' }).first();
        this.depositQrImage      = depositModal.locator('img, canvas, svg').first();
        this.depositImportantSection = depositModal.getByText('Important', { exact: true });

        // ─── Withdraw modal ─────────────────────────────────────────────────────────
        const withdrawModal = page.locator(`.ant-modal-content:has-text("Withdraw")`);
        this.withdrawModalTitle          = withdrawModal.locator(`h2:has-text("Withdraw")`);
        this.withdrawAmountInput         = withdrawModal.getByPlaceholder('0.00');
        this.withdrawAvailableBalanceText = withdrawModal.getByText('Avl Bal:', { exact: false });
        this.withdrawMaxLink             = withdrawModal.getByText('MAX', { exact: true });
        this.withdrawAssetField          = withdrawModal.getByText('Asset', { exact: true }).locator('..');
        this.withdrawNetworkField        = withdrawModal.getByText('Network', { exact: true }).locator('..');
        this.withdrawImportantSection    = withdrawModal.getByText('Important', { exact: true });
        this.withdrawDepositAddressTab   = withdrawModal.getByText('Deposit Address', { exact: true });
        this.withdrawKnoozUserTab        = withdrawModal.getByText('Knooz User', { exact: true });
        this.withdrawAddressInput        = withdrawModal.getByPlaceholder('Address');
        this.withdrawEnable2FALink       = withdrawModal.getByText('Enable 2FA', { exact: true });
        this.withdrawContinueButton      = withdrawModal.getByRole('button', { name: 'Continue' });

        // ─── Transfer modal ─────────────────────────────────────────────────────────
        this.transferModal      = page.locator(`.ant-modal-content:has-text("Transfer")`);
        this.transferModalTitle = this.transferModal.locator(`h2:has-text("Transfer")`);
        this.transferSwapIcon   = page.locator(`#Rectangle_10934 > rect`).nth(8);
        this.transferCoinField  = this.transferModal.getByText('Coin', { exact: true }).locator('..');
        // Coin dropdown chevron that opens the Select Coin panel — confirmed live structure.
        this.transferCoinDropdownIcon = this.transferModal.locator('li > span.anticon > svg');
        // Same nesting pattern as From/To below: one ".." only reaches the label's own wrapper (text
        // stayed just "Quantity") — confirmed live — so this climbs one level further to reach the
        // row that also holds the value ("X P2P / Y Avlb").
        this.transferQuantityText = this.transferModal.getByText('Quantity', { exact: true }).locator('..').locator('..');
        this.transferMaxLink      = this.transferModal.getByText('MAX', { exact: true });
        // Confirmed live accessible name — direct and reliable, unlike the structural "preceding
        // input before MAX" XPath guess this replaces (which may have been resolving to the wrong
        // input all along, given how many MAX-related read issues that approach ran into).
        this.transferAmountInput = this.transferModal.getByRole('textbox', { name: 'Amount' });
        this.transferAmountValidationMessage = this.transferModal.getByText('Please enter a valid amount', { exact: false });
        this.transferConfirmButton  = this.transferModal.getByRole('button', { name: 'Confirm' });
        this.transferSuccessMessage = page.getByText('Transfer successful', { exact: false });

        // ─── Select Coin panel ──────────────────────────────────────────────────────
        const selectCoinPanel = page.locator(`.ant-modal-content:has-text("Select Coin")`);
        this.selectCoinTitle        = selectCoinPanel.locator(`h5:has-text("Select Coin")`);
        // Confirmed live class for the back arrow — .first() since Select Coin/Confirm actions on
        // this page may share the same clickable utility class; the back arrow renders first (top-left).
        this.selectCoinBackButton   = selectCoinPanel.locator(`.curserPointer`).first();
        this.selectCoinCloseButton  = selectCoinPanel.locator(`.ant-modal-close`);
        this.selectCoinSearchInput  = selectCoinPanel.getByPlaceholder('Search');

        this.modalCloseButton = page.locator(`.ant-modal-close`).last();
    }

    // Standard 3-line trace for every step: what we did, what we expected, what we got — so the
    // HTML report's console output shows exactly what happened without needing to re-run headed.
    private logStep(step: string, expected: string, actual: string): void {
        console.log(
            `[Funding] Step     : ${step}\n` +
            `[Funding] Expected : ${expected}\n` +
            `[Funding] Actual   : ${actual}`
        );
    }

    // ─── Navigation ──────────────────────────────────────────────────────────────

    // Routes through the Spot tab on the way to Funding (Portfolio > Spot > Funding) rather than
    // clicking Funding directly, matching the real navigation path exercised by every test's
    // beforeEach — re-runnable from any starting page (home, another portfolio tab, etc.).
    // Direct Portfolio > Funding path — used by every test's beforeEach and by any test that needs
    // to come back to Funding after visiting Spot mid-test (TC-F10/TC-F15/TC-F16). Going through
    // Spot on every single navigation (55 times a run) was not just wasteful — it's also what left
    // the Spot tab's content mounted-but-hidden in the DOM on every test, which is the root cause
    // behind most of the ".last()"/active-tab-pane fixes elsewhere in this file. Only TC-F02 (which
    // specifically tests the Portfolio > Spot > Funding path) needs goToFundingTabViaSpot() below.
    async goToFundingTab(): Promise<void> {
        await this.portfolioSidebarButton.click();
        await this.page.waitForLoadState('networkidle');
        await this.fundingTab.click();
        await this.page.waitForTimeout(500);
        this.logStep('Navigated to Portfolio > Funding tab', 'Funding page loaded', 'Funding page loaded');
    }

    // Portfolio > Spot > Funding — only for TC-F02, which is specifically about this navigation
    // path. Left as its own method (not the default) since routing through Spot on every test
    // leaves its content mounted-but-hidden in the DOM (see goToFundingTab() above).
    async goToFundingTabViaSpot(): Promise<void> {
        await this.portfolioSidebarButton.click();
        await this.page.waitForLoadState('networkidle');
        await this.spotTab.click();
        await this.page.waitForTimeout(300);
        await this.fundingTab.click();
        await this.page.waitForTimeout(500);
        this.logStep('Navigated to Portfolio > Spot > Funding tab', 'Funding page loaded', 'Funding page loaded');
    }

    // ─── Visibility checks ────────────────────────────────────────────────────────

    async isFundingTabVisible(): Promise<boolean> {
        const isVisible = await this.fundingTab.isVisible();
        this.logStep('Checked "Funding" tab', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isEstimatedBalanceLabelVisible(): Promise<boolean> {
        const isVisible = await this.estimatedBalanceLabel.isVisible();
        this.logStep('Checked "Estimated Balance:" label', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isEstimatedBalanceAmountVisible(): Promise<boolean> {
        const isVisible = await this.estimatedBalanceAmount.isVisible();
        this.logStep('Checked Estimated Balance amount', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isEstimatedBalanceUsdValueVisible(): Promise<boolean> {
        const isVisible = await this.estimatedBalanceUsdValue.isVisible();
        this.logStep('Checked Estimated Balance $ value', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isBalanceToggleIconVisible(): Promise<boolean> {
        const isVisible = await this.balanceToggleIcon.isVisible();
        this.logStep('Checked balance toggle (eye) icon', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async clickBalanceToggle(): Promise<void> {
        await this.balanceToggleIcon.click();
        await this.page.waitForTimeout(300);
        this.logStep('Clicked the balance toggle (eye) icon', 'balance masks/reveals', 'toggle clicked');
    }

    // Masked balances render as filler characters (*, •, etc.) instead of digits — a simple absence
    // of any digit in the displayed text reliably distinguishes masked from revealed either way.
    // Reads from the label's whole container, not estimatedBalanceAmount — that locator's own
    // filter requires a decimal + "USDT" pattern to match anything at all, so once the balance is
    // masked (no such pattern left on screen) it stops matching entirely and hangs waiting for a
    // match that will never reappear until unmasked.
    async isBalanceMasked(): Promise<boolean> {
        const text = (await this.estimatedBalanceContainer.textContent()) ?? '';
        const isMasked = !/\d/.test(text);
        this.logStep('Checked whether the balance is masked', 'masked (no digits) or revealed (numeric)', `"${text}" → ${isMasked ? 'masked' : 'revealed'}`);
        return isMasked;
    }

    async isDepositWithdrawButtonVisible(): Promise<boolean> {
        const isVisible = await this.depositWithdrawButton.isVisible();
        this.logStep('Checked "Deposit & Withdraw" button', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isSearchFieldVisible(): Promise<boolean> {
        const isVisible = await this.searchField.isVisible();
        this.logStep('Checked "Search currency" field', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isSearchIconVisible(): Promise<boolean> {
        const isVisible = await this.searchIcon.isVisible();
        this.logStep('Checked search icon next to "Search currency"', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isHideZeroBalanceVisible(): Promise<boolean> {
        const isVisible = await this.hideZeroBalanceToggle.isVisible();
        this.logStep('Checked "Hide Zero Balance" checkbox', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isNoDataVisible(): Promise<boolean> {
        const isVisible = await this.noDataMessage.isVisible();
        this.logStep('Checked "No data" empty state', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isFooterVisible(): Promise<boolean> {
        const isVisible = await this.footerText.isVisible();
        this.logStep('Checked footer text', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isTableHeaderVisible(header: 'Coin' | 'Funding Balance' | 'In Order' | 'Total' | 'Action'): Promise<boolean> {
        const map: Record<string, Locator> = {
            'Coin':            this.coinHeader,
            'Funding Balance': this.fundingBalanceHeader,
            'In Order':        this.inOrderHeader,
            'Total':           this.totalHeader,
            'Action':          this.actionHeader,
        };
        const isVisible = await map[header].isVisible();
        this.logStep(`Checked table header "${header}"`, 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    // ─── Balance extraction ───────────────────────────────────────────────────────

    async getEstimatedBalanceAmount(): Promise<number> {
        const text   = await this.estimatedBalanceAmount.textContent() ?? '';
        const amount = this.parseNativeAmount(text);
        this.logStep('Read Estimated Balance amount', 'a valid non-negative USDT amount', `${amount} USDT`);
        return amount;
    }

    // ─── Coin row data ────────────────────────────────────────────────────────────
    // Funding table columns (0-indexed within tr.ant-table-row):
    //   0 = Coin  1 = Funding Balance  2 = In Order  3 = Total  4 = Action

    async isCoinRowVisible(coin: string): Promise<boolean> {
        const isVisible = await this.fundingRows.filter({ hasText: coin }).last().isVisible();
        this.logStep(`Checked "${coin}" row`, 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isActionButtonVisible(coin: string, action: FundingAction): Promise<boolean> {
        // .last() for both the row and the action link — see the comment on hideZeroBalanceToggle
        // above on the leftover-Spot-tab-content issue. Checks real visibility (not just DOM
        // presence via count()), since the hidden Spot-tab copy would otherwise report a false
        // positive here — confirmed live that count()-based matching passed even though the actual
        // click target that check was meant to stand in for was not visible.
        const row = this.fundingRows.filter({ hasText: coin }).last();
        const isVisible = await row.getByText(action, { exact: true }).last().isVisible();
        this.logStep(`Checked "${action}" action for ${coin}`, 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async getCoinRowData(coin: string): Promise<{
        fundingBalanceNative: number;
        inOrderNative:        number;
        totalNative:          number;
        totalUsd:             number;
    }> {
        const row   = this.fundingRows.filter({ hasText: coin }).last();
        const cells = row.locator('td.ant-table-cell');

        const fundingText = await cells.nth(1).textContent() ?? '';
        const orderText   = await cells.nth(2).textContent() ?? '';
        const totalText   = await cells.nth(3).textContent() ?? '';

        const fundingBalanceNative = this.parseNativeAmount(fundingText);
        const inOrderNative        = this.parseNativeAmount(orderText);
        const totalNative          = this.parseNativeAmount(totalText);
        const totalUsd             = this.parseUsdValue(totalText);

        this.logStep(
            `Read ${coin} row data`,
            'funding/inOrder/total amounts',
            `funding: ${fundingBalanceNative}, inOrder: ${inOrderNative}, total: ${totalNative}, ≈$${totalUsd}`,
        );
        return { fundingBalanceNative, inOrderNative, totalNative, totalUsd };
    }

    // Reads every row from the Funding table across ALL pages and returns a FundingBalance per row.
    // Dynamic: works for however many rows/pages are currently rendered (search/filter dependent).
    // Confirmed live that reading only the current page badly undercounted the true total (92 vs a
    // real ~370 Estimated Balance) — the account holds more coins than fit on one page.
    async getAllCoinBalances(): Promise<FundingBalance[]> {
        const balances: FundingBalance[] = [];
        // fundingRows is scoped to the active tab pane (see its definition), which is the real fix
        // for the leftover-Spot-tab-content issue — this signature-based dedup is now just a cheap
        // extra safety net in case some other, still-unknown duplication shows up in this table.
        const seenRowSignatures = new Set<string>();
        const nextPageButton = this.page.locator('.ant-pagination-next:not(.ant-pagination-disabled)');

        for (let pageNum = 1; pageNum <= 50; pageNum++) {
            const rows  = this.fundingRows;
            const count = await rows.count();

            for (let i = 0; i < count; i++) {
                const row   = rows.nth(i);
                const cells = row.locator('td.ant-table-cell');

                const fundingText = (await cells.nth(1).textContent() ?? '').trim();
                const orderText   = (await cells.nth(2).textContent() ?? '').trim();
                const totalText   = (await cells.nth(3).textContent() ?? '').trim();

                // Defensive: skips a row with no readable cell content at all, rather than assuming
                // any particular table-duplication mechanism — a layout/measurement duplicate row
                // (if one exists for this table) would have nothing here to parse anyway.
                if (!fundingText && !orderText && !totalText) continue;

                const signature = `${fundingText}|${orderText}|${totalText}`;
                if (seenRowSignatures.has(signature)) continue;
                seenRowSignatures.add(signature);

                const symMatch = fundingText.match(/([A-Z0-9]+)\s*$/);
                const coin     = symMatch ? symMatch[1] : `COIN_p${pageNum}_${i}`;

                const fundingBalance = this.parseNativeAmount(fundingText);
                const inOrder        = this.parseNativeAmount(orderText);
                const total          = this.parseNativeAmount(totalText);
                const totalUsd       = this.parseUsdValue(totalText);

                balances.push({ coin, fundingBalance, inOrder, total, totalUsd });
                this.logStep(
                    `Read row ${i + 1}/${count} on page ${pageNum} of the Funding table`,
                    'funding/inOrder/total amounts',
                    `${coin}: funding=${fundingBalance}, inOrder=${inOrder}, total=${total}, ~$${totalUsd}`,
                );
            }

            const hasNextPage = await nextPageButton.isVisible().catch(() => false);
            if (!hasNextPage) break;
            await nextPageButton.click();
            await this.page.waitForTimeout(500);
        }
        return balances;
    }

    // ─── Search & filter ──────────────────────────────────────────────────────────

    async searchCurrency(query: string): Promise<void> {
        await this.searchField.fill(query);
        await this.page.waitForTimeout(500);
        this.logStep(`Searched currency: "${query}"`, 'table filters to matching coins', 'search applied');
    }

    async clearSearch(): Promise<void> {
        await this.searchField.clear();
        await this.page.waitForTimeout(500);
        this.logStep('Cleared the search field', 'full coin list restored', 'search cleared');
    }

    async getVisibleRowCount(): Promise<number> {
        const count = await this.fundingRows.count();
        this.logStep('Counted visible rows in the Funding table', 'row count', `${count} row(s)`);
        return count;
    }

    async isHideZeroBalanceChecked(): Promise<boolean> {
        const isChecked = await this.hideZeroBalanceToggle.isChecked();
        this.logStep('Checked whether "Hide Zero Balance" is enabled', 'checked or unchecked', isChecked ? 'checked' : 'unchecked');
        return isChecked;
    }

    async setHideZeroBalance(enable: boolean): Promise<void> {
        const current = await this.hideZeroBalanceToggle.isChecked();
        if (current !== enable) {
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
            await this.page.waitForTimeout(300);
        }
        this.logStep(`${enable ? 'Enabled' : 'Disabled'} "Hide Zero Balance"`, enable ? 'checked' : 'unchecked', enable ? 'checked' : 'unchecked');
    }

    async getZeroBalanceCoinNames(allCoins: string[]): Promise<string[]> {
        const zero: string[] = [];
        for (const coin of allCoins) {
            const { totalUsd } = await this.getCoinRowData(coin);
            if (totalUsd === 0) zero.push(coin);
        }
        this.logStep('Scanned coins for zero balance', 'list of zero-balance coins', zero.length ? zero.join(', ') : 'none');
        return zero;
    }

    // ─── Opening modals from a row ────────────────────────────────────────────────

    private async clickRowAction(coin: string, action: FundingAction): Promise<void> {
        const row = this.fundingRows.filter({ hasText: coin }).last();
        await row.getByText(action, { exact: true }).last().click();
        await this.page.waitForTimeout(500);
        this.logStep(`Clicked "${action}" for ${coin}`, `${action} modal opens`, `${action} clicked`);
    }

    async clickDepositAction(coin: string): Promise<void> {
        await this.clickRowAction(coin, 'Deposit');
        await this.depositModalTitle.waitFor({ state: 'visible', timeout: 5000 });
    }

    async clickWithdrawAction(coin: string): Promise<void> {
        await this.clickRowAction(coin, 'Withdraw');
        await this.withdrawModalTitle.waitFor({ state: 'visible', timeout: 5000 });
    }

    async clickTransferAction(coin: string): Promise<void> {
        await this.clickRowAction(coin, 'Transfer');
        await this.transferModalTitle.waitFor({ state: 'visible', timeout: 5000 });
        // Confirmed live that clicking MAX right after the modal opens can read back "0" — the
        // Quantity/Avlb balance data the app computes MAX from apparently hasn't finished loading
        // yet. Polling here for the Quantity text to show at least one non-zero digit (not just any
        // digit, since "0.00" would also match a bare digit check) gives every subsequent action in
        // this modal a better chance of reading real, loaded data instead of a placeholder "0" state.
        for (let i = 0; i < 15; i++) {
            const text = await this.transferQuantityText.textContent().catch(() => '');
            if (text && /[1-9]/.test(text)) break;
            await this.page.waitForTimeout(200);
        }
    }

    // Bounded + idempotent: safe to call even if a modal was already closed by something else (e.g.
    // goBackFromSelectCoin()'s own fallback) — confirmed live that an unbounded click on a locator
    // matching zero elements (no modal open) hangs until the test's hard timeout, then surfaces as a
    // misleading "page/context/browser has been closed" error instead of a clean no-op.
    async closeModal(): Promise<void> {
        const closed = await this.modalCloseButton.click({ timeout: 5000 }).then(() => true).catch(() => false);
        this.logStep('Closed the open modal', 'modal closes (or was already closed)', closed ? 'closed' : 'no modal was open');
        if (closed) await this.page.waitForTimeout(300);
    }

    // ─── Deposit modal ────────────────────────────────────────────────────────────

    async isDepositModalVisible(): Promise<boolean> {
        const isVisible = await this.depositModalTitle.isVisible();
        this.logStep('Checked Deposit modal', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async getDepositAssetText(): Promise<string> {
        const text = ((await this.depositAssetField.textContent()) ?? '').trim();
        this.logStep('Read Deposit modal Asset field', 'the selected coin name', `"${text}"`);
        return text;
    }

    async getDepositNetworkText(): Promise<string> {
        const text = ((await this.depositNetworkField.textContent()) ?? '').trim();
        this.logStep('Read Deposit modal Network field', 'the selected coin\'s network', `"${text}"`);
        return text;
    }

    async getDepositAddressText(): Promise<string> {
        const text = ((await this.depositAddressText.textContent()) ?? '').trim();
        this.logStep('Read Deposit address', 'a non-empty address string', `"${text}"`);
        return text;
    }

    async isDepositQrVisible(): Promise<boolean> {
        const isVisible = await this.depositQrImage.isVisible();
        this.logStep('Checked Deposit QR code', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isDepositImportantSectionVisible(): Promise<boolean> {
        const isVisible = await this.depositImportantSection.isVisible();
        this.logStep('Checked Deposit "Important" notes section', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isDepositCopyIconVisible(): Promise<boolean> {
        const isVisible = await this.depositCopyIcon.isVisible();
        this.logStep('Checked copy icon on the deposit address', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async copyDepositAddress(): Promise<void> {
        await this.depositCopyIcon.click();
        this.logStep('Clicked the copy icon on the deposit address', 'address copied to clipboard', 'copy icon clicked');
    }

    // ─── Withdraw modal ───────────────────────────────────────────────────────────

    async isWithdrawModalVisible(): Promise<boolean> {
        const isVisible = await this.withdrawModalTitle.isVisible();
        this.logStep('Checked Withdraw modal', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async getWithdrawAvailableBalanceText(): Promise<string> {
        const text = ((await this.withdrawAvailableBalanceText.textContent()) ?? '').trim();
        this.logStep('Read Withdraw available balance', 'text containing "Avl Bal"', `"${text}"`);
        return text;
    }

    async fillWithdrawAmount(amount: string): Promise<void> {
        await this.withdrawAmountInput.fill(amount);
        this.logStep(`Filled withdraw amount: ${amount}`, 'amount field updated', `filled with "${amount}"`);
    }

    async clickWithdrawMax(): Promise<void> {
        await this.withdrawMaxLink.click();
        this.logStep('Clicked MAX on withdraw amount', 'amount field fills with the available balance', 'MAX clicked');
    }

    async getWithdrawAmountValue(): Promise<string> {
        const value = await this.withdrawAmountInput.inputValue();
        this.logStep('Read withdraw amount field value', 'a non-empty amount', `"${value}"`);
        return value;
    }

    async getWithdrawAssetText(): Promise<string> {
        const text = ((await this.withdrawAssetField.textContent()) ?? '').trim();
        this.logStep('Read Withdraw modal Asset field', 'the selected coin name', `"${text}"`);
        return text;
    }

    async getWithdrawNetworkText(): Promise<string> {
        const text = ((await this.withdrawNetworkField.textContent()) ?? '').trim();
        this.logStep('Read Withdraw modal Network field', 'the selected coin\'s network', `"${text}"`);
        return text;
    }

    async isWithdrawImportantSectionVisible(): Promise<boolean> {
        const isVisible = await this.withdrawImportantSection.isVisible();
        this.logStep('Checked Withdraw "Important" notes section', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async selectWithdrawTab(tab: WithdrawTab): Promise<void> {
        const target = tab === 'Deposit Address' ? this.withdrawDepositAddressTab : this.withdrawKnoozUserTab;
        await target.click();
        this.logStep(`Selected withdraw tab: ${tab}`, `${tab} tab becomes active`, `${tab} clicked`);
    }

    async fillWithdrawAddress(address: string): Promise<void> {
        await this.withdrawAddressInput.fill(address);
        this.logStep(`Filled withdraw address: ${address}`, 'address field updated', `filled with "${address}"`);
    }

    async isEnable2FAVisible(): Promise<boolean> {
        const isVisible = await this.withdrawEnable2FALink.isVisible();
        this.logStep('Checked "Enable 2FA" link', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isWithdrawContinueButtonVisible(): Promise<boolean> {
        const isVisible = await this.withdrawContinueButton.isVisible();
        this.logStep('Checked withdraw Continue button', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async clickWithdrawContinue(): Promise<void> {
        await this.withdrawContinueButton.click();
        this.logStep('Clicked Continue on withdraw modal', 'withdrawal flow proceeds', 'Continue clicked');
    }

    // ─── Transfer modal ───────────────────────────────────────────────────────────

    async isTransferModalVisible(): Promise<boolean> {
        const isVisible = await this.transferModalTitle.isVisible();
        this.logStep('Checked Transfer modal', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    // From/To values sit under separate "From"/"To" labels, each pairing with an h6 heading showing
    // the wallet name ("Funding" or "Spot") — reading the heading directly inside whichever row
    // container currently has the "From"/"To" label avoids depending on which wallet is in which
    // slot (that's exactly what changes when swapTransferDirection() runs).
    // Indexes directly into the h6 headings by position (From always renders above To) rather than
    // searching for a container div that also contains the "From"/"To" label text — confirmed live
    // that approach matched zero elements and hung until the action timeout. Uses explicit indices
    // 0/1, not .last() — confirmed live there's a third h6 further down (the Quantity value), so
    // .last() grabbed that instead of the To wallet name.
    private transferSlotHeading(slot: 'From' | 'To'): Locator {
        const headings = this.transferModal.locator(`h6`);
        return slot === 'From' ? headings.nth(0) : headings.nth(1);
    }

    async getTransferFromText(): Promise<string> {
        const text = ((await this.transferSlotHeading('From').textContent()) ?? '').trim();
        this.logStep('Read Transfer modal From wallet', 'the source wallet name', `"${text}"`);
        return text;
    }

    async getTransferToText(): Promise<string> {
        const text = ((await this.transferSlotHeading('To').textContent()) ?? '').trim();
        this.logStep('Read Transfer modal To wallet', 'the destination wallet name', `"${text}"`);
        return text;
    }

    async getTransferCoinText(): Promise<string> {
        const text = ((await this.transferCoinField.textContent()) ?? '').trim();
        this.logStep('Read Transfer modal Coin field', 'the selected coin name', `"${text}"`);
        return text;
    }

    async swapTransferDirection(): Promise<void> {
        await this.transferSwapIcon.click();
        await this.page.waitForTimeout(300);
        this.logStep('Clicked the Transfer swap icon', 'From/To values exchange', 'swap icon clicked');
    }

    async clickTransferCoinDropdown(): Promise<void> {
        await this.transferCoinDropdownIcon.click();
        await this.selectCoinTitle.waitFor({ state: 'visible', timeout: 5000 });
        this.logStep('Clicked the Coin dropdown icon', 'Select Coin panel opens', 'Select Coin panel opened');
    }

    // Kept as an alias for backward compatibility with existing call sites.
    async openSelectCoin(): Promise<void> {
        await this.clickTransferCoinDropdown();
    }

    async getTransferQuantityText(): Promise<string> {
        const text = ((await this.transferQuantityText.textContent()) ?? '').trim();
        this.logStep('Read Transfer modal Quantity text', 'available quantity for the selected coin', `"${text}"`);
        return text;
    }

    // Quantity text reads like "9.9778467 P2P / 126.14550458 Avlb" — the number immediately before
    // "Avlb" is the available balance for whichever wallet is currently in the "From" slot.
    async getTransferAvailableQuantity(): Promise<number> {
        const text = await this.getTransferQuantityText();
        const match = text.match(/([\d.]+)\s*Avlb/i);
        const amount = match ? parseFloat(match[1]) : 0;
        this.logStep('Parsed available quantity from Transfer modal', 'a numeric amount before "Avlb"', `${amount}`);
        return amount;
    }

    // The Quantity text reads like "X P2P / Y Avlb" — confirmed live that "Avlb" is NOT simply "the
    // currently-selected From wallet's balance" (it read the Spot amount even in the default
    // Funding→Spot direction), so this returns both numbers rather than assuming either position
    // maps to a specific wallet. Callers should check both wallet balances appear as a set instead
    // of asserting a fixed P2P-is-Funding/Avlb-is-Spot mapping.
    async getTransferQuantityNumbers(): Promise<number[]> {
        const text = await this.getTransferQuantityText();
        // Excludes digits embedded inside a word (e.g. the "2" in "P2P") via lookaround, rather than
        // just matching any digit run — confirmed live that a plain digit-run regex picked up a
        // spurious "2" from the literal text "P2P" alongside the two real balance numbers.
        const numbers = [...text.matchAll(/(?<![a-zA-Z])\d+(?:\.\d+)?(?![a-zA-Z])/g)].map(m => parseFloat(m[0]));
        this.logStep('Parsed all numbers from Transfer modal Quantity text', 'the Funding and Spot balances, in some order', `[${numbers.join(', ')}]`);
        return numbers;
    }

    async fillTransferAmount(amount: string): Promise<void> {
        await this.transferAmountInput.fill(amount);
        // Settles any async auto-recalculation (e.g. clamping an over-limit entry down to MAX)
        // before a caller reads the value back.
        await this.page.waitForTimeout(400);
        this.logStep(`Filled transfer amount: ${amount}`, 'amount field updated', `filled with "${amount}"`);
    }

    async clickTransferMax(): Promise<void> {
        await this.transferMaxLink.click();
        // Confirmed live that a fixed 400ms wait wasn't always enough — the field would settle on a
        // literal "0" (not the real balance) before an async update filled in the actual value a
        // moment later. Polls for the value to stop being "", "0", or "0.00" instead of guessing a
        // fixed delay, capped at ~3s so a genuinely-zero balance doesn't hang.
        for (let i = 0; i < 15; i++) {
            const value = await this.transferAmountInput.inputValue().catch(() => '');
            if (value !== '' && value !== '0' && value !== '0.00') break;
            await this.page.waitForTimeout(200);
        }
        this.logStep('Clicked MAX on transfer amount', 'amount field fills with the available balance', 'MAX clicked');
    }

    async getTransferAmountValue(): Promise<string> {
        const value = await this.transferAmountInput.inputValue();
        this.logStep('Read transfer amount field value', 'a non-empty amount', `"${value}"`);
        return value;
    }

    async isTransferAmountValidationVisible(): Promise<boolean> {
        const isVisible = await this.transferAmountValidationMessage.isVisible();
        this.logStep('Checked transfer amount validation message', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    // Matches lowercase — confirmed live the label renders as e.g. "usdt", not "USDT"; an exact
    // match against the uppercase CSV symbol found nothing.
    async isTransferAmountCurrencyLabelVisible(symbol: string): Promise<boolean> {
        const isVisible = await this.transferModal.getByText(symbol.toLowerCase(), { exact: true }).isVisible();
        this.logStep(`Checked transfer Amount currency label shows "${symbol.toLowerCase()}"`, 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isTransferConfirmButtonVisible(): Promise<boolean> {
        const isVisible = await this.transferConfirmButton.isVisible();
        this.logStep('Checked Transfer Confirm button', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async clickTransferConfirm(): Promise<void> {
        await this.transferConfirmButton.click();
        await this.page.waitForTimeout(500);
        this.logStep('Clicked Confirm on transfer modal', 'transfer executes', 'Confirm clicked');
    }

    // waitFor(), not isVisible({timeout}) — isVisible() checks the CURRENT state immediately and
    // does not actually wait for the element to appear, so a toast that renders slightly after
    // Confirm is clicked (network round-trip) was being missed even though the transfer itself
    // succeeded (confirmed live: the Funding balance had already decreased by the exact transferred
    // amount on a run where this check reported "not visible").
    async isTransferSuccessMessageVisible(): Promise<boolean> {
        const isVisible = await this.transferSuccessMessage.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
        this.logStep('Checked "Transfer successful" message', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    // ─── Select Coin panel ────────────────────────────────────────────────────────

    async isSelectCoinPanelVisible(): Promise<boolean> {
        const isVisible = await this.selectCoinTitle.isVisible();
        this.logStep('Checked Select Coin panel', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async searchCoinInSelectPanel(query: string): Promise<void> {
        await this.selectCoinSearchInput.fill(query);
        await this.page.waitForTimeout(500);
        this.logStep(`Searched Select Coin panel: "${query}"`, 'panel filters to matching coins', 'search applied');
    }

    // Scoped to the actual list-item row class (.style_Asset_body_list__R-AOS), not a generic "any
    // div containing this text" + .last() — confirmed live that a plain `div` filter's .last() picks
    // the deepest matching div in DOM order, which for this markup is just the icon/name wrapper
    // (.style_Asset_body_list_imgSec__mBM36). The balance (.dataAssets) lives in a SIBLING column
    // div, not a descendant of that innermost wrapper, so scoping there made every balance read
    // permanently empty. The row container itself (.style_Asset_body_list__R-AOS) is the nearest
    // shared ancestor of both the name and the balance columns.
    private selectCoinPanelRow(coin: string): Locator {
        return this.page.locator('.ant-modal-content').filter({ hasText: 'Select Coin' })
            .locator('.style_Asset_body_list__R-AOS').filter({ hasText: coin }).first();
    }

    async isCoinVisibleInSelectPanel(coin: string): Promise<boolean> {
        const isVisible = await this.selectCoinPanelRow(coin).isVisible();
        this.logStep(`Checked "${coin}" row in Select Coin panel`, 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async isCoinIconVisibleInSelectPanel(coin: string): Promise<boolean> {
        const isVisible = await this.selectCoinPanelRow(coin).getByRole('img', { name: 'image' }).isVisible();
        this.logStep(`Checked coin icon for "${coin}" in Select Coin panel`, 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    // A row's right-hand column holds two ".dataAssets" spans: the coin balance, then its $ value.
    // Bounded: confirmed live that the row and its coin icon can both resolve as visible while
    // ".dataAssets" within that same row still isn't ready yet (deep in a long continuous flow,
    // after several prior modal open/close cycles) — a short timeout with a graceful empty fallback
    // avoids hanging the whole test/serial-chain the way an unbounded wait did.
    // Polls rather than reading once: confirmed live the row and its coin icon can both resolve as
    // visible while ".dataAssets" is still empty a moment longer — the same "balance data loads
    // asynchronously after the row itself renders" pattern already found and fixed for the Transfer
    // modal's Quantity text and MAX value.
    // .dataAssets isn't scoped per-row — it's page-wide (one balance/$-value pair per visible row).
    // Confirmed live: since searchCoinInSelectPanel() already narrows the list down to one matching
    // row before this is called, page.locator('.dataAssets').first()/.last() unambiguously resolves
    // to that row's balance and $ value — no row-scoping needed (and row-scoping was the source of
    // the earlier flaky empty reads here).
    // Scoped to this specific coin's row (via selectCoinPanelRow, matching the full coin name) rather
    // than page-wide ".dataAssets" first()/last() — confirmed live that searching by symbol (e.g.
    // "ETH") can match more than one row at once (the same "TETHER contains ETH as a substring"
    // collision found earlier for the Funding table search), which made an unscoped page-wide
    // first()/last() read balance data from the WRONG row (Tether's, not Ethereum's). Polls within
    // the scoped row for the same reason as before: the balance can still be loading a moment after
    // the row itself renders.
    async getSelectCoinRowData(coin: string): Promise<{ balanceText: string; usdText: string }> {
        const dataAssets = this.selectCoinPanelRow(coin).locator('.dataAssets');
        let balanceText = '';
        for (let i = 0; i < 15; i++) {
            balanceText = ((await dataAssets.first().textContent({ timeout: 1000 }).catch(() => '')) ?? '').trim();
            if (balanceText !== '') break;
            await this.page.waitForTimeout(200);
        }
        const usdText = ((await dataAssets.last().textContent({ timeout: 2000 }).catch(() => '')) ?? '').trim();
        this.logStep(`Read "${coin}" row data in Select Coin panel`, 'balance and $ value', `balance: "${balanceText}", $ value: "${usdText}"`);
        return { balanceText, usdText };
    }

    async selectCoinFromPanel(coin: string): Promise<void> {
        await this.selectCoinPanelRow(coin).click();
        await this.page.waitForTimeout(300);
        this.logStep(`Selected "${coin}" from the Select Coin panel`, 'Transfer modal Coin field updates', `${coin} selected`);
    }

    // Bounded click with a fallback to closing the whole panel: if the confirmed .curserPointer class
    // above is ever reused for the wrong element, this degrades to a clean close instead of hanging
    // on the unmatched locator until the test's hard timeout kills the page mid-flight.
    async goBackFromSelectCoin(): Promise<void> {
        const clicked = await this.selectCoinBackButton.click({ timeout: 5000 }).then(() => true).catch(() => false);
        if (!clicked) {
            this.logStep('Clicked Select Coin back button', 'returns to Transfer modal', 'back button not found — falling back to close');
            await this.closeSelectCoinPanel();
            return;
        }
        await this.page.waitForTimeout(300);
        this.logStep('Clicked Select Coin back button', 'returns to Transfer modal', 'went back');
    }

    async closeSelectCoinPanel(): Promise<void> {
        const closed = await this.selectCoinCloseButton.click({ timeout: 5000 }).then(() => true).catch(() => false);
        this.logStep('Closed the Select Coin panel', 'panel closes (or was already closed)', closed ? 'closed' : 'no panel was open');
        if (closed) await this.page.waitForTimeout(300);
    }

    // ─── Private parsing helpers ──────────────────────────────────────────────────

    private parseNativeAmount(text: string): number {
        const match = text.match(/([\d]+\.[\d]+|[\d]+)/);
        return match ? parseFloat(match[1]) : 0;
    }

    // No fallback to the native amount when there's no "≈$" marker — confirmed live that some
    // custom/unpriced test tokens (e.g. "XYZ", "Xye") render a Total cell with no USD-equivalent
    // suffix at all, and treating their raw native quantity as if it were itself a dollar figure
    // wildly inflated the account-wide sum (a difference of ~278 vs the true Estimated Balance).
    // Every real, priced currency in this app consistently shows "≈$X" — its absence means $0.
    private parseUsdValue(text: string): number {
        const approx = text.match(/[≈~]\$?([\d,.]+)/);
        return approx ? parseFloat(approx[1].replace(',', '')) : 0;
    }
}
