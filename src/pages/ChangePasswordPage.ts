import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ChangePasswordPage extends BasePage {

    private readonly settingsAvatar:       Locator;
    private readonly profileSettingsLink:  Locator;
    private readonly securityTab:          Locator;
    private readonly changePasswordButton: Locator;
    private readonly oldPasswordInput:     Locator;
    private readonly newPasswordInput:     Locator;
    private readonly confirmPasswordInput: Locator;
    private readonly otpInput:             Locator;
    private readonly getOtpButton:         Locator;
    private readonly changeButton:         Locator;
    // NOT confirmed live yet — guessed wording, matching the "X successfully" pattern already
    // confirmed live for the OTP sent/resent toasts in ChangePasswordValidationPage.
    private readonly passwordChangedSuccessMsg: Locator;

    constructor(page: Page) {
        super(page);

        this.settingsAvatar       = page.locator('.ant-avatar-string').nth(1);
        this.profileSettingsLink  = page.getByRole('link', { name: 'Profile Settings', exact: true });
        this.securityTab          = page.getByText('Security settings', { exact: true });
        this.changePasswordButton = page.getByText('Change', { exact: true }).last();

        this.oldPasswordInput     = page.getByRole('textbox', { name: 'Enter old password' });
        this.newPasswordInput     = page.getByRole('textbox', { name: 'Enter new password' });
        this.confirmPasswordInput = page.getByRole('textbox', { name: 'Enter confirm Password' });
        this.otpInput             = page.getByRole('textbox', { name: 'Enter OTP' });
        this.getOtpButton         = page.getByText('Get OTP', { exact: true }).last();
        this.changeButton         = page.getByText('Change', { exact: true }).last();

        this.passwordChangedSuccessMsg = page.getByText('Password changed successfully', { exact: true });
    }

    // Standard 3-line trace for every step: what we did, what we expected, what we got — so the
    // HTML report's console output shows exactly what happened without needing to re-run headed.
    private logStep(step: string, expected: string, actual: string): void {
        console.log(
            `[ChangePassword] Step     : ${step}\n` +
            `[ChangePassword] Expected : ${expected}\n` +
            `[ChangePassword] Actual   : ${actual}`
        );
    }

    async navigateToChangePassword(): Promise<void> {
        await this.settingsAvatar.click();
        await this.profileSettingsLink.click();
        await this.securityTab.click();
        await this.changePasswordButton.click();
        this.logStep('Navigated to Change Password', 'Change Password form visible', 'navigation clicked through Settings > Profile Settings > Security settings > Change Password');
    }

    async changePasswordSuccessfully(oldPassword: string, newPassword: string, confirmPassword: string, otp: string, expected?: string): Promise<string> {
        await this.oldPasswordInput.fill(oldPassword);
        this.logStep('Filled Old Password field', `filled with "${oldPassword}"`, `filled with "${oldPassword}"`);

        await this.newPasswordInput.fill(newPassword);
        this.logStep('Filled New Password field', `filled with "${newPassword}"`, `filled with "${newPassword}"`);

        await this.confirmPasswordInput.fill(confirmPassword);
        this.logStep('Filled Confirm Password field', `filled with "${confirmPassword}"`, `filled with "${confirmPassword}"`);

        await this.getOtpButton.click();
        this.logStep('Clicked "Get OTP"', 'Get OTP clicked', 'Get OTP clicked');

        await this.page.waitForTimeout(2000);
        await this.otpInput.fill(otp);
        this.logStep('Filled OTP field', `filled with "${otp}"`, `filled with "${otp}"`);

        await this.changeButton.click();
        this.logStep('Clicked "Change"', 'Change clicked', 'Change clicked');

        const message = ((await this.passwordChangedSuccessMsg.textContent({ timeout: 8000 }).catch(() => '')) ?? '').trim();
        this.logStep('Read "password changed successfully" message', expected !== undefined ? `"${expected}"` : 'a success message', `"${message}"`);
        return message;
    }

    // A genuinely successful password change forces a logout per the app's own notice ("you have
    // to login again after changing the password") — confirms the redirect actually happens.
    async waitForRedirectToLogin(timeoutMs = 15000): Promise<void> {
        await this.page.waitForURL('**/login', { timeout: timeoutMs });
        this.logStep('Waited for redirect to the login page after password change', 'URL contains "/login"', `URL is "${this.page.url()}"`);
    }
}
