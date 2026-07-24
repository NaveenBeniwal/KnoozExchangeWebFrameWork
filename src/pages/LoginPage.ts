import type { Locator, Page } from '@playwright/test';
import crypto from 'crypto';
import { BasePage } from './BasePage';

// Same TOTP (RFC 6238) implementation already used by src/api/TradeApiHelper.ts for the API-level
// 2FA login flow — duplicated here rather than imported since that module doesn't export it.
function generateTOTP(base32Secret: string): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = base32Secret.replace(/=+$/, '').toUpperCase();
    let bits = '';
    for (const char of clean) {
        const idx = alphabet.indexOf(char);
        if (idx === -1) continue;
        bits += idx.toString(2).padStart(5, '0');
    }
    const keyBytes = Buffer.alloc(Math.floor(bits.length / 8));
    for (let i = 0; i < keyBytes.length; i++) {
        keyBytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
    }
    const step = Math.floor(Date.now() / 1000 / 30);
    const msg = Buffer.alloc(8);
    msg.writeBigUInt64BE(BigInt(step));
    const digest = crypto.createHmac('sha1', keyBytes).update(msg).digest();
    const offset = digest[19] & 0x0f;
    const code =
        (((digest[offset] & 0x7f) << 24) |
            ((digest[offset + 1] & 0xff) << 16) |
            ((digest[offset + 2] & 0xff) << 8) |
            (digest[offset + 3] & 0xff)) %
        1_000_000;
    return code.toString().padStart(6, '0');
}

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
        this.homePage = page.getByText('Home', { exact: true }).first();
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
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.continueButton.click();

        // Some accounts show a "Get OTP" button (static email OTP flow); others go straight to
        // a 2FA authenticator code field with no such button. Detect which one applies.
        const getOtpVisible = await this.getOtpButton.isVisible({ timeout: 4000 }).catch(() => false);

        if (getOtpVisible) {
            await this.getOtpButton.click();
            await this.page.waitForTimeout(2000);
            await this.codeInput.fill(otp);
            await this.page.waitForTimeout(2000);
            await this.continueButton.click();
        } else {
            const totpSecret = process.env.UI_2FA_SECRET;
            const code = totpSecret ? generateTOTP(totpSecret) : otp;
            await this.page.waitForTimeout(2000);

            // This screen ("Enter 2FA code from the app") renders one single-digit textbox per
            // code digit instead of the single named "Enter code" field the email-OTP flow uses —
            // confirmed via a live failure snapshot showing 6 unnamed textboxes. Fill each one.
            const digitInputs = this.page.getByRole('textbox');
            const boxCount = await digitInputs.count();
            if (boxCount > 1) {
                for (let i = 0; i < code.length && i < boxCount; i++) {
                    await digitInputs.nth(i).fill(code[i]);
                }
            } else {
                await this.codeInput.fill(code);
            }
            // The 2FA digit-box screen has no Continue button at all — it auto-submits once the
            // last digit is filled. Only the "Get OTP" branch above has a Continue button to click.
            await this.page.waitForTimeout(2000);
        }
        // Toast is transient — may vanish before a slow worker checks it.
        // Fall back to waiting for the Home nav item which persists after login.
        await this.loginSuccessMessage.waitFor({ state: 'visible', timeout: 15000 }).catch(async () => {
            await this.homePage.waitFor({ state: 'visible', timeout: 10000 });
        });
    }

    async isUserOnHomePage(): Promise<boolean> {
        await this.homePage.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        const isVisible = await this.homePage.isVisible({ timeout: 10000 }).catch(() => false);
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