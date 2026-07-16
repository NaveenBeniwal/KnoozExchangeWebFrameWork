import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';

export type P2PTab = 'Market Update' | 'My Ads' | 'My Orders' | 'User Dashboard';
export type BuySellMode = 'Buy' | 'Sell';
export type P2PCurrency = 'USDT' | 'BTC' | 'ETH' | 'BNB';
export type HowP2PWorksStep = 1 | 2 | 3;
export type FiatMethod = 'ALL METHODS' | 'USD' | 'INR' | 'CAD';
export type PaymentMethod = 'ALL METHODS' | 'SKRILL' | 'TEST UPI' | 'ZINLI' | 'TEST' | 'UNITED STATE' | 'PHONEPE';

export class P2PPage extends BasePage {

    // ─── Locators ─────────────────────────────────────────────────────────────────

    // Sidebar navigation
    private readonly p2pNavLink: Locator;
    private readonly homeNavLink: Locator;

    // Risk Notice popup
    private readonly riskNoticePopup: Locator;
    private readonly riskNoticeHeading: Locator;
    private readonly riskNoticeGreyText: Locator;
    private readonly riskNoticeCheckboxLabel: Locator;
    private readonly riskNoticeCheckbox: Locator;
    private readonly riskNoticeCloseButton: Locator;
    private readonly riskNoticeConfirmButtonBox: Locator;
    private readonly riskNoticeConfirmButtonText: Locator;

    // P2P landing page
    private readonly peerToPeerHeading: Locator;

    // Top tab bar
    private readonly marketUpdateTab: Locator;
    private readonly myAdsTab: Locator;
    private readonly myOrdersTab: Locator;
    private readonly userDashboardTab: Locator;

    // "How P2P Works" section
    private readonly howP2PWorksSection: Locator;
    private readonly howP2PWorksHeading: Locator;
    private readonly howP2PWorksSubText: Locator;
    private readonly buySellToggleTopBuy: Locator;
    private readonly buySellToggleTopSell: Locator;
    private readonly howP2PWorksSteps: Locator;

    // Currency listing section (2nd tab)
    private readonly landingMainTab: Locator;
    private readonly p2pListingHeading: Locator;
    private readonly currencyTabsNav: Locator;
    private readonly buySellToggleBottomBuy: Locator;
    private readonly buySellToggleBottomSell: Locator;
    private readonly usdtCurrencyTab: Locator;
    private readonly btcCurrencyTab: Locator;
    private readonly ethCurrencyTab: Locator;
    private readonly bnbCurrencyTab: Locator;
    private readonly usdtTabPanel: Locator;
    private readonly btcTabPanel: Locator;
    private readonly ethTabPanel: Locator;
    private readonly bnbTabPanel: Locator;

    // Filters — one set per currency tabpanel (see constructor note on why these are scoped
    // instead of the flat nth() locators originally given)
    private readonly usdtAmountFilter: Locator;
    private readonly btcAmountFilter: Locator;
    private readonly ethAmountFilter: Locator;
    private readonly bnbAmountFilter: Locator;
    private readonly usdtCountryFilter: Locator;
    private readonly btcCountryFilter: Locator;
    private readonly ethCountryFilter: Locator;
    private readonly bnbCountryFilter: Locator;
    private readonly usdtFiatFilter: Locator;
    private readonly btcFiatFilter: Locator;
    private readonly ethFiatFilter: Locator;
    private readonly bnbFiatFilter: Locator;
    private readonly usdtPaymentFilter: Locator;
    private readonly btcPaymentFilter: Locator;
    private readonly ethPaymentFilter: Locator;
    private readonly bnbPaymentFilter: Locator;
    private readonly usdtResetFilterButton: Locator;
    private readonly btcResetFilterButton: Locator;
    private readonly ethResetFilterButton: Locator;
    private readonly bnbResetFilterButton: Locator;

    // "No data" empty state — one set per currency tabpanel (same scoping reason as the filters)
    private readonly usdtNoDataText: Locator;
    private readonly btcNoDataText: Locator;
    private readonly ethNoDataText: Locator;
    private readonly bnbNoDataText: Locator;
    private readonly usdtNoDataIcon: Locator;
    private readonly btcNoDataIcon: Locator;
    private readonly ethNoDataIcon: Locator;
    private readonly bnbNoDataIcon: Locator;

    // Current selected value shown on each dropdown filter — within one currency's own tabpanel,
    // the three ant-select dropdowns render in a fixed order: Country, Fiat, Payment
    private readonly usdtCountryFilterValue: Locator;
    private readonly btcCountryFilterValue: Locator;
    private readonly ethCountryFilterValue: Locator;
    private readonly bnbCountryFilterValue: Locator;
    private readonly usdtFiatFilterValue: Locator;
    private readonly btcFiatFilterValue: Locator;
    private readonly ethFiatFilterValue: Locator;
    private readonly bnbFiatFilterValue: Locator;
    private readonly usdtPaymentFilterValue: Locator;
    private readonly btcPaymentFilterValue: Locator;
    private readonly ethPaymentFilterValue: Locator;
    private readonly bnbPaymentFilterValue: Locator;

    // Options inside whichever dropdown is currently open — only one dropdown is open at a time,
    // so these don't need per-currency scoping. Not getByRole('option', ...): that role element is
    // a zero-width accessibility/measurement clone from the virtualized list (confirmed live — its
    // bounding box is {width: 0}, so every click on it timed out as "not visible"/"outside
    // viewport"); '.ant-select-item-option-content' is the real, visibly-rendered node.
    private readonly fiatOptionAllMethods: Locator;
    private readonly fiatOptionUSD: Locator;
    private readonly fiatOptionINR: Locator;
    private readonly fiatOptionCAD: Locator;
    private readonly paymentOptionAllMethods: Locator;
    private readonly paymentOptionSkrill: Locator;
    private readonly paymentOptionTestUpi: Locator;
    private readonly paymentOptionZinli: Locator;
    private readonly paymentOptionTest: Locator;
    private readonly paymentOptionUnitedState: Locator;
    private readonly paymentOptionPhonepe: Locator;
    private readonly countryOptionIndia: Locator;

    constructor(page: Page) {
        super(page);

        this.p2pNavLink  = page.getByText('P2P', { exact: true }).last();
        this.homeNavLink = page.getByText('Home', { exact: true }).last();
        this.riskNoticePopup             = page.locator('.ant-modal.p2pCommonPay');
        this.riskNoticeHeading           = page.getByText('Risk Notice', { exact: true });
        this.riskNoticeGreyText          = page.locator('.GreyText');
        this.riskNoticeCheckboxLabel     = page.getByText('I have read and agree to the above content.', { exact: true }).last();
        this.riskNoticeCheckbox          = page.locator('.ant-checkbox-input');
        this.riskNoticeCloseButton       = page.getByText('Close', { exact: true }).last();
        this.riskNoticeConfirmButtonBox  = page.locator(`div.headerModals__div > div.notifybuttons > button.ant-btn`).last();
        this.riskNoticeConfirmButtonText = page.getByText('Confirm', { exact: true }).last();

        this.peerToPeerHeading = page.getByRole('heading', { name: 'Peer To Peer', level: 3 });

        this.marketUpdateTab   = page.getByText('Market Update', { exact: true }).last();
        this.myAdsTab          = page.getByText('My Ads', { exact: true }).last();
        this.myOrdersTab       = page.getByText('My Orders', { exact: true }).last();
        this.userDashboardTab = page.getByText('User Dashboard', { exact: true }).last();

        this.howP2PWorksSection  = page.locator(`.howworks.c-p2p`);
        this.howP2PWorksHeading  = page.getByRole('heading', { name: 'How P2P Works', level: 3 });
        this.howP2PWorksSubText  = page.locator(`div.works > div > p`);
        this.buySellToggleTopBuy  = page.getByRole('button', { name: 'Buy' }).first();
        this.buySellToggleTopSell = page.getByRole('button', { name: 'Sell' }).first();
        this.howP2PWorksSteps    = page.locator(`div.placeanorder__imgeitem > div.text__inplaceorder > p`);

        this.landingMainTab   = page.locator(`.landingmaintab__mainintab`);
        this.p2pListingHeading = page.getByRole('heading', { name: 'P2P', exact: true, level: 3 });
        this.currencyTabsNav  = page.locator('.ant-tabs-nav').last();
        this.buySellToggleBottomBuy  = page.getByRole('button', { name: 'Buy' }).last();
        this.buySellToggleBottomSell = page.getByRole('button', { name: 'Sell' }).last();

        this.usdtCurrencyTab = page.getByText('USDT', { exact: true }).last();
        this.btcCurrencyTab  = page.getByText('BTC', { exact: true }).last();
        this.ethCurrencyTab  = page.getByText('ETH', { exact: true }).last();
        this.bnbCurrencyTab  = page.getByText('BNB', { exact: true }).last();

        this.usdtTabPanel = page.getByRole('tabpanel', { name: 'USDT' });
        this.btcTabPanel  = page.getByRole('tabpanel', { name: 'BTC' });
        this.ethTabPanel  = page.getByRole('tabpanel', { name: 'ETH' });
        this.bnbTabPanel  = page.getByRole('tabpanel', { name: 'BNB' });

        this.usdtAmountFilter = this.usdtTabPanel.getByRole('textbox', { name: 'Enter Amount' });
        this.btcAmountFilter  = this.btcTabPanel.getByRole('textbox', { name: 'Enter Amount' });
        this.ethAmountFilter  = this.ethTabPanel.getByRole('textbox', { name: 'Enter Amount' });
        this.bnbAmountFilter  = this.bnbTabPanel.getByRole('textbox', { name: 'Enter Amount' });

        this.usdtCountryFilter = this.usdtTabPanel.getByText('All regions', { exact: true });
        this.btcCountryFilter  = this.btcTabPanel.getByText('All regions', { exact: true });
        this.ethCountryFilter  = this.ethTabPanel.getByText('All regions', { exact: true });
        this.bnbCountryFilter  = this.bnbTabPanel.getByText('All regions', { exact: true });

        // Within one active tabpanel, "ALL METHODS" appears exactly twice: Fiat first, Payment last
        this.usdtFiatFilter = this.usdtTabPanel.getByText('ALL METHODS', { exact: true }).first();
        this.btcFiatFilter  = this.btcTabPanel.getByText('ALL METHODS', { exact: true }).first();
        this.ethFiatFilter  = this.ethTabPanel.getByText('ALL METHODS', { exact: true }).first();
        this.bnbFiatFilter  = this.bnbTabPanel.getByText('ALL METHODS', { exact: true }).first();

        this.usdtPaymentFilter = this.usdtTabPanel.getByText('ALL METHODS', { exact: true }).last();
        this.btcPaymentFilter  = this.btcTabPanel.getByText('ALL METHODS', { exact: true }).last();
        this.ethPaymentFilter  = this.ethTabPanel.getByText('ALL METHODS', { exact: true }).last();
        this.bnbPaymentFilter  = this.bnbTabPanel.getByText('ALL METHODS', { exact: true }).last();

        this.usdtResetFilterButton = this.usdtTabPanel.getByText('Reset', { exact: true });
        this.btcResetFilterButton  = this.btcTabPanel.getByText('Reset', { exact: true });
        this.ethResetFilterButton  = this.ethTabPanel.getByText('Reset', { exact: true });
        this.bnbResetFilterButton  = this.bnbTabPanel.getByText('Reset', { exact: true });

        this.usdtNoDataText = this.usdtTabPanel.getByText('No data', { exact: true });
        this.btcNoDataText  = this.btcTabPanel.getByText('No data', { exact: true });
        this.ethNoDataText  = this.ethTabPanel.getByText('No data', { exact: true });
        this.bnbNoDataText  = this.bnbTabPanel.getByText('No data', { exact: true });
        this.usdtNoDataIcon = this.usdtTabPanel.locator('g > g > path').last();
        this.btcNoDataIcon  = this.btcTabPanel.locator('g > g > path').last();
        this.ethNoDataIcon  = this.ethTabPanel.locator('g > g > path').last();
        this.bnbNoDataIcon  = this.bnbTabPanel.locator('g > g > path').last();

        // Order within one tabpanel's filter row: Country (0), Fiat (1), Payment (2)
        this.usdtCountryFilterValue = this.usdtTabPanel.locator('.ant-select-selector').nth(0);
        this.btcCountryFilterValue  = this.btcTabPanel.locator('.ant-select-selector').nth(0);
        this.ethCountryFilterValue  = this.ethTabPanel.locator('.ant-select-selector').nth(0);
        this.bnbCountryFilterValue  = this.bnbTabPanel.locator('.ant-select-selector').nth(0);
        this.usdtFiatFilterValue = this.usdtTabPanel.locator('.ant-select-selector').nth(1);
        this.btcFiatFilterValue  = this.btcTabPanel.locator('.ant-select-selector').nth(1);
        this.ethFiatFilterValue  = this.ethTabPanel.locator('.ant-select-selector').nth(1);
        this.bnbFiatFilterValue  = this.bnbTabPanel.locator('.ant-select-selector').nth(1);
        this.usdtPaymentFilterValue = this.usdtTabPanel.locator('.ant-select-selector').nth(2);
        this.btcPaymentFilterValue  = this.btcTabPanel.locator('.ant-select-selector').nth(2);
        this.ethPaymentFilterValue  = this.ethTabPanel.locator('.ant-select-selector').nth(2);
        this.bnbPaymentFilterValue  = this.bnbTabPanel.locator('.ant-select-selector').nth(2);

        // Scoped to '.ant-select-dropdown:visible' — a currency's own dropdown list stays mounted
        // (just hidden) after it's used once, same as the tabpanes; opening the SAME dropdown kind
        // (e.g. Fiat) on a different currency then matches both the old hidden list and the new
        // visible one (confirmed live: 2-way strict-mode violation on BTC's Fiat "USD" option,
        // right after selecting Fiat on USDT). Only the genuinely visible one should ever match.
        const openDropdown = page.locator('.ant-select-dropdown:visible');
        this.fiatOptionAllMethods = openDropdown.locator('.ant-select-item-option-content', { hasText: /^ALL METHODS$/ });
        this.fiatOptionUSD        = openDropdown.locator('.ant-select-item-option-content', { hasText: /^USD$/ });
        this.fiatOptionINR        = openDropdown.locator('.ant-select-item-option-content', { hasText: /^INR$/ });
        this.fiatOptionCAD        = openDropdown.locator('.ant-select-item-option-content', { hasText: /^CAD$/ });

        this.paymentOptionAllMethods  = openDropdown.locator('.ant-select-item-option-content', { hasText: /^ALL METHODS$/ });
        this.paymentOptionSkrill      = openDropdown.locator('.ant-select-item-option-content', { hasText: /^SKRILL$/ });
        this.paymentOptionTestUpi     = openDropdown.locator('.ant-select-item-option-content', { hasText: /^TEST UPI$/ });
        this.paymentOptionZinli       = openDropdown.locator('.ant-select-item-option-content', { hasText: /^ZINLI$/ });
        this.paymentOptionTest        = openDropdown.locator('.ant-select-item-option-content', { hasText: /^TEST$/ });
        this.paymentOptionUnitedState = openDropdown.locator('.ant-select-item-option-content', { hasText: /^UNITED STATE$/ });

        // .first() — even within the one visible dropdown, the India/INR Payment list has two
        // separate "PHONEPE" entries (confirmed live: 2-way strict-mode violation without it),
        // which looks like a duplicate in the backend's payment-methods data.
        this.paymentOptionPhonepe = openDropdown.locator('.ant-select-item-option-content', { hasText: /^PHONEPE$/ }).first();

        this.countryOptionIndia = openDropdown.locator('.ant-select-item-option-content', { hasText: /^India$/ });
    }

    // ─── TC-01 — also reused to reopen P2P in TC-05 ──────────────────────────────

    async clickP2PNav(): Promise<void> {
        await this.p2pNavLink.click();
        await this.page.waitForLoadState('networkidle');
        console.log('[P2PPage][clickP2PNav] Clicked "P2P" nav link');
    }

    // Also reused by TC-04/TC-05/TC-06 to check the popup's open/closed state
    async isRiskNoticePopupVisible(): Promise<boolean> {
        const isVisible = await this.riskNoticePopup.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
        console.log(`[P2PPage][isRiskNoticePopupVisible] visible: ${isVisible}`);
        return isVisible;
    }

    // ─── TC-02 — also reused when the popup reopens in TC-05 ─────────────────────

    async getRiskNoticeHeadingText(): Promise<string> {
        const text = (await this.riskNoticeHeading.textContent()) ?? '';
        console.log(`[P2PPage][getRiskNoticeHeadingText] text: "${text}"`);
        return text;
    }

    async getRiskNoticeGreyText(): Promise<string> {
        const text = (await this.riskNoticeGreyText.textContent()) ?? '';
        console.log(`[P2PPage][getRiskNoticeGreyText] text: "${text}"`);
        return text;
    }

    async getRiskNoticeCheckboxLabelText(): Promise<string> {
        const text = (await this.riskNoticeCheckboxLabel.textContent()) ?? '';
        console.log(`[P2PPage][getRiskNoticeCheckboxLabelText] text: "${text}"`);
        return text;
    }

    // ─── TC-03 ────────────────────────────────────────────────────────────────────

    async isRiskNoticeCheckboxVisible(): Promise<boolean> {
        const isVisible = await this.riskNoticeCheckbox.isVisible();
        console.log(`[P2PPage][isRiskNoticeCheckboxVisible] visible: ${isVisible}`);
        return isVisible;
    }

    // Also reused by TC-06 to confirm the checkbox got checked
    async isRiskNoticeCheckboxChecked(): Promise<boolean> {
        return this.riskNoticeCheckbox.isChecked();
    }

    async isRiskNoticeCloseButtonEnabled(): Promise<boolean> {
        const isEnabled = await this.riskNoticeCloseButton.isEnabled();
        console.log(`[P2PPage][isRiskNoticeCloseButtonEnabled] enabled: ${isEnabled}`);
        return isEnabled;
    }

    // Also reused by TC-06 to confirm Confirm becomes enabled once the checkbox is checked
    async isRiskNoticeConfirmButtonEnabled(): Promise<boolean> {
        const isEnabled = await this.riskNoticeConfirmButtonBox.isEnabled();
        console.log(`[P2PPage][isRiskNoticeConfirmButtonEnabled] enabled: ${isEnabled}`);
        return isEnabled;
    }

    // ─── TC-04 ────────────────────────────────────────────────────────────────────

    async clickRiskNoticeCloseButton(): Promise<void> {
        await this.riskNoticeCloseButton.click();
        await this.riskNoticePopup.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        console.log('[P2PPage][clickRiskNoticeCloseButton] popup closed');
    }

    async isHomeNavVisible(): Promise<boolean> {
        const isVisible = await this.homeNavLink.isVisible();
        console.log(`[P2PPage][isHomeNavVisible] visible: ${isVisible}`);
        return isVisible;
    }

    // Not currently exercised by a numbered test — pairs with isHomeNavVisible above
    async clickHomeNav(): Promise<void> {
        await this.homeNavLink.click();
        await this.page.waitForLoadState('networkidle');
        console.log('[P2PPage][clickHomeNav] Clicked "Home" nav link');
    }

    // ─── TC-05 — reuses clickP2PNav, isRiskNoticePopupVisible, getRiskNoticeHeadingText and
    // getRiskNoticeGreyText from TC-01/TC-02 above; no new methods ───────────────────────────

    // ─── TC-06 ────────────────────────────────────────────────────────────────────

    async checkRiskNoticeCheckbox(): Promise<void> {
        await this.page.waitForTimeout(2000);
        await this.riskNoticeCheckbox.check({ force: true, timeout: 10000 });
        console.log('[P2PPage][checkRiskNoticeCheckbox] checkbox checked');
    }

    async clickRiskNoticeConfirmButton(): Promise<void> {
        await this.riskNoticeConfirmButtonText.click();
        await this.riskNoticePopup.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        console.log('[P2PPage][clickRiskNoticeConfirmButton] popup closed');
    }

    async isPeerToPeerHeadingVisible(): Promise<boolean> {
        const isVisible = await this.peerToPeerHeading.isVisible().catch(() => false);
        console.log(`[P2PPage][isPeerToPeerHeadingVisible] visible: ${isVisible}`);
        return isVisible;
    }

    // ─── TC-07 ────────────────────────────────────────────────────────────────────

    private getTab(tab: P2PTab): Locator {
        const map: Record<P2PTab, Locator> = {
            'Market Update':  this.marketUpdateTab,
            'My Ads':         this.myAdsTab,
            'My Orders':      this.myOrdersTab,
            'User Dashboard': this.userDashboardTab,
        };
        return map[tab];
    }

    async isTabVisible(tab: P2PTab): Promise<boolean> {
        const isVisible = await this.getTab(tab).isVisible();
        console.log(`[P2PPage][isTabVisible] tab: ${tab} | visible: ${isVisible}`);
        return isVisible;
    }

    async clickTab(tab: P2PTab): Promise<void> {
        await this.getTab(tab).click();
        await this.page.waitForTimeout(500);
        console.log(`[P2PPage][clickTab] tab: ${tab} clicked`);
    }

    // ─── TC-08 ────────────────────────────────────────────────────────────────────

    async isHowP2PWorksSectionVisible(): Promise<boolean> {
        const isVisible = await this.howP2PWorksSection.isVisible();
        console.log(`[P2PPage][isHowP2PWorksSectionVisible] visible: ${isVisible}`);
        return isVisible;
    }

    async isHowP2PWorksHeadingVisible(): Promise<boolean> {
        const isVisible = await this.howP2PWorksHeading.isVisible();
        console.log(`[P2PPage][isHowP2PWorksHeadingVisible] visible: ${isVisible}`);
        return isVisible;
    }

    async getHowP2PWorksSubText(): Promise<string> {
        const text = (await this.howP2PWorksSubText.textContent()) ?? '';
        console.log(`[P2PPage][getHowP2PWorksSubText] text: "${text}"`);
        return text;
    }

    // ─── TC-09 — also reused by TC-10/TC-11 to re-read the step text after toggling ────────

    private getBuySellToggleTop(mode: BuySellMode): Locator {
        return mode === 'Buy' ? this.buySellToggleTopBuy : this.buySellToggleTopSell;
    }

    // Steps 1/2/3 sit at DOM indices 1/3/5 of the shared paragraph list (each step renders an
    // icon <p> in between the label <p>s, so the visible steps land on the odd indices).
    private readonly howP2PWorksStepIndex: Record<HowP2PWorksStep, number> = { 1: 1, 2: 3, 3: 5 };

    async getHowP2PWorksStepText(step: HowP2PWorksStep): Promise<string> {
        const index = this.howP2PWorksStepIndex[step];
        const text = (await this.howP2PWorksSteps.nth(index).textContent()) ?? '';
        console.log(`[P2PPage][getHowP2PWorksStepText] step: ${step} | text: "${text}"`);
        return text;
    }

    // ─── TC-10 ────────────────────────────────────────────────────────────────────

    async selectBuySellToggleTop(mode: BuySellMode): Promise<void> {
        await this.getBuySellToggleTop(mode).click();
        await this.page.waitForTimeout(500);
        console.log(`[P2PPage][selectBuySellToggleTop] mode: ${mode} selected`);
    }

    // ─── TC-11 — reuses selectBuySellToggleTop and getHowP2PWorksStepText above; no new
    // methods ────────────────────────────────────────────────────────────────────────────

    // ─── TC-12 ────────────────────────────────────────────────────────────────────

    async isLandingMainTabVisible(): Promise<boolean> {
        const isVisible = await this.landingMainTab.isVisible();
        console.log(`[P2PPage][isLandingMainTabVisible] visible: ${isVisible}`);
        return isVisible;
    }

    async scrollToP2PListingHeading(): Promise<void> {
        await this.p2pListingHeading.scrollIntoViewIfNeeded();
        console.log('[P2PPage][scrollToP2PListingHeading] scrolled into view');
    }

    async isP2PListingHeadingVisible(): Promise<boolean> {
        const isVisible = await this.p2pListingHeading.isVisible();
        console.log(`[P2PPage][isP2PListingHeadingVisible] visible: ${isVisible}`);
        return isVisible;
    }

    async isCurrencyTabsNavVisible(): Promise<boolean> {
        const isVisible = await this.currencyTabsNav.isVisible();
        console.log(`[P2PPage][isCurrencyTabsNavVisible] visible: ${isVisible}`);
        return isVisible;
    }

    // ─── TC-13 ────────────────────────────────────────────────────────────────────

    private getBuySellToggleBottom(mode: BuySellMode): Locator {
        return mode === 'Buy' ? this.buySellToggleBottomBuy : this.buySellToggleBottomSell;
    }

    async selectBuySellToggleBottom(mode: BuySellMode): Promise<void> {
        await this.getBuySellToggleBottom(mode).click();
        await this.page.waitForTimeout(500);
        console.log(`[P2PPage][selectBuySellToggleBottom] mode: ${mode} selected`);
    }

    // ─── TC-14 — also reused by TC-15/TC-16/TC-17 to switch currency before checking filters
    // and the No data state ─────────────────────────────────────────────────────────────────

    private getCurrencyTab(currency: P2PCurrency): Locator {
        const map: Record<P2PCurrency, Locator> = {
            USDT: this.usdtCurrencyTab,
            BTC:  this.btcCurrencyTab,
            ETH:  this.ethCurrencyTab,
            BNB:  this.bnbCurrencyTab,
        };
        return map[currency];
    }

    private getCurrencyTabPanel(currency: P2PCurrency): Locator {
        const map: Record<P2PCurrency, Locator> = {
            USDT: this.usdtTabPanel,
            BTC:  this.btcTabPanel,
            ETH:  this.ethTabPanel,
            BNB:  this.bnbTabPanel,
        };
        return map[currency];
    }

    async isCurrencyTabVisible(currency: P2PCurrency): Promise<boolean> {
        const isVisible = await this.getCurrencyTab(currency).isVisible();
        console.log(`[P2PPage][isCurrencyTabVisible] currency: ${currency} | visible: ${isVisible}`);
        return isVisible;
    }

    async clickCurrencyTab(currency: P2PCurrency): Promise<void> {
        await this.getCurrencyTab(currency).click();
        await this.page.waitForTimeout(500);
        console.log(`[P2PPage][clickCurrencyTab] currency: ${currency} clicked`);
    }

    async isCurrencyTabPanelVisible(currency: P2PCurrency): Promise<boolean> {
        const isVisible = await this.getCurrencyTabPanel(currency).isVisible();
        console.log(`[P2PPage][isCurrencyTabPanelVisible] currency: ${currency} | visible: ${isVisible}`);
        return isVisible;
    }

    // ─── TC-15 — every filter method takes the currency whose tabpanel it should read/act on ──

    private getAmountFilter(currency: P2PCurrency): Locator {
        const map: Record<P2PCurrency, Locator> = {
            USDT: this.usdtAmountFilter,
            BTC:  this.btcAmountFilter,
            ETH:  this.ethAmountFilter,
            BNB:  this.bnbAmountFilter,
        };
        return map[currency];
    }

    private getCountryFilter(currency: P2PCurrency): Locator {
        const map: Record<P2PCurrency, Locator> = {
            USDT: this.usdtCountryFilter,
            BTC:  this.btcCountryFilter,
            ETH:  this.ethCountryFilter,
            BNB:  this.bnbCountryFilter,
        };
        return map[currency];
    }

    private getFiatFilter(currency: P2PCurrency): Locator {
        const map: Record<P2PCurrency, Locator> = {
            USDT: this.usdtFiatFilter,
            BTC:  this.btcFiatFilter,
            ETH:  this.ethFiatFilter,
            BNB:  this.bnbFiatFilter,
        };
        return map[currency];
    }

    private getPaymentFilter(currency: P2PCurrency): Locator {
        const map: Record<P2PCurrency, Locator> = {
            USDT: this.usdtPaymentFilter,
            BTC:  this.btcPaymentFilter,
            ETH:  this.ethPaymentFilter,
            BNB:  this.bnbPaymentFilter,
        };
        return map[currency];
    }

    private getResetFilterButton(currency: P2PCurrency): Locator {
        const map: Record<P2PCurrency, Locator> = {
            USDT: this.usdtResetFilterButton,
            BTC:  this.btcResetFilterButton,
            ETH:  this.ethResetFilterButton,
            BNB:  this.bnbResetFilterButton,
        };
        return map[currency];
    }

    async isAmountFilterVisible(currency: P2PCurrency): Promise<boolean> {
        const isVisible = await this.getAmountFilter(currency).isVisible();
        console.log(`[P2PPage][isAmountFilterVisible] currency: ${currency} | visible: ${isVisible}`);
        return isVisible;
    }

    async fillAmountFilter(currency: P2PCurrency, amount: string): Promise<void> {
        await this.getAmountFilter(currency).fill(amount);
        console.log(`[P2PPage][fillAmountFilter] currency: ${currency} | amount: ${amount}`);
    }

    async getAmountFilterValue(currency: P2PCurrency): Promise<string> {
        const value = await this.getAmountFilter(currency).inputValue();
        console.log(`[P2PPage][getAmountFilterValue] currency: ${currency} | value: "${value}"`);
        return value;
    }

    async isCountryFilterVisible(currency: P2PCurrency): Promise<boolean> {
        const isVisible = await this.getCountryFilter(currency).isVisible();
        console.log(`[P2PPage][isCountryFilterVisible] currency: ${currency} | visible: ${isVisible}`);
        return isVisible;
    }

    async clickCountryFilter(currency: P2PCurrency): Promise<void> {
        await this.getCountryFilter(currency).click();
        console.log(`[P2PPage][clickCountryFilter] currency: ${currency} clicked`);
    }

    async isFiatFilterVisible(currency: P2PCurrency): Promise<boolean> {
        const isVisible = await this.getFiatFilter(currency).isVisible();
        console.log(`[P2PPage][isFiatFilterVisible] currency: ${currency} | visible: ${isVisible}`);
        return isVisible;
    }

    async clickFiatFilter(currency: P2PCurrency): Promise<void> {
        await this.getFiatFilter(currency).click();
        console.log(`[P2PPage][clickFiatFilter] currency: ${currency} clicked`);
    }

    async isPaymentFilterVisible(currency: P2PCurrency): Promise<boolean> {
        const isVisible = await this.getPaymentFilter(currency).isVisible();
        console.log(`[P2PPage][isPaymentFilterVisible] currency: ${currency} | visible: ${isVisible}`);
        return isVisible;
    }

    async clickPaymentFilter(currency: P2PCurrency): Promise<void> {
        await this.getPaymentFilter(currency).click();
        console.log(`[P2PPage][clickPaymentFilter] currency: ${currency} clicked`);
    }

    async isResetFilterButtonVisible(currency: P2PCurrency): Promise<boolean> {
        const isVisible = await this.getResetFilterButton(currency).isVisible();
        console.log(`[P2PPage][isResetFilterButtonVisible] currency: ${currency} | visible: ${isVisible}`);
        return isVisible;
    }

    // Also reused by TC-16/TC-17 to clear filters back to default between checks
    async clickResetFilterButton(currency: P2PCurrency): Promise<void> {
        await this.getResetFilterButton(currency).click();
        console.log(`[P2PPage][clickResetFilterButton] currency: ${currency} clicked`);
    }

    // ─── TC-16 — Country / Fiat / Payment dropdown selection ─────────────────────

    private getCountryFilterValue(currency: P2PCurrency): Locator {
        const map: Record<P2PCurrency, Locator> = {
            USDT: this.usdtCountryFilterValue,
            BTC:  this.btcCountryFilterValue,
            ETH:  this.ethCountryFilterValue,
            BNB:  this.bnbCountryFilterValue,
        };
        return map[currency];
    }

    private getFiatFilterValue(currency: P2PCurrency): Locator {
        const map: Record<P2PCurrency, Locator> = {
            USDT: this.usdtFiatFilterValue,
            BTC:  this.btcFiatFilterValue,
            ETH:  this.ethFiatFilterValue,
            BNB:  this.bnbFiatFilterValue,
        };
        return map[currency];
    }

    private getPaymentFilterValue(currency: P2PCurrency): Locator {
        const map: Record<P2PCurrency, Locator> = {
            USDT: this.usdtPaymentFilterValue,
            BTC:  this.btcPaymentFilterValue,
            ETH:  this.ethPaymentFilterValue,
            BNB:  this.bnbPaymentFilterValue,
        };
        return map[currency];
    }

    async getCountryFilterValueText(currency: P2PCurrency): Promise<string> {
        const text = (await this.getCountryFilterValue(currency).textContent()) ?? '';
        console.log(`[P2PPage][getCountryFilterValueText] currency: ${currency} | text: "${text}"`);
        return text;
    }

    async getFiatFilterValueText(currency: P2PCurrency): Promise<string> {
        const text = (await this.getFiatFilterValue(currency).textContent()) ?? '';
        console.log(`[P2PPage][getFiatFilterValueText] currency: ${currency} | text: "${text}"`);
        return text;
    }

    async getPaymentFilterValueText(currency: P2PCurrency): Promise<string> {
        const text = (await this.getPaymentFilterValue(currency).textContent()) ?? '';
        console.log(`[P2PPage][getPaymentFilterValueText] currency: ${currency} | text: "${text}"`);
        return text;
    }

    private getFiatOption(method: FiatMethod): Locator {
        const map: Record<FiatMethod, Locator> = {
            'ALL METHODS': this.fiatOptionAllMethods,
            USD: this.fiatOptionUSD,
            INR: this.fiatOptionINR,
            CAD: this.fiatOptionCAD,
        };
        return map[method];
    }

    private getPaymentOption(method: PaymentMethod): Locator {
        const map: Record<PaymentMethod, Locator> = {
            'ALL METHODS': this.paymentOptionAllMethods,
            SKRILL: this.paymentOptionSkrill,
            'TEST UPI': this.paymentOptionTestUpi,
            ZINLI: this.paymentOptionZinli,
            TEST: this.paymentOptionTest,
            'UNITED STATE': this.paymentOptionUnitedState,
            PHONEPE: this.paymentOptionPhonepe,
        };
        return map[method];
    }

    // Opens via each *FilterValue locator (position-based: Country/Fiat/Payment are the 1st/2nd/
    // 3rd .ant-select-selector in the panel), not the old text-matched Filter locator — that one
    // only matches while the field still shows its default "ALL METHODS"/"All regions" text.
    // Confirmed live: selecting Country=India auto-changes Fiat's displayed text to "INR", which
    // shifts which element .getByText('ALL METHODS').first()/.last() resolves to and made the
    // next dropdown open the wrong (already-open) one, timing out waiting for an option that was
    // never going to appear in it.
    async selectFiatOption(currency: P2PCurrency, method: FiatMethod): Promise<void> {
        await this.getFiatFilterValue(currency).click();
        await this.page.waitForTimeout(500);
        await this.getFiatOption(method).click();
        await this.page.waitForTimeout(800);
        console.log(`[P2PPage][selectFiatOption] currency: ${currency} | method: ${method}`);
    }

    async selectPaymentOption(currency: P2PCurrency, method: PaymentMethod): Promise<void> {
        await this.getPaymentFilterValue(currency).click();
        await this.page.waitForTimeout(500);
        await this.getPaymentOption(method).click();
        await this.page.waitForTimeout(800);
        console.log(`[P2PPage][selectPaymentOption] currency: ${currency} | method: ${method}`);
    }

    // Only 'India' is pre-built — the country list has 200+ entries, so a single representative
    // value (rather than every country) is used to prove the dropdown selection actually works.
    async selectCountryIndia(currency: P2PCurrency): Promise<void> {
        await this.getCountryFilterValue(currency).click();
        await this.page.waitForTimeout(500);
        await this.countryOptionIndia.click();
        await this.page.waitForTimeout(800);
        console.log(`[P2PPage][selectCountryIndia] currency: ${currency}`);
    }

    // ─── TC-17 — "No data" empty state ────────────────────────────────────────────

    // Typing alone doesn't query the server — confirmed live: filling '999999999' and reading the
    // list right after still showed the unfiltered data. Enter submits the search.
    async applyAmountFilter(currency: P2PCurrency, amount: string): Promise<void> {
        const input = this.getAmountFilter(currency);
        await input.fill(amount);
        await input.press('Enter');
        await this.page.waitForTimeout(1500);
        console.log(`[P2PPage][applyAmountFilter] currency: ${currency} | amount: ${amount}`);
    }

    private getNoDataText(currency: P2PCurrency): Locator {
        const map: Record<P2PCurrency, Locator> = {
            USDT: this.usdtNoDataText,
            BTC:  this.btcNoDataText,
            ETH:  this.ethNoDataText,
            BNB:  this.bnbNoDataText,
        };
        return map[currency];
    }

    private getNoDataIcon(currency: P2PCurrency): Locator {
        const map: Record<P2PCurrency, Locator> = {
            USDT: this.usdtNoDataIcon,
            BTC:  this.btcNoDataIcon,
            ETH:  this.ethNoDataIcon,
            BNB:  this.bnbNoDataIcon,
        };
        return map[currency];
    }

    async isNoDataTextVisible(currency: P2PCurrency): Promise<boolean> {
        const isVisible = await this.getNoDataText(currency).isVisible().catch(() => false);
        console.log(`[P2PPage][isNoDataTextVisible] currency: ${currency} | visible: ${isVisible}`);
        return isVisible;
    }

    async getNoDataTextContent(currency: P2PCurrency): Promise<string> {
        const text = (await this.getNoDataText(currency).textContent()) ?? '';
        console.log(`[P2PPage][getNoDataTextContent] currency: ${currency} | text: "${text}"`);
        return text;
    }

    async isNoDataIconVisible(currency: P2PCurrency): Promise<boolean> {
        const isVisible = await this.getNoDataIcon(currency).isVisible().catch(() => false);
        console.log(`[P2PPage][isNoDataIconVisible] currency: ${currency} | visible: ${isVisible}`);
        return isVisible;
    }
}
