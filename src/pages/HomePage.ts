import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export type SiteLanguage = 'English' | 'Arabic';
export type LinkPosition = 'first' | 'last';

export class HomePage extends BasePage {

    //private locators:
    private readonly logo: Locator;
    private readonly exchangeLink: Locator;
    private readonly signInButton: Locator;
    private readonly registerButton: Locator;
    private readonly contactUsLink: Locator;
    private readonly languageIcon: Locator;
    private readonly englishOption: Locator;
    private readonly arabicOption: Locator;
    private readonly themeToggleIcon: Locator;
    private readonly contentBlocks: Locator;
    private readonly loginLinkFirst: Locator;
    private readonly loginLinkLast: Locator;
    private readonly registerLinkFirst: Locator;
    private readonly registerLinkLast: Locator;
    private readonly availableBalance: Locator;

    constructor(page: Page) {
        super(page);
        // getByAltText('img') alone is ambiguous on the home page (21 images share the generic
        // alt="img", vs. just the one on the login page this navigates back from). The two pages
        // don't share a common class or landmark for the logo (confirmed live — login page has no
        // role=banner at all), but .first() resolves correctly on both: it's the first DOM match on
        // the home page (confirmed via the earlier strict-mode violation's match order), and the
        // only match on the login page.
        this.logo            = page.getByAltText('img').first();
        this.exchangeLink    = page.getByText('Exchange', { exact: true }).last();
        this.signInButton    = page.getByText('Sign In', { exact: true }).last();
        this.registerButton  = page.getByText('Register', { exact: true }).last();
        this.contactUsLink   = page.getByText('Contact Us', { exact: true });
        this.languageIcon    = page.getByRole('img', { name: 'Language' }).first();
        this.englishOption   = page.getByText('English', { exact: true });
        this.arabicOption    = page.getByText('العربية', { exact: true });
        this.themeToggleIcon = page.locator('li > span.container--toggle > img');
        this.contentBlocks   = page.locator('div.container > div.ant-row > div.ant-col');

        // Two distinct "Log In"/"Register" links exist on the Exchange page (a page-wide banner
        // pair) — confirmed live via Playwright Inspector, hence testing .first() and .last() separately.
        this.loginLinkFirst    = page.getByRole('link', { name: 'Log In' }).first();
        this.loginLinkLast     = page.getByRole('link', { name: 'Log In' }).last();
        this.registerLinkFirst = page.getByRole('link', { name: 'Register' }).first();
        this.registerLinkLast  = page.getByRole('link', { name: 'Register' }).last();

        this.availableBalance = page.locator('.style_maxbuyamt__R2UFf');
    }

    // Standard 3-line trace for every step: what we did, what we expected, what we got — so the
    // HTML report's console output shows exactly what happened without needing to re-run headed.
    private logStep(step: string, expected: string, actual: string): void {
        console.log(
            `[HomePage] Step     : ${step}\n` +
            `[HomePage] Expected : ${expected}\n` +
            `[HomePage] Actual   : ${actual}`
        );
    }

    //public page actions(methods)/behaviors:

    async goToHomePage(): Promise<void> {
        await this.page.goto('/');
        await this.page.waitForLoadState('networkidle');
    }

    async getCurrentUrl(expectedUrl?: string): Promise<string> {
        const url = this.page.url();
        this.logStep('Read the current page URL', expectedUrl ? `"${expectedUrl}"` : 'the expected page URL', `"${url}"`);
        return url;
    }

    async getPageTitle(): Promise<string> {
        const title = await this.page.title();
        this.logStep('Read the page title', '"KNOOZ"', `"${title}"`);
        return title;
    }

    // Buttons/icons that should always be visible on the home page — one shared locator map so
    // adding a new button to check is a one-line addition here plus a new CSV row, nothing else.
    private getHomePageButton(name: string): Locator {
        const map: Record<string, Locator> = {
            'Exchange':     this.exchangeLink,
            'Sign In':      this.signInButton,
            'Register':     this.registerButton,
            'Contact Us':   this.contactUsLink,
            'Language icon': this.languageIcon,
            'Theme toggle': this.themeToggleIcon,
            'Logo':         this.logo,
        };
        return map[name];
    }

    async isHomePageButtonVisible(name: string): Promise<boolean> {
        const isVisible = await this.getHomePageButton(name).isVisible();
        this.logStep(`Checked "${name}" on the home page`, 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    // Clicking Exchange lands on a generic /advanceTrading URL first, then client-side redirects
    // to a default pair (e.g. /advanceTrading/ethusdt) a few seconds later — wait for that redirect
    // to settle before reading the URL, or callers see the intermediate, pair-less URL.
    async clickExchange(): Promise<string> {
        await this.exchangeLink.click();
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForURL(/\/advanceTrading\//, { timeout: 10000 }).catch(() => {});
        const url = this.page.url();
        this.logStep('Clicked "Exchange"', 'URL contains "/advanceTrading/"', `landed on: "${url}"`);
        return url;
    }

    private getLoginLink(position: LinkPosition): Locator {
        return position === 'first' ? this.loginLinkFirst : this.loginLinkLast;
    }

    private getRegisterLink(position: LinkPosition): Locator {
        return position === 'first' ? this.registerLinkFirst : this.registerLinkLast;
    }

    async isLoginLinkVisible(position: LinkPosition): Promise<boolean> {
        const isVisible = await this.getLoginLink(position).isVisible();
        this.logStep(`Checked "Log In" link (${position}) on the Exchange page`, 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async clickLoginLink(position: LinkPosition): Promise<string> {
        await this.getLoginLink(position).click();
        await this.page.waitForLoadState('networkidle');
        const url = this.page.url();
        this.logStep(`Clicked "Log In" link (${position}) on the Exchange page`, 'redirected to the login page', `landed on: "${url}"`);
        return url;
    }

    async isRegisterLinkVisible(position: LinkPosition): Promise<boolean> {
        const isVisible = await this.getRegisterLink(position).isVisible();
        this.logStep(`Checked "Register" link (${position}) on the Exchange page`, 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async clickRegisterLink(position: LinkPosition): Promise<string> {
        await this.getRegisterLink(position).click();
        await this.page.waitForLoadState('networkidle');
        const url = this.page.url();
        this.logStep(`Clicked "Register" link (${position}) on the Exchange page`, 'redirected to the create-account page', `landed on: "${url}"`);
        return url;
    }

    async getAvailableBalanceText(): Promise<string> {
        const text = (await this.availableBalance.textContent()) ?? '';
        this.logStep('Read the available balance on the Exchange page without logging in', 'balance shows 0', `balance text: "${text}"`);
        return text;
    }

    async clickSignInButton(): Promise<string> {
        await this.signInButton.click();
        await this.page.waitForLoadState('networkidle');
        const url = this.page.url();
        this.logStep('Clicked "Sign In"', 'redirected to the login page', `landed on: "${url}"`);
        return url;
    }

    async clickRegisterButton(): Promise<string> {
        await this.registerButton.click();
        await this.page.waitForLoadState('networkidle');
        const url = this.page.url();
        this.logStep('Clicked "Register"', 'redirected to the create-account page', `landed on: "${url}"`);
        return url;
    }

    async clickContactUsLink(): Promise<string> {
        await this.contactUsLink.click();
        await this.page.waitForLoadState('networkidle');
        const url = this.page.url();
        this.logStep('Clicked "Contact Us"', 'redirected to the support page', `landed on: "${url}"`);
        return url;
    }

    // "Sign In" is the same persistent site-header control, still present on the Support page —
    // reuses the same locator rather than a page-specific one. Uses waitFor (not a plain
    // isVisible()) since the header can render a beat after networkidle fires on this page —
    // confirmed live: the subsequent click() succeeded even when an instant isVisible() read false.
    async isSignInVisibleOnCurrentPage(): Promise<boolean> {
        const isVisible = await this.signInButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        this.logStep('Checked "Sign In" on the current page', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async clickSignInOnCurrentPage(): Promise<string> {
        await this.signInButton.click();
        await this.page.waitForLoadState('networkidle');
        const url = this.page.url();
        this.logStep('Clicked "Sign In" on the current page', 'redirected to the login page', `landed on: "${url}"`);
        return url;
    }

    async clickLogo(): Promise<string> {
        await this.logo.click();
        await this.page.waitForLoadState('networkidle');
        const url = this.page.url();
        this.logStep('Clicked the KNOOZ logo', 'redirected to the home page', `landed on: "${url}"`);
        return url;
    }

    async hoverLanguageIcon(): Promise<void> {
        await this.languageIcon.hover();
        await this.page.waitForTimeout(500);
    }

    async isLanguageOptionVisible(lang: SiteLanguage): Promise<boolean> {
        const option = lang === 'English' ? this.englishOption : this.arabicOption;
        const isVisible = await option.isVisible();
        this.logStep(`Checked "${lang}" option in the language dropdown`, 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async selectLanguage(lang: SiteLanguage): Promise<void> {
        await this.hoverLanguageIcon();
        const option = lang === 'English' ? this.englishOption : this.arabicOption;
        await option.click();
        await this.page.waitForTimeout(1500);
    }

    async getPageContentText(): Promise<string> {
        return (await this.contentBlocks.allTextContents()).join(' ');
    }

    async verifyLanguageContent(lang: SiteLanguage, expectedSubstring: string): Promise<{
        blockCount: number;
        containsExpected: boolean;
    }> {
        const blockCount = await this.contentBlocks.count();
        const fullText = await this.getPageContentText();
        const containsExpected = fullText.includes(expectedSubstring);
        this.logStep(
            `Selected "${lang}" language and read all ${blockCount} page content blocks`,
            `text contains "${expectedSubstring}"`,
            containsExpected ? `found "${expectedSubstring}"` : `not found — sample: "${fullText.slice(0, 200)}"`,
        );
        return { blockCount, containsExpected };
    }

    // Silent read used internally by toggleTheme()/scrollAndGetThemeClass() so a single logical
    // action (one toggle, one scroll check) produces one log entry instead of one per read.
    private async readThemeClass(): Promise<string> {
        return (await this.page.locator('html').getAttribute('class')) ?? '';
    }

    async getThemeClass(expectedTheme?: string): Promise<string> {
        const themeClass = await this.readThemeClass();
        this.logStep('Read the current theme class', expectedTheme ? `"${expectedTheme}"` : '"theme-dark" by default', `"${themeClass}"`);
        return themeClass;
    }

    async toggleTheme(): Promise<string> {
        const before = await this.readThemeClass();
        await this.themeToggleIcon.click();
        await this.page.waitForTimeout(500);
        const after = await this.readThemeClass();
        this.logStep('Clicked the theme toggle icon', 'theme class changes', `before: "${before}" → after: "${after}"`);
        return after;
    }

    // Scrolls to the bottom of the page and back to confirm the selected theme doesn't reset or
    // get overridden by any scroll-triggered re-render.
    async scrollAndVerifyThemePersists(expectedTheme: string): Promise<string> {
        const before = await this.readThemeClass();
        await this.page.mouse.wheel(0, 2000);
        await this.page.waitForTimeout(300);
        await this.page.mouse.wheel(0, -2000);
        await this.page.waitForTimeout(300);
        const after = await this.readThemeClass();
        this.logStep(
            `Scrolled the page down and back up while theme was "${before}"`,
            `theme stays "${expectedTheme}"`,
            `theme after scrolling: "${after}"`,
        );
        return after;
    }
}
