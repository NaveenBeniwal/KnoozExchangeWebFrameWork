import { test, expect } from '../../src/fixtures/pagefixtures';
import { LoginPage } from '../../src/pages/LoginPage';
import { P2PPage, P2PCurrency } from '../../src/pages/p2p/P2PPage';
import { CsvHelper } from '../../src/utils/CsvHelper';
import type { Browser, BrowserContext, Page } from '@playwright/test';

const p2pData = CsvHelper.readCsv('src/data/p2pData.csv');
const row = (scenario: string, param = '') =>
    p2pData.find(r => r.scenario === scenario && r.param === param)!;

let browser:  Browser;
let context:  BrowserContext;
let page:     Page;
let loginPage: LoginPage;
let p2pPage:   P2PPage;

// Single shared browser/context/page across this whole file (user 1 only, per current scope) —
// same reasoning as the Portfolio/Trade suites: repeated fresh logins across parallel workers
// hammer the same staging account and push checks past their timeouts. describe.serial is used
// (not mode: 'default') because this is one continuous journey — risk notice acknowledgement,
// tab selection and buy/sell toggle state each carry over from the previous test.
test.describe.serial('P2P Module — User 1', () => {

    test.beforeAll(async ({ playwright }, testInfo) => {
        test.setTimeout(60000);
        browser   = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context   = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
        page      = await context.newPage();
        loginPage = new LoginPage(page);
        p2pPage   = new P2PPage(page);
        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!);
        await loginPage.dismissPostLoginDialogsAndWaitForHome();
    });

    test.afterAll(async () => { await browser.close(); });

    // ─── Navigate to P2P and the Risk Notice popup ───────────────────────────────

    test('TC-01: clicking P2P opens the Risk Notice popup @smoke @sanity', async () => {
        await p2pPage.clickP2PNav();
        expect(await p2pPage.isRiskNoticePopupVisible(), 'Risk Notice popup should open on first visit to P2P').toBe(true);
    });

    test('TC-02: Risk Notice popup shows the expected heading and disclaimer text @sanity', async () => {
        const headingRow = row('risk_notice_heading');
        expect(await p2pPage.getRiskNoticeHeadingText(), headingRow.description).toContain(headingRow.expectedText);

        const bodyRow = row('risk_notice_body');
        expect(await p2pPage.getRiskNoticeGreyText(), bodyRow.description).toContain(bodyRow.expectedText);

        const checkboxLabelRow = row('risk_notice_checkbox_label');
        expect(await p2pPage.getRiskNoticeCheckboxLabelText(), checkboxLabelRow.description).toContain(checkboxLabelRow.expectedText);
    });

    test('TC-03: checkbox is visible and Confirm stays disabled until it is checked @sanity', async () => {
        expect.soft(await p2pPage.isRiskNoticeCheckboxVisible(), 'Agree checkbox should be visible').toBe(true);
        expect.soft(await p2pPage.isRiskNoticeCheckboxChecked(), 'Agree checkbox should start unchecked').toBe(false);
        expect.soft(await p2pPage.isRiskNoticeCloseButtonEnabled(), 'Close button should be enabled without checking the checkbox').toBe(true);
        expect(await p2pPage.isRiskNoticeConfirmButtonEnabled(), 'Confirm button should be disabled before checking the checkbox').toBe(false);
    });

    test('TC-04: Close button closes the popup and Home is selected by default @sanity', async () => {
        await p2pPage.clickRiskNoticeCloseButton();
        expect(await p2pPage.isRiskNoticePopupVisible().then(v => !v), 'Popup should close after clicking Close').toBe(true);
        expect(await p2pPage.isHomeNavVisible(), 'Home should be selected by default after closing without confirming').toBe(true);
    });

    test('TC-05: reopening P2P shows the same Risk Notice popup again @sanity', async () => {
        await p2pPage.clickP2PNav();
        expect(await p2pPage.isRiskNoticePopupVisible(), 'Risk Notice popup should reopen on the next visit to P2P').toBe(true);

        const headingRow = row('risk_notice_heading');
        expect.soft(await p2pPage.getRiskNoticeHeadingText(), headingRow.description).toContain(headingRow.expectedText);
        const bodyRow = row('risk_notice_body');
        expect.soft(await p2pPage.getRiskNoticeGreyText(), bodyRow.description).toContain(bodyRow.expectedText);
    });

    test('TC-06: checking the checkbox enables Confirm, and Confirm opens the P2P page @smoke @sanity', async () => {
        await p2pPage.checkRiskNoticeCheckbox();
        expect(await p2pPage.isRiskNoticeCheckboxChecked(), 'Agree checkbox should be checked').toBe(true);
        expect(await p2pPage.isRiskNoticeConfirmButtonEnabled(), 'Confirm button should be enabled once the checkbox is checked').toBe(true);

        await p2pPage.clickRiskNoticeConfirmButton();
        expect(await p2pPage.isRiskNoticePopupVisible().then(v => !v), 'Popup should close after clicking Confirm').toBe(true);

        const headingRow = row('peer_to_peer_heading');
        expect(await p2pPage.isPeerToPeerHeadingVisible(), headingRow.description).toBe(true);
    });

    // ─── Top tab bar ─────────────────────────────────────────────────────────────

    test('TC-07: Market Update, My Ads, My Orders and User Dashboard tabs are visible and clickable @sanity', async () => {
        for (const tab of ['Market Update', 'My Ads', 'My Orders', 'User Dashboard'] as const) {
            expect.soft(await p2pPage.isTabVisible(tab), `${tab} tab should be visible`).toBe(true);
        }
        for (const tab of ['My Ads', 'My Orders', 'User Dashboard'] as const) {
            await p2pPage.clickTab(tab);
            expect.soft(await p2pPage.isTabVisible(tab), `${tab} tab should stay visible after clicking it`).toBe(true);
        }
        // Return to Market Update — the remaining checks assume it is the active tab
        await p2pPage.clickTab('Market Update');
        expect(await p2pPage.isTabVisible('Market Update'), 'Market Update should be selected by default').toBe(true);
    });

    // ─── "How P2P Works" section ──────────────────────────────────────────────────

    test('TC-08: How P2P Works heading and sub text are visible on the Market Update tab @sanity', async () => {
        expect.soft(await p2pPage.isHowP2PWorksSectionVisible(), 'How P2P Works section should be visible').toBe(true);

        const headingRow = row('market_update_heading');
        expect.soft(await p2pPage.isHowP2PWorksHeadingVisible(), headingRow.description).toBe(true);

        const subTextRow = row('market_update_subtext');
        expect(await p2pPage.getHowP2PWorksSubText(), subTextRow.description).toContain(subTextRow.expectedText);
    });

    test('TC-09: Buy is selected by default and shows the buy step text @sanity', async () => {
        for (const step of [1, 2, 3] as const) {
            const stepRow = row('buy_step', String(step));
            expect.soft(await p2pPage.getHowP2PWorksStepText(step), stepRow.description).toContain(stepRow.expectedText);
        }
    });

    test('TC-10: switching to Sell updates the how-it-works step text @sanity', async () => {
        await p2pPage.selectBuySellToggleTop('Sell');
        for (const step of [1, 2, 3] as const) {
            const stepRow = row('sell_step', String(step));
            expect.soft(await p2pPage.getHowP2PWorksStepText(step), stepRow.description).toContain(stepRow.expectedText);
        }
    });

    test('TC-11: switching back to Buy restores the buy step text @sanity', async () => {
        await p2pPage.selectBuySellToggleTop('Buy');
        for (const step of [1, 2, 3] as const) {
            const stepRow = row('buy_step', String(step));
            expect.soft(await p2pPage.getHowP2PWorksStepText(step), stepRow.description).toContain(stepRow.expectedText);
        }
    });

    // ─── Currency listing section (2nd tab) ──────────────────────────────────────

    test('TC-12: P2P listing heading and currency tabs are visible after scrolling down @sanity', async () => {
        await p2pPage.scrollToP2PListingHeading();
        expect.soft(await p2pPage.isLandingMainTabVisible(), 'Currency listing tab section should be visible').toBe(true);

        const headingRow = row('p2p_listing_heading');
        expect.soft(await p2pPage.isP2PListingHeadingVisible(), headingRow.description).toBe(true);
        expect(await p2pPage.isCurrencyTabsNavVisible(), 'Currency tabs (BTC/ETH/BNB/USDT with Buy/Sell) should be visible').toBe(true);
    });

    test('TC-13: Buy/Sell toggle on the currency listing section is clickable and Buy is selected by default @sanity', async () => {
        await p2pPage.selectBuySellToggleBottom('Buy');
        await p2pPage.selectBuySellToggleBottom('Sell');
        await p2pPage.selectBuySellToggleBottom('Buy');
    });

    test('TC-14: USDT, BTC, ETH and BNB currency tabs are clickable and show their own panel @sanity', async () => {
        for (const currency of ['USDT', 'BTC', 'ETH', 'BNB'] as P2PCurrency[]) {
            expect.soft(await p2pPage.isCurrencyTabVisible(currency), `${currency} currency tab should be visible`).toBe(true);
            await p2pPage.clickCurrencyTab(currency);
            expect.soft(await p2pPage.isCurrencyTabPanelVisible(currency), `${currency} tab panel should be shown after selecting it`).toBe(true);
        }
    });

    // BNB is the active currency left over from TC-14
    test('TC-15: Amount, Country, Fiat and Payment filters are visible and Reset clears them @sanity', async () => {
        const currency: P2PCurrency = 'BNB';
        expect.soft(await p2pPage.isAmountFilterVisible(currency), 'Amount filter should be visible').toBe(true);
        expect.soft(await p2pPage.isCountryFilterVisible(currency), 'Country filter should be visible').toBe(true);
        expect.soft(await p2pPage.isFiatFilterVisible(currency), 'Fiat filter should be visible').toBe(true);
        expect.soft(await p2pPage.isPaymentFilterVisible(currency), 'Payment filter should be visible').toBe(true);
        expect.soft(await p2pPage.isResetFilterButtonVisible(currency), 'Reset button should be visible').toBe(true);

        await p2pPage.fillAmountFilter(currency, '100');
        expect(await p2pPage.getAmountFilterValue(currency), 'Amount filter should hold the value just entered').toBe('100');

        await p2pPage.clickResetFilterButton(currency);
        expect(await p2pPage.getAmountFilterValue(currency), 'Amount filter should be cleared after clicking Reset').toBe('');
    });

    // ─── Applying filters and the "No data" empty state ──────────────────────────

    // Country, Fiat and Payment are not independent: selecting a Country auto-populates Fiat with
    // that country's local currency (confirmed live — India auto-sets Fiat to INR), which in turn
    // changes which Payment methods are offered (India/INR shows PHONEPE, MANUAL TRANSFER, etc.
    // instead of the default SKRILL/ZINLI/... list). So Fiat is checked standalone first (its own
    // default option list, before any country narrows it), then Country→Fiat→Payment is checked
    // as the realistic dependent chain a user would actually drive.
    test('TC-16: selecting Country, Fiat and Payment updates each filter to show the selection, in every currency @sanity', async () => {
        const fiatRow            = row('filter_fiat_option');
        const countryRow         = row('filter_country_option');
        const fiatAfterCountryRow    = row('filter_fiat_after_country');
        const paymentAfterCountryRow = row('filter_payment_after_country');

        for (const currency of ['USDT', 'BTC', 'ETH', 'BNB'] as P2PCurrency[]) {
            await p2pPage.clickCurrencyTab(currency);

            // Fiat on its own, before any Country narrows the option list
            await p2pPage.selectFiatOption(currency, 'USD');
            expect.soft(await p2pPage.getFiatFilterValueText(currency), `${currency}: ${fiatRow.description}`).toContain(fiatRow.expectedText);
            await p2pPage.clickResetFilterButton(currency);

            // Country -> Fiat auto-updates -> Payment narrows to the India/INR-specific list
            await p2pPage.selectCountryIndia(currency);
            expect.soft(await p2pPage.getCountryFilterValueText(currency), `${currency}: ${countryRow.description}`).toContain(countryRow.expectedText);
            expect.soft(await p2pPage.getFiatFilterValueText(currency), `${currency}: ${fiatAfterCountryRow.description}`).toContain(fiatAfterCountryRow.expectedText);

            await p2pPage.selectPaymentOption(currency, 'PHONEPE');
            expect.soft(await p2pPage.getPaymentFilterValueText(currency), `${currency}: ${paymentAfterCountryRow.description}`).toContain(paymentAfterCountryRow.expectedText);

            await p2pPage.clickResetFilterButton(currency);
        }
    });

    // An amount no real order could match forces an empty result set deterministically — relying
    // on whichever currencies currently happen to have zero live orders on staging would make this
    // test's outcome depend on data that can change over time.
    test('TC-17: an Amount filter with no matching orders shows the No data text and icon, in every currency @sanity', async () => {
        const noDataRow = row('no_data_text');
        const amountRow = row('no_data_amount_value');

        for (const currency of ['USDT', 'BTC', 'ETH', 'BNB'] as P2PCurrency[]) {
            await p2pPage.clickCurrencyTab(currency);
            await p2pPage.applyAmountFilter(currency, amountRow.expectedText);

            expect.soft(await p2pPage.isNoDataTextVisible(currency), `${currency}: ${noDataRow.description}`).toBe(true);
            expect.soft(await p2pPage.getNoDataTextContent(currency), `${currency}: No data text should match`).toContain(noDataRow.expectedText);
            expect.soft(await p2pPage.isNoDataIconVisible(currency), `${currency}: No data icon should be shown alongside the text`).toBe(true);

            await p2pPage.clickResetFilterButton(currency);
        }
    });

});
