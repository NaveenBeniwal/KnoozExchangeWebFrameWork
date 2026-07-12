import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface MaskCycleResult {
    maskedByDefault:        boolean;
    maskedAfterFirstClick:  boolean;  // expected false — revealed after the first eye-icon click
    valueWhileRevealed:     string;
    maskedAfterSecondClick: boolean;  // expected true — masked again after the second click
}

export class ChangePasswordValidationPage extends BasePage {

    // ─── Navigation & buttons ─────────────────────────────────────────────────────
    private readonly settingsAvatar:       Locator;
    private readonly profileSettingsLink:  Locator;
    private readonly securityTab:          Locator;
    private readonly changePasswordButton: Locator;
    private readonly changeButton:         Locator;
    private readonly getOtpButton:         Locator;
    private readonly resendOtpButton:      Locator;
    private readonly closeModalButton:     Locator;

    // ─── Page text ────────────────────────────────────────────────────────────────
    private readonly pageHeading:              Locator;
    private readonly chooseNewPasswordText:    Locator;
    private readonly withdrawalRestrictionText: Locator;
    private readonly reloginRequiredText:      Locator;
    private readonly oldPasswordLabel:         Locator;
    private readonly newPasswordLabel:         Locator;
    private readonly confirmPasswordLabel:     Locator;
    private readonly otpLabel:                 Locator;

    // ─── Input fields ─────────────────────────────────────────────────────────────
    private readonly oldPasswordInput:     Locator;
    private readonly newPasswordInput:     Locator;
    private readonly confirmPasswordInput: Locator;
    private readonly otpInput:             Locator;

    // ─── Password field eye (show/hide) icons ────────────────────────────────────
    private readonly oldPasswordEyeIcon:     Locator;
    private readonly newPasswordEyeIcon:     Locator;
    private readonly confirmPasswordEyeIcon: Locator;

    // ─── Validation messages ──────────────────────────────────────────────────────
    private readonly oldPasswordRequiredMsg:      Locator;
    private readonly newPasswordRequiredMsg:       Locator;
    private readonly confirmPasswordRequiredMsg:   Locator;
    private readonly passwordCriteriaMsg:          Locator;
    private readonly confirmPasswordMismatchMsg:   Locator;
    private readonly getOtpFirstMsg:               Locator;
    private readonly otpSentMsg:                   Locator;
    private readonly incorrectOtpMsg:              Locator;
    private readonly oldPasswordIncorrectMsg:      Locator;
    private readonly otpAlreadyUsedMsg:            Locator;
    private readonly otpResentMsg:                 Locator;
    private readonly newPasswordSameAsOldMsg:      Locator;
    private readonly otpLengthExceededMsg:         Locator;
    // Generic "whatever toast notification is currently showing" locator (not tied to one
    // specific message's text) — read in failIfOtpRateLimited() and matched against known limit
    // phrases, since either can surface on ANY Get OTP or Resend click, in any test, once the
    // account's limit for the period is used up.
    private readonly otpMaxLimitReachedMsg:        Locator;

    constructor(page: Page) {
        super(page);

        this.settingsAvatar       = page.locator('.ant-avatar-string').nth(1);
        this.profileSettingsLink  = page.getByRole('link', { name: 'Profile Settings', exact: true });
        this.securityTab          = page.getByText('Security settings', { exact: true });
        // Confirmed live: .last() is needed because the page always has at least two "Change"
        // matches once the modal is open — the page button that opened it, and the modal's own
        // button (used both to submit the form and, clicked a second time, as its own follow-up
        // confirmation step) — .last() always resolves to whichever copy is newest in the DOM.
        this.changePasswordButton = page.getByText('Change', { exact: true }).last();
        this.changeButton         = page.getByText('Change', { exact: true }).last();
        // Confirmed live — the button's accessible text is "Get OTP", not "Get code".
        this.getOtpButton         = page.getByText('Get OTP', { exact: true }).last();
        this.resendOtpButton      = page.getByText('Resend OTP', { exact: true }).last();
        // NOT confirmed live yet — span.anticon-close-circle was likely matching an error toast's
        // icon (Ant Design's CloseCircleOutlined, used by message.error()) instead of the modal's
        // own close button, which is why closeModal() reported "closed" while the modal stayed
        // open whenever a leftover error toast happened to be on screen. .ant-modal-close is
        // Ant Design's standard modal close-button class.
        this.closeModalButton     = page.locator('.ant-modal-close');

        this.pageHeading               = page.getByRole('heading', { name: 'Change Password', level: 5 });
        this.chooseNewPasswordText     = page.getByText('Please choose a new password.', { exact: true });
        this.withdrawalRestrictionText = page.locator('div.description > div.barcodeContnt > p.des').first();
        this.reloginRequiredText       = page.locator('div.description > div.barcodeContnt > p.des').last();
        this.oldPasswordLabel          = page.getByText('Old Password *', { exact: true }).last();
        this.newPasswordLabel          = page.getByText('New Password *', { exact: true }).last();
        this.confirmPasswordLabel      = page.getByText('Confirm Password *', { exact: true }).last();
        this.otpLabel                  = page.getByText('Enter email OTP *', { exact: true }).last();

        this.oldPasswordInput     = page.getByRole('textbox', { name: 'Enter old password' });
        this.newPasswordInput     = page.getByRole('textbox', { name: 'Enter new password' });
        this.confirmPasswordInput = page.getByRole('textbox', { name: 'Enter confirm Password' });
        this.otpInput             = page.getByRole('textbox', { name: 'Enter OTP' });

        this.oldPasswordEyeIcon     = page.locator('span.ant-input-suffix > span.anticon > svg').nth(0);
        this.newPasswordEyeIcon     = page.locator('span.ant-input-suffix > span.anticon > svg').nth(1);
        this.confirmPasswordEyeIcon = page.locator('span.ant-input-suffix > span.anticon > svg').nth(2);

        // Confirmed live — no trailing period on these three.
        this.oldPasswordRequiredMsg     = page.getByText('Please enter old password', { exact: true });
        this.newPasswordRequiredMsg     = page.getByText('Please enter new password', { exact: true });
        this.confirmPasswordRequiredMsg = page.getByText('Please enter confirm password', { exact: true });
        this.passwordCriteriaMsg        = page.getByText('Password must be a', { exact: false });
        this.confirmPasswordMismatchMsg = page.getByText('New Password and Confirm', { exact: false });
        this.getOtpFirstMsg             = page.getByText('Please get the verification Code first', { exact: true });
        this.otpSentMsg                 = page.getByText('OTP sent successfully', { exact: true });
        this.incorrectOtpMsg            = page.getByText('Invalid OTP', { exact: true });
        this.oldPasswordIncorrectMsg    = page.getByText('Old password is not correct', { exact: true });
        this.otpAlreadyUsedMsg          = page.getByText('This OTP has already been used. Please request a new one', { exact: true });
        this.otpResentMsg               = page.getByText('OTP resent successfully', { exact: true });
        this.newPasswordSameAsOldMsg    = page.getByText("New password can't be the same, as old one", { exact: true });
        this.otpLengthExceededMsg       = page.getByText('Max OTP limit should be 5 digits.', { exact: true });
        this.otpMaxLimitReachedMsg      = page.locator(`div.ant-message-notice-content > div.ant-message-custom-content > span`).last();
    }

    private logStep(step: string, expected: string, actual: string): void {
        console.log(
            `[ChangePasswordValidation] Step     : ${step}\n` +
            `[ChangePasswordValidation] Expected : ${expected}\n` +
            `[ChangePasswordValidation] Actual   : ${actual}`
        );
    }

    // ─── Setup (used in beforeAll, before any numbered test case) ────────────────

    async navigateToChangePassword(): Promise<void> {
        await this.settingsAvatar.click();
        await this.profileSettingsLink.click();
        await this.securityTab.click();
        await this.changePasswordButton.click();
        this.logStep('Navigated to Change Password', 'Change Password form visible', 'navigation clicked through Settings > Profile Settings > Security settings > Change Password');
    }

    // ─── Shared read helpers ──────────────────────────────────────────────────────
    // expected is optional on every read below — pass the CSV row's expected value so the log
    // shows a concrete Expected value next to Actual, instead of a vague description with
    // nothing to compare against.

    private async readText(locator: Locator, step: string, expected?: string): Promise<string> {
        const text = ((await locator.textContent().catch(() => '')) ?? '').trim();
        this.logStep(step, expected !== undefined ? `"${expected}"` : 'some text', `"${text}"`);
        return text;
    }

    private async readPlaceholder(input: Locator, step: string, expected?: string): Promise<string> {
        const placeholder = (await input.getAttribute('placeholder')) ?? '';
        this.logStep(step, expected !== undefined ? `"${expected}"` : 'a placeholder', `"${placeholder}"`);
        return placeholder;
    }

    private async readMessage(locator: Locator, step: string, expected?: string): Promise<string> {
        await locator.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        const text = ((await locator.textContent().catch(() => '')) ?? '').trim();
        this.logStep(step, expected !== undefined ? `"${expected}"` : 'a validation message', `"${text}"`);
        return text;
    }

    // ─── TC-CP-01 ─────────────────────────────────────────────────────────────────

    async getHeadingText(expected?: string): Promise<string> {
        return this.readText(this.pageHeading, 'Read the Change Password page heading', expected);
    }

    // ─── TC-CP-02 ─────────────────────────────────────────────────────────────────

    async getChooseNewPasswordText(expected?: string): Promise<string> {
        return this.readText(this.chooseNewPasswordText, 'Read the "choose a new password" text', expected);
    }

    // ─── TC-CP-03 ─────────────────────────────────────────────────────────────────

    async getWithdrawalRestrictionText(expected?: string): Promise<string> {
        return this.readText(this.withdrawalRestrictionText, 'Read the withdrawal-restriction notice', expected);
    }

    // ─── TC-CP-04 ─────────────────────────────────────────────────────────────────

    async getReloginRequiredText(expected?: string): Promise<string> {
        return this.readText(this.reloginRequiredText, 'Read the relogin-required notice', expected);
    }

    // ─── TC-CP-05 ─────────────────────────────────────────────────────────────────

    async getOldPasswordLabelText(expected?: string): Promise<string> {
        return this.readText(this.oldPasswordLabel, 'Read the Old Password field label', expected);
    }

    // ─── TC-CP-06 ─────────────────────────────────────────────────────────────────

    async getNewPasswordLabelText(expected?: string): Promise<string> {
        return this.readText(this.newPasswordLabel, 'Read the New Password field label', expected);
    }

    // ─── TC-CP-07 ─────────────────────────────────────────────────────────────────

    async getConfirmPasswordLabelText(expected?: string): Promise<string> {
        return this.readText(this.confirmPasswordLabel, 'Read the Confirm Password field label', expected);
    }

    // ─── TC-CP-08 ─────────────────────────────────────────────────────────────────

    async getOtpLabelText(expected?: string): Promise<string> {
        return this.readText(this.otpLabel, 'Read the Enter email OTP field label', expected);
    }

    // ─── Field actions & eye-icon mask cycle — private: the spec file never fills a field or
    // clicks a button directly, it only calls the composite methods below (TC-CP-09 onward),
    // which perform whatever fill/click sequence a given test needs and return the result.

    private async fillOldPassword(value: string): Promise<void> {
        await this.oldPasswordInput.fill(value);
        this.logStep('Filled Old Password field', `filled with "${value}"`, `filled with "${value}"`);
    }

    private async fillNewPassword(value: string): Promise<void> {
        await this.newPasswordInput.fill(value);
        this.logStep('Filled New Password field', `filled with "${value}"`, `filled with "${value}"`);
    }

    private async fillConfirmPassword(value: string): Promise<void> {
        await this.confirmPasswordInput.fill(value);
        this.logStep('Filled Confirm Password field', `filled with "${value}"`, `filled with "${value}"`);
    }

    private async fillOtp(value: string): Promise<void> {
        await this.otpInput.fill(value);
        this.logStep('Filled OTP field', `filled with "${value}"`, `filled with "${value}"`);
    }

    private async clearAllFields(): Promise<void> {
        await this.oldPasswordInput.fill('');
        await this.newPasswordInput.fill('');
        await this.confirmPasswordInput.fill('');
        await this.otpInput.fill('');
        this.logStep('Cleared all Change Password fields', 'all fields empty', 'all fields cleared');
    }

    private async isInputMasked(input: Locator): Promise<boolean> {
        return (await input.getAttribute('type')) === 'password';
    }

    private async runMaskCycle(
        fill: (value: string) => Promise<void>,
        input: Locator,
        eyeIcon: Locator,
        fieldLabel: string,
        value: string,
    ): Promise<MaskCycleResult> {
        await fill(value);
        this.logStep(`Filled ${fieldLabel} field`, `filled with "${value}"`, `filled with "${value}"`);

        const maskedByDefault = await this.isInputMasked(input);
        this.logStep(`Checked ${fieldLabel} field masking`, 'masked by default', maskedByDefault ? 'masked' : 'revealed');

        await eyeIcon.click();
        await this.page.waitForTimeout(1500);
        this.logStep(`Clicked ${fieldLabel} eye icon`, 'masking toggles to revealed', 'eye icon clicked');
        const maskedAfterFirstClick = await this.isInputMasked(input);
        this.logStep(`Checked ${fieldLabel} field masking after first eye-icon click`, 'revealed', maskedAfterFirstClick ? 'masked' : 'revealed');
        const valueWhileRevealed = await input.inputValue();
        this.logStep(`Read ${fieldLabel} field value while revealed`, `"${value}"`, `"${valueWhileRevealed}"`);

        await eyeIcon.click();
        await this.page.waitForTimeout(1500);
        this.logStep(`Clicked ${fieldLabel} eye icon`, 'masking toggles back to masked', 'eye icon clicked');
        const maskedAfterSecondClick = await this.isInputMasked(input);
        this.logStep(`Checked ${fieldLabel} field masking after second eye-icon click`, 'masked again', maskedAfterSecondClick ? 'masked' : 'revealed');

        return { maskedByDefault, maskedAfterFirstClick, valueWhileRevealed, maskedAfterSecondClick };
    }

    // ─── TC-CP-09 ─────────────────────────────────────────────────────────────────

    async getOldPasswordPlaceholder(expected?: string): Promise<string> {
        return this.readPlaceholder(this.oldPasswordInput, 'Read Old Password field placeholder', expected);
    }

    // ─── TC-CP-10 ─────────────────────────────────────────────────────────────────

    async runOldPasswordMaskCycle(value: string): Promise<MaskCycleResult> {
        return this.runMaskCycle(v => this.fillOldPassword(v), this.oldPasswordInput, this.oldPasswordEyeIcon, 'Old Password', value);
    }

    // ─── TC-CP-11 ─────────────────────────────────────────────────────────────────

    async getNewPasswordPlaceholder(expected?: string): Promise<string> {
        return this.readPlaceholder(this.newPasswordInput, 'Read New Password field placeholder', expected);
    }

    // ─── TC-CP-12 ─────────────────────────────────────────────────────────────────

    async runNewPasswordMaskCycle(value: string): Promise<MaskCycleResult> {
        return this.runMaskCycle(v => this.fillNewPassword(v), this.newPasswordInput, this.newPasswordEyeIcon, 'New Password', value);
    }

    // ─── TC-CP-13 ─────────────────────────────────────────────────────────────────

    async getConfirmPasswordPlaceholder(expected?: string): Promise<string> {
        return this.readPlaceholder(this.confirmPasswordInput, 'Read Confirm Password field placeholder', expected);
    }

    // ─── TC-CP-14 ─────────────────────────────────────────────────────────────────

    async runConfirmPasswordMaskCycle(value: string): Promise<MaskCycleResult> {
        return this.runMaskCycle(v => this.fillConfirmPassword(v), this.confirmPasswordInput, this.confirmPasswordEyeIcon, 'Confirm Password', value);
    }

    // ─── TC-CP-15 ─────────────────────────────────────────────────────────────────

    async getGetOtpButtonText(expected?: string): Promise<string> {
        return this.readText(this.getOtpButton, 'Read the "Get OTP" button text', expected);
    }

    // ─── Click actions shared by TC-CP-16 onward ─────────────────────────────────

    // Backend-validated scenarios (wrong old password, already-used OTP, etc.) need a second
    // click on this same "Change" button before the server's error message actually shows —
    // confirmed live for "Old password is not correct." The second click is a quick (3s) no-op
    // check, not a separate method, since it's always the same button either way.
    private async clickChange(): Promise<void> {
        await this.changeButton.click();
        this.logStep('Clicked "Change"', 'Change clicked', 'Change clicked');
        const needsConfirm = await this.changeButton.isVisible({ timeout: 3000 }).catch(() => false);
        if (needsConfirm) {
            await this.changeButton.click();
            this.logStep('Clicked "Change" again to confirm', 'Change (confirm) clicked', 'Change (confirm) clicked');
        }
    }

    private async clickGetOtp(): Promise<void> {
        await this.getOtpButton.click();
        this.logStep('Clicked "Get OTP"', 'Get OTP clicked', 'Get OTP clicked');
        await this.failIfOtpRateLimited();

        const otpTriggered = await this.otpSentMsg.isVisible({ timeout: 3000 }).catch(() => false);
        if (otpTriggered) {
            this.logStep('Checked whether Get OTP actually triggered', '"OTP sent successfully" appears', 'triggered');
        } else {
            // Read whatever toast is actually showing (if any) so the report names the real cause
            // instead of just guessing "max limit reached" blindly.
            const toastText = ((await this.otpMaxLimitReachedMsg.textContent({ timeout: 2000 }).catch(() => '')) ?? '').trim();
            this.logStep('Checked whether Get OTP actually triggered', '"OTP sent successfully" appears', toastText ? `not shown — actual toast: "${toastText}"` : 'not shown — no toast visible at all');
            await this.page.waitForTimeout(1500);
            throw new Error(`OTP did not trigger. Maximum OTP limit reached. Please try again in a while. Stopping execution. (actual toast: "${toastText}")`);
        }
    }

    // Resend has a cooldown after the OTP is first sent — waits for the control to become
    // clickable rather than a fixed sleep, capped generously since the real cooldown duration
    // isn't confirmed live.
    private async clickResendOtp(timeoutMs = 65000): Promise<void> {
        await this.resendOtpButton.waitFor({ state: 'visible', timeout: timeoutMs });
        await this.resendOtpButton.click();
        this.logStep('Clicked "Resend code"', 'Resend code clicked', 'Resend code clicked');
        await this.failIfOtpRateLimited();
    }

    // Two distinct account-level OTP caps have been observed live, and either can surface on ANY
    // Get OTP or Resend click, in any test, once the account's limit for the period is used up —
    // not just from deliberately spamming one control, so this runs generically after every such
    // click instead of needing its own dedicated test to trigger it. When either fires, every
    // message read after it in this same run would otherwise fail with a confusing empty/blank
    // actual value, with no clue why — so this throws immediately with a message that names the
    // real cause and stops the run right here instead.
    // otpMaxLimitReachedMsg is a generic "whatever toast notification is currently showing"
    // locator (not tied to one specific message's text) — read its actual text and match against
    // the known limit phrases, rather than checking .isVisible() on it directly (any toast at all,
    // including a benign success one, would satisfy visibility and false-positive).
    private async failIfOtpRateLimited(): Promise<void> {
        const toastText = ((await this.otpMaxLimitReachedMsg.textContent({ timeout: 2000 }).catch(() => '')) ?? '').trim();
        if (toastText.includes('Maximum limit reached')) {
            this.logStep('Checked current toast message after requesting an OTP', 'no rate-limit message', `"${toastText}"`);
            // Brief pause so the message is clearly captured in the failure screenshot/report
            // before the test fails and the run stops.
            await this.page.waitForTimeout(1500);
            throw new Error(`OTP did not trigger. Maximum OTP limit reached. Please try again in a while. Stopping execution. (actual toast: "${toastText}")`);
        }
        if (toastText.includes('exceeded the OTP request limit')) {
            this.logStep('Checked current toast message after requesting an OTP', 'no rate-limit message', `"${toastText}"`);
            await this.page.waitForTimeout(1500);
            throw new Error(`OTP did not trigger. OTP request limit exceeded for password change. Please try again later. Stopping execution. (actual toast: "${toastText}")`);
        }
    }

    private async submitBlankForm(): Promise<void> {
        await this.clearAllFields();
        await this.clickChange();
    }

    // ─── TC-CP-16 — blank form submit ────────────────────────────────────────────

    async getOldPasswordRequiredMessage(expected?: string): Promise<string> {
        await this.submitBlankForm();
        return this.readMessage(this.oldPasswordRequiredMsg, 'Read "old password required" message', expected);
    }

    // ─── TC-CP-17 — blank form submit ────────────────────────────────────────────

    async getNewPasswordRequiredMessage(expected?: string): Promise<string> {
        await this.submitBlankForm();
        return this.readMessage(this.newPasswordRequiredMsg, 'Read "new password required" message', expected);
    }

    // ─── TC-CP-18 — blank form submit ────────────────────────────────────────────

    async getConfirmPasswordRequiredMessage(expected?: string): Promise<string> {
        await this.submitBlankForm();
        return this.readMessage(this.confirmPasswordRequiredMsg, 'Read "confirm password required" message', expected);
    }

    // ─── TC-CP-19 — blank form submit; same message/locator as getOtpNotRequestedMessage below
    // (confirmed live there's no separate "OTP is required." state), reached via a different
    // path (blank form vs. a filled form that never requested an OTP). ─────────────

    async getOtpRequiredMessage(expected?: string): Promise<string> {
        await this.submitBlankForm();
        return this.readMessage(this.getOtpFirstMsg, 'Read "get verification code first" message (blank form)', expected);
    }

    // ─── TC-CP-20 — no click; this message renders live as soon as the fields are filled. ───

    async getPasswordCriteriaMessage(oldPassword: string, newPassword: string, confirmPassword: string, expected?: string): Promise<string> {
        await this.fillOldPassword(oldPassword);
        await this.fillNewPassword(newPassword);
        await this.fillConfirmPassword(confirmPassword);
        return this.readMessage(this.passwordCriteriaMsg, 'Read password-criteria message', expected);
    }

    // ─── TC-CP-21 — no click; renders live. ──────────────────────────────────────

    async getConfirmPasswordMismatchMessage(newPassword: string, confirmPassword: string, expected?: string): Promise<string> {
        await this.fillNewPassword(newPassword);
        await this.fillConfirmPassword(confirmPassword);
        return this.readMessage(this.confirmPasswordMismatchMsg, 'Read confirm-password-mismatch message', expected);
    }

    // ─── TC-CP-22 — fills all four fields and clicks "Change" directly, without ever requesting
    // an OTP first — this scenario needs a session where Get OTP has genuinely never been
    // clicked, so it runs before any other test that calls Get OTP. ──────────────────

    async getOtpNotRequestedMessage(oldPassword: string, newPassword: string, confirmPassword: string, otp: string, expected?: string): Promise<string> {
        await this.fillOldPassword(oldPassword);
        await this.fillNewPassword(newPassword);
        await this.fillConfirmPassword(confirmPassword);
        await this.fillOtp(otp);
        await this.page.waitForTimeout(2000);
        await this.clickChange();
        return this.readMessage(this.getOtpFirstMsg, 'Read "get verification code first" message (OTP never requested)', expected);
    }

    // ─── TC-CP-23 ─────────────────────────────────────────────────────────────────

    async getOtpSentMessage(expected?: string): Promise<string> {
        await this.clickGetOtp();
        return this.readMessage(this.otpSentMsg, 'Read "OTP sent successfully" message', expected);
    }

    // ─── TC-CP-24 ─────────────────────────────────────────────────────────────────

    async getIncorrectOtpMessage(otp: string, expected?: string): Promise<string> {
        await this.fillOtp(otp);
        await this.page.waitForTimeout(2000);
        await this.clickChange();
        return this.readMessage(this.incorrectOtpMsg, 'Read "incorrect OTP" message', expected);
    }

    // ─── TC-CP-25 ─────────────────────────────────────────────────────────────────

    async getOldPasswordIncorrectMessage(oldPassword: string, newPassword: string, confirmPassword: string, otp: string, expected?: string): Promise<string> {
        await this.fillOldPassword(oldPassword);
        await this.fillNewPassword(newPassword);
        await this.fillConfirmPassword(confirmPassword);
        await this.fillOtp(otp);
        await this.page.waitForTimeout(2000);
        await this.clickChange();
        return this.readMessage(this.oldPasswordIncorrectMsg, 'Read "old password is not correct" message', expected);
    }

    // ─── TC-CP-26 — stateful: reuses the OTP value TC-CP-25 already submitted once earlier in
    // this same serial run, since "already used" can only be shown for an OTP the server has
    // actually seen before. ─────────────────────────────────────────────────────────

    async getOtpAlreadyUsedMessage(oldPassword: string, newPassword: string, confirmPassword: string, otp: string, expected?: string): Promise<string> {
        await this.fillOldPassword(oldPassword);
        await this.fillNewPassword(newPassword);
        await this.fillConfirmPassword(confirmPassword);
        await this.fillOtp(otp);
        await this.page.waitForTimeout(2000);
        await this.clickChange();
        return this.readMessage(this.otpAlreadyUsedMsg, 'Read "OTP already used" message', expected);
    }

    async waitForGetOtpCooldownToClear(timeoutMs = 65000): Promise<boolean> {
        const start = Date.now();
        let lastEnabled: boolean | null = null;
        while (Date.now() - start < timeoutMs) {
            const enabled = await this.getOtpButton.isEnabled().catch(() => true);
            if (enabled !== lastEnabled) {
                this.logStep('Polled "Get OTP" enabled state during cooldown', 'becomes enabled within ~60s', enabled ? 'enabled' : 'disabled');
                lastEnabled = enabled;
            }
            if (enabled) return true;
            await this.page.waitForTimeout(1000);
        }
        this.logStep('Waited for "Get OTP" cooldown to clear', 'becomes enabled within ~60s', `still not enabled after ${timeoutMs}ms`);
        return false;
    }

    // ─── TC-CP-27 ─────────────────────────────────────────────────────────────────

    async getOtpResentMessage(expected?: string): Promise<string> {
        await this.clickResendOtp();
        return this.readMessage(this.otpResentMsg, 'Read "OTP resent successfully" message', expected);
    }

    // ─── TC-CP-28 ─────────────────────────────────────────────────────────────────

    async getNewPasswordSameAsOldMessage(oldPassword: string, newPassword: string, confirmPassword: string, otp: string, expected?: string): Promise<string> {
        await this.fillOldPassword(oldPassword);
        await this.fillNewPassword(newPassword);
        await this.fillConfirmPassword(confirmPassword);
        await this.fillOtp(otp);
        await this.clickChange();
        return this.readMessage(this.newPasswordSameAsOldMsg, 'Read "new password same as old" message', expected);
    }

    // ─── TC-CP-29 — no click; this message renders live as soon as the OTP field is filled. ─

    async getOtpLengthExceededMessage(otp: string, expected?: string): Promise<string> {
        await this.fillOtp(otp);
        return this.readMessage(this.otpLengthExceededMsg, 'Read "OTP length exceeded" message', expected);
    }

    // ─── TC-CP-30 ─────────────────────────────────────────────────────────────────

    async closeModal(): Promise<void> {
        const closed = await this.closeModalButton.click({ timeout: 5000 }).then(() => true).catch(() => false);
        this.logStep('Closed the Change Password modal', 'modal closes (or was already closed)', closed ? 'closed' : 'no modal was open');
    }

    async isChangeButtonVisible(): Promise<boolean> {
        const isVisible = await this.pageHeading.isVisible();
        this.logStep('Checked Change Password page heading', 'visible', isVisible ? 'visible' : 'not visible');
        return isVisible;
    }
}
