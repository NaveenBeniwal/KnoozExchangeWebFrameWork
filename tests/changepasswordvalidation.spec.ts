import { test, expect } from '../src/fixtures/pagefixtures';
import { LoginPage } from '../src/pages/LoginPage';
import { ChangePasswordValidationPage } from '../src/pages/ChangePasswordValidationPage';
import { CsvHelper } from '../src/utils/CsvHelper';
import type { Browser, BrowserContext, Page } from '@playwright/test';

// Every row here becomes one scenario below — add or remove a row and adjust the matching
// test, no other code changes needed. Values are looked up by `scenario`, not by row order.
const changePasswordData = CsvHelper.readCsv('src/data/changePasswordValidationData.csv');

function scenario(name: string): Record<string, string> {
    const row = changePasswordData.find(r => r.scenario === name);
    if (!row) throw new Error(`No row found in changePasswordValidationData.csv for scenario "${name}"`);
    return row;
}

// Static page copy (heading, notices, field labels/placeholders) — a separate CSV from the
// validation scenarios above since these aren't triggered by filling fields, they're just
// content checks.
const changePasswordUIText = CsvHelper.readCsv('src/data/changePasswordValidationUIText.csv');

function uiText(element: string): string {
    const row = changePasswordUIText.find(r => r.element === element);
    if (!row) throw new Error(`No row found in changePasswordValidationUIText.csv for element "${element}"`);
    return row.expectedText;
}

// A few scenarios need the account's REAL current password (to prove "old password correct" or
// "new password same as old"). That's a secret — it isn't in the CSV, it comes from the same
// PASSWORD env var every other spec in this suite already logs in with. The CSV just marks
// where it belongs with this token.
function withAccountPassword(value: string): string {
    return value === '{{ACCOUNT_PASSWORD}}' ? process.env.PASSWORD! : value;
}

// Staging uses a fixed, non-expiring OTP for this account (the same one every other spec in
// this suite logs in with) — scenarios that need a genuinely-valid OTP to reach the backend
// check they're actually testing use this token instead of hardcoding "12345" in the CSV.
function withAccountOtp(value: string): string {
    return value === '{{ACCOUNT_OTP}}' ? process.env.OTP! : value;
}

let browser:             Browser;
let context:             BrowserContext;
let page:                Page;
let loginPage:           LoginPage;
let changePasswordPage:  ChangePasswordValidationPage;

// serial + a single shared session: the OTP-related scenarios below (send/resend/already-used/
// rate-limit) are inherently stateful — they exercise a real cooldown and request-limit on one
// account, not something a fresh independent page per test could reproduce.
//
// All 30 tests below are numbered TC-CP-01 through TC-CP-30 in a single continuous sequence that
// matches their actual run order, one page-object call per test (no test bundles more than one
// independent check) — if TC-CP-14 fails, it ran right after TC-CP-13 and before TC-CP-15, no
// separate numbering scheme to keep track of.
test.describe('Change Password Validations', () => {
    test.describe.configure({ mode: 'serial', timeout: 70000 });

    test.beforeAll(async ({ playwright }, testInfo) => {
        browser            = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context            = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
        page               = await context.newPage();
        loginPage          = new LoginPage(page);
        changePasswordPage = new ChangePasswordValidationPage(page);

        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!);
        await changePasswordPage.navigateToChangePassword();
    });

    test.afterAll(async () => { await browser.close(); });

    // ─── TC-CP-01 through TC-CP-15 ───────────────────────────────────────────────
    // Static structure/content checks — none of these fill fields or consume OTP-request quota,
    // so they run first, before any of the stateful OTP flow below touches the form.
    test('TC-CP-01: Change Password heading is correct @smoke @sanity', async () => {
        const expected = uiText('heading');
        const actual = await changePasswordPage.getHeadingText(expected);
        expect(actual, `TC-CP-01: Heading should read "${expected}"`).toBe(expected);
    });

    test('TC-CP-02: "Choose a new password" text is correct', async () => {
        const expected = uiText('chooseNewPasswordText');
        const actual = await changePasswordPage.getChooseNewPasswordText(expected);
        expect(actual, `TC-CP-02: Text should read "${expected}"`).toBe(expected);
    });

    test('TC-CP-03: Withdrawal-restriction notice is correct', async () => {
        const expected = uiText('withdrawalRestrictionText');
        const actual = await changePasswordPage.getWithdrawalRestrictionText(expected);
        expect(actual, `TC-CP-03: Withdrawal-restriction notice should read "${expected}"`).toBe(expected);
    });

    test('TC-CP-04: Relogin-required notice is correct', async () => {
        const expected = uiText('reloginRequiredText');
        const actual = await changePasswordPage.getReloginRequiredText(expected);
        expect(actual, `TC-CP-04: Relogin-required notice should read "${expected}"`).toBe(expected);
    });

    test('TC-CP-05: Old Password field label shows the required asterisk', async () => {
        const expected = uiText('oldPasswordLabel');
        const actual = await changePasswordPage.getOldPasswordLabelText(expected);
        expect(actual, `TC-CP-05: Old Password label should read "${expected}"`).toBe(expected);
    });

    test('TC-CP-06: New Password field label shows the required asterisk', async () => {
        const expected = uiText('newPasswordLabel');
        const actual = await changePasswordPage.getNewPasswordLabelText(expected);
        expect(actual, `TC-CP-06: New Password label should read "${expected}"`).toBe(expected);
    });

    test('TC-CP-07: Confirm Password field label shows the required asterisk', async () => {
        const expected = uiText('confirmPasswordLabel');
        const actual = await changePasswordPage.getConfirmPasswordLabelText(expected);
        expect(actual, `TC-CP-07: Confirm Password label should read "${expected}"`).toBe(expected);
    });

    test('TC-CP-08: Enter email OTP field label shows the required asterisk', async () => {
        const expected = uiText('otpLabel');
        const actual = await changePasswordPage.getOtpLabelText(expected);
        expect(actual, `TC-CP-08: Enter email OTP label should read "${expected}"`).toBe(expected);
    });

    test('TC-CP-09: Old Password field placeholder is correct', async () => {
        const expected = uiText('oldPasswordPlaceholder');
        const actual = await changePasswordPage.getOldPasswordPlaceholder(expected);
        expect(actual, `TC-CP-09: Placeholder should read "${expected}"`).toBe(expected);
    });

    // The fill/click sequence lives entirely in runOldPasswordMaskCycle() on the page object;
    // this test only asserts on the result it returns.
    test('TC-CP-10: Old Password field eye-icon mask/reveal cycle', async () => {
        const value = 'Test@123';
        const cycle = await changePasswordPage.runOldPasswordMaskCycle(value);
        expect.soft(cycle.maskedByDefault, 'TC-CP-10: Old Password should be masked by default').toBe(true);
        expect.soft(cycle.maskedAfterFirstClick, 'TC-CP-10: Old Password should be revealed after clicking the eye icon').toBe(false);
        expect.soft(cycle.valueWhileRevealed, `TC-CP-10: Revealed value should still be "${value}"`).toBe(value);
        expect.soft(cycle.maskedAfterSecondClick, 'TC-CP-10: Old Password should be masked again after clicking the eye icon a second time').toBe(true);
    });

    test('TC-CP-11: New Password field placeholder is correct', async () => {
        const expected = uiText('newPasswordPlaceholder');
        const actual = await changePasswordPage.getNewPasswordPlaceholder(expected);
        expect(actual, `TC-CP-11: Placeholder should read "${expected}"`).toBe(expected);
    });

    test('TC-CP-12: New Password field eye-icon mask/reveal cycle', async () => {
        const value = 'Test@123';
        const cycle = await changePasswordPage.runNewPasswordMaskCycle(value);
        expect.soft(cycle.maskedByDefault, 'TC-CP-12: New Password should be masked by default').toBe(true);
        expect.soft(cycle.maskedAfterFirstClick, 'TC-CP-12: New Password should be revealed after clicking the eye icon').toBe(false);
        expect.soft(cycle.valueWhileRevealed, `TC-CP-12: Revealed value should still be "${value}"`).toBe(value);
        expect.soft(cycle.maskedAfterSecondClick, 'TC-CP-12: New Password should be masked again after clicking the eye icon a second time').toBe(true);
    });

    test('TC-CP-13: Confirm Password field placeholder is correct', async () => {
        const expected = uiText('confirmPasswordPlaceholder');
        const actual = await changePasswordPage.getConfirmPasswordPlaceholder(expected);
        expect(actual, `TC-CP-13: Placeholder should read "${expected}"`).toBe(expected);
    });

    test('TC-CP-14: Confirm Password field eye-icon mask/reveal cycle', async () => {
        const value = 'Test@123';
        const cycle = await changePasswordPage.runConfirmPasswordMaskCycle(value);
        expect.soft(cycle.maskedByDefault, 'TC-CP-14: Confirm Password should be masked by default').toBe(true);
        expect.soft(cycle.maskedAfterFirstClick, 'TC-CP-14: Confirm Password should be revealed after clicking the eye icon').toBe(false);
        expect.soft(cycle.valueWhileRevealed, `TC-CP-14: Revealed value should still be "${value}"`).toBe(value);
        expect.soft(cycle.maskedAfterSecondClick, 'TC-CP-14: Confirm Password should be masked again after clicking the eye icon a second time').toBe(true);
    });

    test('TC-CP-15: "Get OTP" button text is correct', async () => {
        const expected = uiText('getOtpButtonText');
        const actual = await changePasswordPage.getGetOtpButtonText(expected);
        expect(actual, `TC-CP-15: "Get OTP" button text should read "${expected}"`).toBe(expected);
    });

    // ─── TC-CP-16 through TC-CP-19 ───────────────────────────────────────────────
    // AntD shows all four "required" messages together after one submit on an all-blank form —
    // each composite method clears the form and submits itself, so any one of these can run
    // alone and still pass.
    test('TC-CP-16: Old Password required validation', async () => {
        const row = scenario('old_password_required');
        const message = await changePasswordPage.getOldPasswordRequiredMessage(row.expectedMessage);
        expect(message, `TC-CP-16: Old Password required message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    test('TC-CP-17: New Password required validation', async () => {
        const row = scenario('new_password_required');
        const message = await changePasswordPage.getNewPasswordRequiredMessage(row.expectedMessage);
        expect(message, `TC-CP-17: New Password required message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    test('TC-CP-18: Confirm Password required validation', async () => {
        const row = scenario('confirm_password_required');
        const message = await changePasswordPage.getConfirmPasswordRequiredMessage(row.expectedMessage);
        expect(message, `TC-CP-18: Confirm Password required message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    // Same underlying message/locator as TC-CP-22 — confirmed live there's no separate "OTP is
    // required." state; a blank OTP field on submit shows the same "get verification code
    // first" message as submitting with an OTP that was never actually requested.
    test('TC-CP-19: OTP required validation', async () => {
        const row = scenario('otp_required');
        const message = await changePasswordPage.getOtpRequiredMessage(row.expectedMessage);
        expect(message, `TC-CP-19: OTP required message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    // ─── TC-CP-20 ────────────────────────────────────────────────────────────────
    test('TC-CP-20: New Password criteria validation', async () => {
        const row = scenario('password_criteria');
        const message = await changePasswordPage.getPasswordCriteriaMessage(row.oldPassword, row.newPassword, row.confirmPassword, row.expectedMessage);
        expect(message, `TC-CP-20: Password-criteria message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    // ─── TC-CP-21 ────────────────────────────────────────────────────────────────
    test('TC-CP-21: Confirm Password mismatch validation', async () => {
        const row = scenario('confirm_password_mismatch');
        const message = await changePasswordPage.getConfirmPasswordMismatchMessage(row.newPassword, row.confirmPassword, row.expectedMessage);
        expect(message, `TC-CP-21: Confirm-password-mismatch message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    // ─── TC-CP-22 ────────────────────────────────────────────────────────────────
    // This scenario needs a session where Get OTP has genuinely never been clicked, so it runs
    // before any other test below that calls Get OTP.
    test('TC-CP-22: OTP not requested error validation', async () => {
        const row = scenario('otp_not_requested');
        const message = await changePasswordPage.getOtpNotRequestedMessage(
            withAccountPassword(row.oldPassword), row.newPassword, row.confirmPassword, row.otp, row.expectedMessage,
        );
        expect(message, `TC-CP-22: "Get verification code first" message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    // ─── TC-CP-23 ────────────────────────────────────────────────────────────────
    // Sending an OTP is rate-limited server-side — if this suite has run recently against the
    // same account, this may need a cooldown too. Also verifies the ~60s cooldown on this same
    // click (rather than a separate Get OTP click elsewhere) so this test doesn't burn extra
    // OTP-request quota that TC-CP-26 relies on.
    test('TC-CP-23: OTP sent successfully, then a ~60s cooldown before Get OTP is clickable again', async () => {
        test.setTimeout(90000); // the cooldown wait alone can take up to 65s
        const row = scenario('otp_sent');
        const message = await changePasswordPage.getOtpSentMessage(row.expectedMessage);
        expect(message, `TC-CP-23: "OTP sent" message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);

        const clearedCooldown = await changePasswordPage.waitForGetOtpCooldownToClear();
        expect(clearedCooldown, 'TC-CP-23: "Get OTP" should become enabled again within ~60s of being clicked').toBe(true);
    });

    // ─── TC-CP-24 ────────────────────────────────────────────────────────────────
    test('TC-CP-24: Incorrect OTP validation', async () => {
        const row = scenario('incorrect_otp');
        const message = await changePasswordPage.getIncorrectOtpMessage(row.otp, row.expectedMessage);
        expect(message, `TC-CP-24: "Incorrect OTP" message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    // ─── TC-CP-25 ────────────────────────────────────────────────────────────────
    test('TC-CP-25: Old Password incorrect validation', async () => {
        const row = scenario('old_password_incorrect');
        const message = await changePasswordPage.getOldPasswordIncorrectMessage(
            row.oldPassword, row.newPassword, row.confirmPassword, withAccountOtp(row.otp), row.expectedMessage,
        );
        expect(message, `TC-CP-25: "Old password incorrect" message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    // ─── TC-CP-26 ────────────────────────────────────────────────────────────────
    // Stateful by nature: reuses the OTP value TC-CP-25 already submitted once earlier in this
    // same serial run, since "already used" can only be shown for an OTP the server has actually
    // seen before.
    test.skip('TC-CP-26: OTP already used validation', async () => {
        const row = scenario('otp_already_used');
        const message = await changePasswordPage.getOtpAlreadyUsedMessage(
            withAccountPassword(row.oldPassword), row.newPassword, row.confirmPassword, withAccountOtp(row.otp), row.expectedMessage,
        );
        expect(message, `TC-CP-26: "OTP already used" message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    // ─── TC-CP-27 ────────────────────────────────────────────────────────────────
    test('TC-CP-27: OTP resent successfully validation', async () => {
        const row = scenario('otp_resent');
        const message = await changePasswordPage.getOtpResentMessage(row.expectedMessage);
        expect(message, `TC-CP-27: "OTP resent" message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    // ─── TC-CP-28 ────────────────────────────────────────────────────────────────
    test('TC-CP-28: New Password same as Old validation', async () => {
        const row = scenario('new_password_same_as_old');
        const message = await changePasswordPage.getNewPasswordSameAsOldMessage(
            withAccountPassword(row.oldPassword), withAccountPassword(row.newPassword), withAccountPassword(row.confirmPassword), withAccountOtp(row.otp), row.expectedMessage,
        );
        expect(message, `TC-CP-28: "New password same as old" message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    // ─── TC-CP-29 ────────────────────────────────────────────────────────────────
    test('TC-CP-29: OTP length exceeded validation', async () => {
        const row = scenario('otp_length_exceeded');
        const message = await changePasswordPage.getOtpLengthExceededMessage(row.otp, row.expectedMessage);
        expect(message, `TC-CP-29: "OTP length exceeded" message should read "${row.expectedMessage}"`).toBe(row.expectedMessage);
    });

    // ─── TC-CP-30 ────────────────────────────────────────────────────────────────
    test('TC-CP-30: Close Change Password modal', async () => {
        await changePasswordPage.closeModal();
        expect(await changePasswordPage.isChangeButtonVisible(), 'TC-CP-30: Change Password page heading should no longer be visible after closing the modal').toBe(false);
    });
});
