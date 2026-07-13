import { test, expect } from '../src/fixtures/pagefixtures';
import { HomePage } from '../src/pages/HomePage';
import { CsvHelper } from '../src/utils/CsvHelper';
import type { Browser, BrowserContext, Page } from '@playwright/test';

const homeData = CsvHelper.readCsv('src/data/homePageData.csv');

let browser:  Browser;
let context:  BrowserContext;
let page:     Page;
let homePage: HomePage;

// Single shared browser for the whole file instead of the default per-test fixture context — with
// 8 tests across 4 parallel workers, each launching and tearing down its own Chromium instance
// while repeatedly navigating the same live site, the local machine's resource contention alone
// pushed even plain, no-network isVisible() checks past the 30s timeout (confirmed live). No login
// or rate-limited resource is involved here, so mode: 'default' (not .serial()) is enough: tests
// stay independent — one failing doesn't skip the rest — they just no longer fight over 4 browsers.
test.describe('Home Page', () => {
    test.describe.configure({ mode: 'default' });

    test.beforeAll(async ({ playwright }, testInfo) => {
        browser  = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context  = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
        page     = await context.newPage();
        homePage = new HomePage(page);
    });

    test.afterAll(async () => { await browser.close(); });

    test.beforeEach(async () => {
        await homePage.goToHomePage();
    });

    // 1. Home page URL
    test('1. home page loads at the correct URL @smoke @sanity', async () => {
        const row = homeData.find(r => r.scenario === 'home_url')!;
        expect(await homePage.getCurrentUrl(row.expectedUrl), row.description).toBe(row.expectedUrl);
    });

    // 2. Home page title
    test('2. home page title should be KNOOZ @smoke @sanity', async () => {
        const row = homeData.find(r => r.scenario === 'home_title')!;
        expect(await homePage.getPageTitle(), row.description).toBe(row.expectedText);
    });

    // All home page buttons/icons should be visible
    test('all home page buttons are visible', async () => {
        for (const row of homeData.filter(r => r.scenario === 'button_visible')) {
            expect.soft(await homePage.isHomePageButtonVisible(row.param), row.description).toBe(true);
        }
    });

    // 3. Exchange button opens the trading page, which shows Login/Register links and a zero balance
    test('3. Exchange button opens the trading page with Login, Register links and zero balance', async () => {
        const navRow = homeData.find(r => r.scenario === 'exchange_navigation')!;
        expect(await homePage.clickExchange(), navRow.description).toBe(navRow.expectedUrl);

        const balanceRow = homeData.find(r => r.scenario === 'available_balance')!;
        const balanceText = await homePage.getAvailableBalanceText();
        expect.soft(balanceText, balanceRow.description).toContain(balanceRow.expectedText);

        for (const row of homeData.filter(r => r.scenario === 'login_link_exchange')) {
            const position = row.param as 'first' | 'last';
            expect.soft(await homePage.isLoginLinkVisible(position), row.description).toBe(true);
            expect.soft(await homePage.clickLoginLink(position), row.description).toBe(row.expectedUrl);
            await homePage.goToHomePage();
            await homePage.clickExchange();
        }

        for (const row of homeData.filter(r => r.scenario === 'register_link_exchange')) {
            const position = row.param as 'first' | 'last';
            expect.soft(await homePage.isRegisterLinkVisible(position), row.description).toBe(true);
            expect.soft(await homePage.clickRegisterLink(position), row.description).toBe(row.expectedUrl);
            await homePage.goToHomePage();
            await homePage.clickExchange();
        }
    });

    // 4. Sign In button
    test('4. Sign In button navigates to the login page and back to home', async () => {
        const row = homeData.find(r => r.scenario === 'signin_home')!;
        expect(await homePage.clickSignInButton(), row.description).toBe(row.expectedUrl);

        await homePage.goToHomePage();
        const homeRow = homeData.find(r => r.scenario === 'home_url')!;
        expect(await homePage.getCurrentUrl(homeRow.expectedUrl), 'Navigating back to home should land on the home URL').toBe(homeRow.expectedUrl);
    });

    // 5. Register button
    test('5. Register button navigates to the create-account page and back to home', async () => {
        const row = homeData.find(r => r.scenario === 'register_home')!;
        expect(await homePage.clickRegisterButton(), row.description).toBe(row.expectedUrl);

        await homePage.goToHomePage();
        const homeRow = homeData.find(r => r.scenario === 'home_url')!;
        expect(await homePage.getCurrentUrl(homeRow.expectedUrl), 'Navigating back to home should land on the home URL').toBe(homeRow.expectedUrl);
    });

    // 6. Contact Us -> support page -> Sign In -> login page -> logo -> home
    test('6. Contact Us reaches the support page, Sign In reaches login, and the logo returns home', async () => {
        const contactRow = homeData.find(r => r.scenario === 'contact_us')!;
        expect(await homePage.clickContactUsLink(), contactRow.description).toBe(contactRow.expectedUrl);

        const signInRow = homeData.find(r => r.scenario === 'signin_support')!;
        expect.soft(await homePage.isSignInVisibleOnCurrentPage(), signInRow.description).toBe(true);
        expect(await homePage.clickSignInOnCurrentPage(), signInRow.description).toBe(signInRow.expectedUrl);

        const logoRow = homeData.find(r => r.scenario === 'logo_login_page')!;
        expect(await homePage.clickLogo(), logoRow.description).toBe(logoRow.expectedUrl);
    });

    // 7. Language dropdown shows English/Arabic and switches page content
    test('7. language dropdown shows English and Arabic and switches page content', async () => {
        await homePage.hoverLanguageIcon();
        expect.soft(await homePage.isLanguageOptionVisible('English'), 'English option should be visible in the language dropdown').toBe(true);
        expect.soft(await homePage.isLanguageOptionVisible('Arabic'), 'Arabic (العربية) option should be visible in the language dropdown').toBe(true);

        for (const row of homeData.filter(r => r.scenario === 'language_select')) {
            const lang = row.param as 'English' | 'Arabic';
            await homePage.selectLanguage(lang);
            const result = await homePage.verifyLanguageContent(lang, row.expectedText);
            expect.soft(result.blockCount, `${row.description} — should render 21 content blocks`).toBe(21);
            expect.soft(result.containsExpected, row.description).toBe(true);
        }
    });

    // 8. Theme toggle round-trip: starts dark, toggles to light, toggles back to dark — and the
    // selected theme should survive scrolling the page, not just the instant after clicking.
    test('8. theme toggle switches from dark to light and back to dark, and persists while scrolling', async () => {
        const initialRow = homeData.find(r => r.scenario === 'theme_initial')!;
        expect.soft(await homePage.getThemeClass(initialRow.expectedText), initialRow.description).toContain(initialRow.expectedText);
        expect.soft(await homePage.scrollAndVerifyThemePersists(initialRow.expectedText), `${initialRow.description} — should persist while scrolling`).toContain(initialRow.expectedText);

        for (const row of homeData.filter(r => r.scenario === 'theme_toggle')) {
            expect.soft(await homePage.toggleTheme(), row.description).toContain(row.expectedText);
            expect.soft(await homePage.scrollAndVerifyThemePersists(row.expectedText), `${row.description} — should persist while scrolling`).toContain(row.expectedText);
        }
    });

});
