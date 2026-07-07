import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {

    //private locators:
    private readonly signInButton: Locator;
    private readonly emailInput: Locator;
    private readonly passwordInput: Locator;
    private readonly forgotPasswordLink: Locator;
    private readonly logo: Locator;
    private readonly continueButton: Locator;
    private readonly getOtpButton: Locator;
    private readonly codeInput: Locator;
    private readonly loginSuccessMessage: Locator;
    private readonly homePage: Locator;
    private readonly loginErrorMessage: Locator;
    private readonly laterButton: Locator;

    constructor(page: Page) {
        super(page);
        this.signInButton = page.getByText('Sign In', { exact: true });
        this.emailInput = page.getByRole('textbox', { name: 'Email' });
        this.passwordInput = page.getByRole('textbox', { name: 'Password' });
        this.forgotPasswordLink = page.getByRole('link', { name: 'Forgot Password?' });
        this.logo = page.getByAltText('img');
        this.continueButton = page.getByRole('button', { name: 'Continue' });
        this.getOtpButton = page.getByText('Get OTP', { exact: true });
        this.codeInput = page.getByRole('textbox', { name: 'Enter code' });
        this.loginSuccessMessage = page.locator(`span:has-text("Login Successfully")`);
        this.homePage = page.getByText('Home', { exact: true });
        this.loginErrorMessage = page.locator(`span:has-text("Invalid credentials. You are left with 0 more attempts")`);
        this.laterButton = page.getByRole('button', { name: 'Later', exact: true });
    }

    //public page actions(methods)/behaviors:
    async goToLoginPage(): Promise<void> {
        await this.page.goto('/login');
        // goto() resolves on the 'load' event, before this SPA finishes client-side rendering
        // (logo, forgot-password link, etc.) — isLogoVisible()/isForgotPasswordLinkExist() use a
        // plain isVisible() with no auto-retry, so checking immediately after goto() can race the
        // render and report "not visible" even though the page loads correctly a moment later.
        await this.page.waitForLoadState('networkidle');
        await this.logo.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    }

    async getLoginPageTitle(): Promise<string> {
        return await this.page.title();
    }

    async isLogoVisible(): Promise<boolean> {
        return await this.logo.isVisible();
    }

    async isForgotPasswordLinkExist(): Promise<boolean> {
        return await this.forgotPasswordLink.isVisible();
    }

    async doLogin(email: string, password: string, otp: string): Promise<void> {
        console.log(`user creds: ${email} : ${password} : ${otp}`);
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.continueButton.click();
        await this.getOtpButton.click();
        await this.page.waitForTimeout(2000);
        await this.codeInput.fill(otp);
        await this.page.waitForTimeout(2000);
        await this.continueButton.click();
        // Toast is transient — may vanish before a slow worker checks it.
        // Fall back to waiting for the Home nav item which persists after login.
        await this.loginSuccessMessage.waitFor({ state: 'visible', timeout: 15000 }).catch(async () => {
            await this.homePage.waitFor({ state: 'visible', timeout: 10000 });
        });
    }

    async isUserOnHomePage(): Promise<boolean> {
        await this.page.waitForTimeout(2000);
        const isVisible = await this.homePage.isVisible();
        console.log(isVisible ? '[LoginPage] Login successful — Home page loaded' : '[LoginPage] Login failed — Home page not visible');
        return isVisible;
    }

    async dismissPostLoginDialogsAndWaitForHome(): Promise<void> {
        if (await this.laterButton.isVisible({ timeout: 8000 }).catch(() => false)) {
            await this.laterButton.click();
            await this.page.waitForLoadState('domcontentloaded').catch(() => {});
        }
        await this.homePage.waitFor({ state: 'visible', timeout: 15000 });
    }

}