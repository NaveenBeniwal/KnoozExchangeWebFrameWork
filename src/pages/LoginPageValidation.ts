import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPageValidation extends BasePage {

    //private locators:
    private readonly emailInput: Locator;
    private readonly passwordInput: Locator
    private readonly emptyEmailValidation: Locator;
    private readonly emptyPasswordValidation: Locator;
    private readonly invalidEmailValidation: Locator;
    private readonly loginErrorMessage: Locator;
    private readonly accountLockedMessage: Locator;
    private readonly continueButton: Locator;
    private readonly getOtpButton: Locator;
    private readonly codeInput: Locator;
    private readonly getVerificationCodeValidation: Locator;
    private readonly otpRequiredValidation: Locator;
    private readonly enterValidEmailOtpErrorMessage: Locator;
    private readonly maxOtpLimitValidation: Locator;

    constructor(page: Page) {
        super(page);
        this.emailInput = page.getByRole('textbox', { name: 'Email' });
        this.passwordInput = page.getByRole('textbox', { name: 'Password' });
        this.emptyEmailValidation = page.getByText('Email is required', { exact: true });
        this.emptyPasswordValidation = page.getByText('Password is required', { exact: true });
        this.invalidEmailValidation = page.getByText('Please enter valid email', { exact: true });
        this.loginErrorMessage = page.locator(`.ant-message-notice-content`);
        this.accountLockedMessage = page.getByText('Your acount is locked', { exact: false });
        this.continueButton = page.getByRole('button', { name: 'Continue' });
        this.getOtpButton = page.getByText('Get OTP', { exact: true });
        this.codeInput = page.getByRole('textbox', { name: 'Enter code' });
        this.getVerificationCodeValidation = page.getByText('Please get a verification code first', { exact: true });
        this.otpRequiredValidation = page.getByText('OTP is required', { exact: true });
        this.enterValidEmailOtpErrorMessage = page.locator(`span:has-text("Please enter valid email OTP")`);
        this.maxOtpLimitValidation = page.locator('.errorCls');
        
    }

    //public page actions(methods)/behaviors:
    async doLogin(email: string, password: string): Promise<void> {
        console.log(`${email} - ${password}`);
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.continueButton.click();
    }

    async getInvalidEmailValidation(email: string): Promise<void> {
        console.log(`user creds: ${email}`);
        await this.continueButton.click();
        await this.emailInput.fill(email);
    }
        
    async getEmptyEmailValidationMessage(): Promise<string | null> {
        await this.continueButton.click();
        return await this.emptyEmailValidation.textContent();
    }

    async getEmptyPasswordValidationMessage(): Promise<string | null> {
        await this.continueButton.click();
        return await this.emptyPasswordValidation.textContent();
    }

    async getInvalidEmailValidationMessage(): Promise<string | null> {
        await this.continueButton.click();
        try {
            await this.invalidEmailValidation.waitFor({ state: 'visible', timeout: 5000 });
            return await this.invalidEmailValidation.textContent();
        } catch {
            // Validation message never appeared — page accepted the invalid email
            return null;
        }
    }

    async getLoginErrorMessage(): Promise<string | null> {
        const error = this.loginErrorMessage.or(this.accountLockedMessage);
        await error.last().waitFor({ state: 'visible' });
        const text = await error.last().textContent();
        await error.last().waitFor({ state: 'hidden' });
        return text;
    }

    async getOtpErrorMessage(){
        await this.continueButton.click();

    }
}