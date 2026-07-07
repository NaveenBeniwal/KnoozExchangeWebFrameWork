import { test, expect } from '../src/fixtures/pagefixtures';
import { LoginPage } from '../src/pages/LoginPage';
import { OtpPageValidation } from '../src/pages/OtpPageValidation';
import { CsvHelper } from '../src/utils/CsvHelper';
import type { Browser, BrowserContext, Page } from '@playwright/test';

const email = process.env.EMAIL ?? '';
const password = process.env.PASSWORD ?? '';

const allOtpData = CsvHelper.readCsv('src/data/otpPageValidationData.csv');

let browser:           Browser;
let context:           BrowserContext;
let page:              Page;
let loginPage:         LoginPage;
let otpPageValidation: OtpPageValidation;


test.describe.serial('OTP Page Validation', () => {
    // test.setTimeout() called inside beforeAll only extends that hook's own timeout, not the tests
    // that follow it (confirmed live: scenario 3 hit Playwright's default 30s test timeout even with
    // test.setTimeout(60000) in beforeAll, and the resulting mid-flight abort surfaced as a
    // "page/context/browser has been closed" error rather than an honest timeout). Scenario 3's OTP
    // recovery pass (message-wait + a fresh "Get OTP" request-and-verify) can legitimately approach
    // 30s on its own, so give every test in this file 60s via the documented suite-wide config.
    test.describe.configure({ timeout: 60000 });

    test.beforeAll(async ({ playwright }, testInfo) => {
        browser           = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context           = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
        page              = await context.newPage();
        loginPage         = new LoginPage(page);
        otpPageValidation = new OtpPageValidation(page);
        await loginPage.goToLoginPage();
        await otpPageValidation.getOtpPage(email, password);
    });

    test.afterAll(async () => { await browser.close(); });

    // Scenario 1: click Continue without requesting OTP → "Please get a verification code first"
    for (const row of allOtpData.filter(r => r.scenario === 'continue_without_otp')) {
        test(`continue without OTP - ${row.description}`, async () => {
            expect(await otpPageValidation.getOtpVerificationCode()).toBe(row.expectedMessage);
        });
    }

    // The one designated real "Get OTP" request for the whole run — every scenario after this
    // reuses the same session (see OtpPageValidation's requestOtpAndVerify isVisible guard).
    for (const row of allOtpData.filter(r => r.scenario === 'otp_sent_successfully')) {
        test(`OTP sent successfully - ${row.description}`, async () => {
            expect(await otpPageValidation.getOtpSentSuccessfullyMessage()).toBe(row.expectedMessage);
        });
    }

    // Scenario 2: click Get OTP → fill → clear → Continue → "OTP is required"
    for (const row of allOtpData.filter(r => r.scenario === 'otp_required')) {
        test(`OTP required - ${row.description}`, async () => {
            expect(await otpPageValidation.getOtpRequiredValidation(row.otpValue)).toBe(row.expectedMessage);
        });
    }

    // Scenario 3: click Get OTP → fill invalid OTP → Continue → "Please enter valid email OTP"
    // Note: with .serial(), a failure here (i.e. the known bug above) still skips the remaining
    // scenarios — expect.soft() only avoids throwing inside this test, it doesn't change that. The
    // page object still clicks "Get OTP" again internally afterward regardless of which message
    // showed up, in case a future run reaches this point with the bug already fixed.
    for (const row of allOtpData.filter(r => r.scenario === 'invalid_otp_submission')) {
        test(`invalid OTP submission - ${row.description}`, async () => {
            expect.soft(await otpPageValidation.getPleaseEnterValidEmailOtpErrorMessage(row.otpValue)).toBe(row.expectedMessage);
        });
    }

    // Scenario 4: enter OTP > 5 digits → "Max OTP limit should be 5 digits."
    for (const row of allOtpData.filter(r => r.scenario === 'max_otp_limit')) {
        test(`max OTP limit - ${row.description}`, async () => {
            expect(await otpPageValidation.getMaxOtpLimitValidation(row.otpValue)).toBe(row.expectedMessage);
        });
    }

    // Scenario 5: all must-be-only-digits cases run in a single browser session
    test('must be only digits - all scenarios', async () => {
        for (const row of allOtpData.filter(r => r.scenario === 'must_be_only_digits')) {
            expect.soft(await otpPageValidation.getMustBeOnlyDigitsValidation(row.otpValue)).toBe(row.expectedMessage);
        }
    });

    // Resend OTP: waits out the ~60s cooldown, so it runs last among the OTP-session scenarios —
    // this is a second real OTP request (the resend itself), unavoidable since it's what's tested.
    for (const row of allOtpData.filter(r => r.scenario === 'resend_otp')) {
        test(`Resend OTP - ${row.description}`, async () => {
            test.setTimeout(90000);
            expect(await otpPageValidation.getResendOtpMessage()).toBe(row.expectedMessage);
        });
    }

    // Cancel Signing In: abandons the OTP flow and returns to /login, so this must be the LAST test.
    for (const row of allOtpData.filter(r => r.scenario === 'cancel_signing_in')) {
        test(`Cancel Signing In - ${row.description}`, async () => {
            expect(await otpPageValidation.isCancelSigningInVisible()).toBe(true);
            expect(await otpPageValidation.clickCancelSigningIn()).toBe(row.expectedMessage);
        });
    }

});
