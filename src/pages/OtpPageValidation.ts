import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class OtpPageValidation extends BasePage {

    //private locators (declared in the order the scenarios below use them):
    private readonly emailInput: Locator;
    private readonly passwordInput: Locator;
    private readonly continueButton: Locator;
    private readonly getOtpButton: Locator;
    private readonly getVerificationCodeValidation: Locator;
    private readonly otpSentSuccessfullyMessage: Locator;
    private readonly otpRequiredValidation: Locator;
    private readonly pleaseEnterCodeValidation: Locator;
    private readonly codeInput: Locator;
    private readonly enterValidEmailOtpErrorMessage: Locator;
    private readonly maxOtpLimitValidation: Locator;
    private readonly mustBeOnlyDigitsValidation: Locator;
    private readonly resendOtpButton: Locator;
    private readonly resendOtpTimer: Locator;
    private readonly otpResentSuccessfullyMessage: Locator;
    private readonly cancelSigningInLink: Locator;

    private otpAlreadyRequested = false;

    constructor(page: Page) {
        super(page);
        this.emailInput = page.getByRole('textbox', { name: 'Email' });
        this.passwordInput = page.getByRole('textbox', { name: 'Password' });
        this.continueButton = page.getByRole('button', { name: 'Continue' });
        this.getOtpButton = page.getByText('Get OTP', { exact: true });
        this.getVerificationCodeValidation = page.getByText('Please get a verification code first', { exact: true });
        this.otpSentSuccessfullyMessage = page.locator(`span:has-text("OTP sent successfully")`);
        this.otpRequiredValidation = page.getByText('OTP is required', { exact: true });
        this.pleaseEnterCodeValidation = page.getByText('Please enter code', { exact: true });
        this.codeInput = page.getByRole('textbox', { name: 'Enter code' });
        this.enterValidEmailOtpErrorMessage = page.locator(`span:has-text("Please enter valid email OTP")`);
        this.maxOtpLimitValidation = page.locator('.errorCls');
        this.mustBeOnlyDigitsValidation = page.getByText('Must be only digits', { exact: true });
        this.resendOtpButton = page.getByText('Resend OTP', { exact: true }).last();
        this.resendOtpTimer = page.locator('text=/Resend OTP in \d+s/');
        this.otpResentSuccessfullyMessage = page.locator(`span:has-text("OTP resent successfully")`);
        this.cancelSigningInLink = page.getByRole('link', { name: 'Cancel Signing In' });
    }

    // Standard 3-line trace for every step: what we did, what we expected, what we got — so the
    // HTML report's console output shows exactly what happened without needing to re-run headed.
    private logStep(step: string, expected: string, actual: string): void {
        console.log(
            `[OtpPageValidation] Step     : ${step}\n` +
            `[OtpPageValidation] Expected : ${expected}\n` +
            `[OtpPageValidation] Actual   : ${actual}`
        );
    }

    //public page actions(methods)/behaviors, in the order the spec file's scenarios run them:

    async getOtpPage(email: string, password: string): Promise<void> {
        console.log(`user creds: ${email} : ${password}`);
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.continueButton.click();
        await this.getOtpButton.waitFor({ state: 'visible', timeout: 10000 });
        this.logStep(
            'Filled email + password and clicked Continue',
            '"Get OTP" button visible — OTP entry screen reached',
            'OTP entry screen reached',
        );
    }

    // Scenario 1: click Continue without requesting OTP → "Please get a verification code first"
    async getOtpVerificationCode(): Promise<string | null> {
        await this.continueButton.click();
        await this.getVerificationCodeValidation.waitFor({ state: 'visible', timeout: 5000 });
        const message = await this.getVerificationCodeValidation.textContent();
        this.logStep(
            'Clicked Continue without requesting an OTP',
            'validation message: "Please get a verification code first"',
            `validation message: "${message}"`,
        );
        return message;
    }

    // The one designated place in the whole suite that actually requests a fresh OTP — every later
    // scenario reuses this same session (see requestOtpAndVerify's otpAlreadyRequested guard below),
    // so the account only takes one real "Get OTP" hit per full run instead of one per scenario.
    async getOtpSentSuccessfullyMessage(): Promise<string | null> {
        await this.getOtpButton.click();
        await this.page.waitForTimeout(2000);
        await this.otpSentSuccessfullyMessage.waitFor({ state: 'visible', timeout: 5000 });
        const message = await this.otpSentSuccessfullyMessage.textContent();
        this.otpAlreadyRequested = true;
        this.logStep(
            'Clicked "Get OTP" for the first time this run',
            'validation message: "OTP sent successfully"',
            `validation message: "${message}"`,
        );
        return message;
    }

    // Scenario 2: click Get OTP → fill OTP → clear → click Continue → "OTP is required"
    // Requests OTP only if not already active — reuses a session an earlier scenario started.
    async getOtpRequiredValidation(otpValue: string): Promise<string | null> {
        await this.requestOtpAndVerify();
        await this.continueButton.click();
        await this.otpRequiredValidation.waitFor({ state: 'visible', timeout: 5000 });
        const message = await this.otpRequiredValidation.textContent();
        this.logStep(
            'Left the code field empty and clicked Continue',
            'validation message: "OTP is required"',
            `validation message: "${message}"`,
        );
        return message;
    }

    // Scenario 3: click Get OTP → fill OTP (e.g. "1234") → click Continue → "Please enter valid email OTP"
    // Requests OTP only if not already active — reuses a session an earlier scenario started.
    async getPleaseEnterValidEmailOtpErrorMessage(otpValue: string): Promise<string | null> {
        await this.requestOtpAndVerify();
        await this.codeInput.fill(otpValue);
        await this.continueButton.click();
        const results = await Promise.allSettled([
            this.enterValidEmailOtpErrorMessage.textContent({ timeout: 6000 }),
            this.getVerificationCodeValidation.textContent({ timeout: 6000 }),
        ]);
        const message = results[0].status === 'fulfilled'
            ? results[0].value
            : results[1].status === 'fulfilled'
                ? results[1].value
                : null;

        this.logStep(
            `Entered code "${otpValue}", clicked Continue`,
            'validation message: "Please enter valid email OTP"',
            `validation message: "${message}"`,
        );

        // No "Get OTP" recovery here on purpose: this scenario already reuses the session from
        // "OTP sent successfully", and re-requesting after it just burned 2 wasted attempts every
        // run (confirmed live: both always came back "did not register (possible rate limit)"),
        // pushing the account closer to a real rate limit for no benefit — the scenarios after this
        // one (max OTP limit, must be only digits) only need the existing session to still be active,
        // not a fresh one.
        return message;
    }

    // Scenario 4: fill OTP with >5 digits → "Max OTP limit should be 5 digits."
    // Requests OTP only if not already active — reuses a session an earlier scenario started.
    async getMaxOtpLimitValidation(otpValue: string): Promise<string | null> {
        await this.requestOtpAndVerify();
        await this.codeInput.fill(otpValue);
        await this.continueButton.click();
        await this.maxOtpLimitValidation.waitFor({ state: 'visible', timeout: 5000 });
        const message = await this.maxOtpLimitValidation.textContent();
        this.logStep(
            `Entered ${otpValue.length}-digit code "${otpValue}", clicked Continue`,
            'validation message: "Max OTP limit should be 5 digits."',
            `validation message: "${message}"`,
        );
        return message;
    }

    // Scenario 5: fill OTP with non-digit characters → "Must be only digits"
    // requestOtpAndVerify() no-ops once otpAlreadyRequested is set by an earlier scenario this run.
    async getMustBeOnlyDigitsValidation(otpValue: string): Promise<string | null> {
        await this.requestOtpAndVerify();
        await this.codeInput.clear();
        await this.codeInput.fill(otpValue);
        await this.continueButton.click();
        await this.mustBeOnlyDigitsValidation.waitFor({ state: 'visible', timeout: 5000 });
        const message = await this.mustBeOnlyDigitsValidation.textContent();
        this.logStep(
            `Entered code "${otpValue}", clicked Continue`,
            'validation message: "Must be only digits"',
            `validation message: "${message}"`,
        );
        return message;
    }

    // Scenario 6: waits for the ~60s post-request cooldown to lapse, clicks "Resend OTP", and
    // verifies the resend confirmation. This is a second real OTP request (unavoidable — it's what's
    // being tested), so it should be the LAST scenario that touches the OTP button in a run.
    async getResendOtpMessage(): Promise<string | null> {
        await this.resendOtpButton.waitFor({ state: 'visible', timeout: 70000 });
        await this.resendOtpButton.click();
        await this.otpResentSuccessfullyMessage.waitFor({ state: 'visible', timeout: 5000 });
        const message = await this.otpResentSuccessfullyMessage.textContent();
        this.logStep(
            'Waited for the "Resend OTP" button to become active (~60s cooldown) and clicked it',
            'validation message: "OTP resent successfully"',
            `validation message: "${message}"`,
        );
        return message;
    }

    // Scenario 7: Cancel Signing In — abandons the OTP flow, so this must be the LAST test in the file.
    async isCancelSigningInVisible(): Promise<boolean> {
        const isVisible = await this.cancelSigningInLink.isVisible();
        this.logStep('Checked "Cancel Signing In" link', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }

    async clickCancelSigningIn(): Promise<string> {
        await this.cancelSigningInLink.click();
        await this.page.waitForLoadState('domcontentloaded');
        const url = this.page.url();
        this.logStep('Clicked "Cancel Signing In"', 'redirected to the login page', `landed on: "${url}"`);
        return url;
    }

    // Confirms a "Get OTP" click actually registered (button flips to "Resend OTP" / a cooldown
    // timer) rather than assuming success just because the click didn't throw. A request can be
    // silently rejected (e.g. rate-limited after several OTP requests in quick succession from
    // earlier scenarios in the same run) and leave the page on the pre-OTP state — retries once
    // after a short wait before giving up, so a transient rejection doesn't cause a confusing
    // "Please get a verification code first" failure instead of the real validation being tested.
    //
    // Gated on the otpAlreadyRequested flag (not a UI check) — skips entirely once any scenario has
    // already requested an OTP this run, since getOtpButton stays visible/clickable even after a
    // successful request and would otherwise trigger a redundant second real request every time.
    //
    // Never throws: this is a best-effort session helper called from several scenarios (including
    // scenario 3's "regardless of outcome" recovery step) — in .serial() mode, an uncaught error here
    // would fail that test outright and skip every scenario after it. Confirmed live that a stray
    // "Target page, context or browser has been closed" from a mid-run Chromium hiccup propagated
    // out of this method and killed the rest of the run; catching it here means a scenario that
    // genuinely needs the page (e.g. codeInput.fill()) still fails honestly on its own, instead of
    // this "just try to get a session" helper taking the whole suite down with it.
    private async requestOtpAndVerify(): Promise<void> {
        if (this.otpAlreadyRequested) {
            this.logStep(
                'Checked whether an OTP request is needed',
                'reuse the existing active OTP session',
                'already requested earlier this run — skipping "Get OTP"',
            );
            return;
        }

        if (this.page.isClosed()) {
            this.logStep(
                'Checked whether an OTP request is needed',
                'an open page to request it on',
                'page/context was already closed — skipping "Get OTP"',
            );
            return;
        }

        try {
            for (let attempt = 1; attempt <= 2; attempt++) {
                await this.getOtpButton.click({ timeout: 3000 }).catch(() => {});
                const results = await Promise.allSettled([
                    this.resendOtpButton.waitFor({ state: 'visible', timeout: 5000 }),
                    this.resendOtpTimer.waitFor({ state: 'visible', timeout: 5000 }),
                ]);
                const requested = results.some(r => r.status === 'fulfilled');
                this.logStep(
                    `Clicked "Get OTP" (attempt ${attempt}/2)`,
                    '"Resend OTP" button or cooldown timer appears — request registered',
                    requested ? 'request registered' : 'neither appeared — request did not register (possible rate limit)',
                );
                if (requested) {
                    this.otpAlreadyRequested = true;
                    return;
                }
                if (attempt < 2) {
                    await this.page.waitForTimeout(2000);
                }
            }
        } catch (error) {
            this.logStep(
                'Attempted to click "Get OTP" and verify the request registered',
                'request registered or gracefully marked as not registered',
                `threw unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
