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

    // Standard 3-line trace for every step: what we did, what we expected, what we got — so the
    // HTML report's console output shows exactly what happened without needing to re-run headed.
    private logStep(step: string, expected: string, actual: string): void {
        console.log(
            `[LoginValidation] Step     : ${step}\n` +
            `[LoginValidation] Expected : ${expected}\n` +
            `[LoginValidation] Actual   : ${actual}`
        );
    }

    //public page actions(methods)/behaviors:
    async doLogin(email: string, password: string): Promise<void> {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.continueButton.click();
        this.logStep(`Filled credentials and clicked Continue (email: "${email}")`, 'Continue clicked', 'Continue clicked');
    }

    async getInvalidEmailValidation(email: string): Promise<void> {
        await this.continueButton.click();
        await this.emailInput.fill(email);
        this.logStep('Filled Email field with an invalid value', `filled with "${email}"`, `filled with "${email}"`);
    }

    // expectedMessage defaults to the literal validation text this field always shows when empty —
    // pass a different value only if a caller genuinely expects something else.
    async getEmptyEmailValidationMessage(expectedMessage = 'Email is required'): Promise<string | null> {
        await this.continueButton.click();
        const text = await this.emptyEmailValidation.textContent();
        this.logStep('Read empty-email validation message', `"${expectedMessage}"`, `"${text}"`);
        return text;
    }

    async getEmptyPasswordValidationMessage(expectedMessage = 'Password is required'): Promise<string | null> {
        await this.continueButton.click();
        const text = await this.emptyPasswordValidation.textContent();
        this.logStep('Read empty-password validation message', `"${expectedMessage}"`, `"${text}"`);
        return text;
    }

    // expectedMessage is optional — pass the CSV row's expectedError so the log shows a concrete
    // Expected value next to Actual, instead of a vague description with nothing to compare against.
    async getInvalidEmailValidationMessage(expectedMessage?: string): Promise<string | null> {
        await this.continueButton.click();
        const expectedText = expectedMessage ? `"${expectedMessage}"` : 'a validation message';
        try {
            await this.invalidEmailValidation.waitFor({ state: 'visible', timeout: 5000 });
            const text = await this.invalidEmailValidation.textContent();
            this.logStep('Read invalid-email validation message', expectedText, `"${text}"`);
            return text;
        } catch {
            // Validation message never appeared — page accepted the invalid email
            this.logStep('Read invalid-email validation message', expectedText, 'no validation message appeared — email was accepted as valid');
            return null;
        }
    }

    async getLoginErrorMessage(expectedMessage?: string): Promise<string | null> {
        const error = this.loginErrorMessage.or(this.accountLockedMessage);
        await error.last().waitFor({ state: 'visible' });
        const text = await error.last().textContent();
        this.logStep('Read login error message', expectedMessage ? `"${expectedMessage}"` : 'a login error message', `"${text}"`);
        await error.last().waitFor({ state: 'hidden' });
        return text;
    }

    async getOtpErrorMessage(){
        await this.continueButton.click();
        this.logStep('Clicked Continue', 'Continue clicked', 'Continue clicked');
    }
}