import { test, expect } from '../src/fixtures/pagefixtures';
import { LoginPage } from '../src/pages/LoginPage';
import { ChangePasswordPage } from '../src/pages/ChangePasswordPage';
import { CsvHelper } from '../src/utils/CsvHelper';
import type { Browser, BrowserContext, Page } from '@playwright/test';

// Positive flow only — the exhaustive validation scenarios (TC-CP-01 through TC-CP-30) live in
// tests/changepasswordvalidation.spec.ts against ChangePasswordValidationPage. This file covers
// the single happy path: change password successfully, get logged out, log back in with the new
// password.
const changePasswordData = CsvHelper.readCsv('src/data/changePasswordData.csv');

function scenario(name: string): Record<string, string> {
    const row = changePasswordData.find(r => r.scenario === name);
    if (!row) throw new Error(`No row found in changePasswordData.csv for scenario "${name}"`);
    return row;
}

// The account's REAL current password isn't committed to the CSV — the row marks where it
// belongs with this token, resolved from the same PASSWORD env var every other spec logs in with.
function withAccountPassword(value: string): string {
    return value === '{{ACCOUNT_PASSWORD}}' ? process.env.PASSWORD! : value;
}

function withAccountOtp(value: string): string {
    return value === '{{ACCOUNT_OTP}}' ? process.env.OTP! : value;
}

let browser:            Browser;
let context:            BrowserContext;
let page:                Page;
let loginPage:           LoginPage;
let changePasswordPage:  ChangePasswordPage;

// serial + a single shared session: TC-CPS-02 needs the redirect TC-CPS-01's own submit
// triggers, and TC-CPS-03 needs to log in on the same page right after that redirect — none of
// these three steps are independently reproducible on a fresh page.
test.describe('Change Password — successful change', () => {
    test.describe.configure({ mode: 'serial', timeout: 70000 });

    test.beforeAll(async ({ playwright }, testInfo) => {
        browser           = await playwright.chromium.launch({ headless: testInfo.project.use.headless });
        context           = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: process.env.BASE_URL });
        page              = await context.newPage();
        loginPage         = new LoginPage(page);
        changePasswordPage = new ChangePasswordPage(page);

        const row = scenario('password_changed_successfully');
        await loginPage.goToLoginPage();
        await loginPage.doLogin(process.env.EMAIL!, withAccountPassword(row.oldPassword), process.env.OTP!);
        await changePasswordPage.navigateToChangePassword();
    });

    test.afterAll(async () => { await browser.close(); });

    // ─── TC-CPS-01 ────────────────────────────────────────────────────────────────
    test('TC-CPS-01: Password change succeeds and shows the success message @regression', async () => {
        const row = scenario('password_changed_successfully');
        const message = await changePasswordPage.changePasswordSuccessfully(
            withAccountPassword(row.oldPassword), row.newPassword, row.confirmPassword, withAccountOtp(row.otp), row.successMessage,
        );
        expect(message, `TC-CPS-01: Success message should read "${row.successMessage}"`).toBe(row.successMessage);
    });

    // ─── TC-CPS-02 ────────────────────────────────────────────────────────────────
    test('TC-CPS-02: Session is redirected to the login page after the password change @regression', async () => {
        await changePasswordPage.waitForRedirectToLogin();
        expect(page.url(), 'TC-CPS-02: User should be redirected to the login page after changing the password').toContain('/login');
    });

    // ─── TC-CPS-03 ────────────────────────────────────────────────────────────────
    test('TC-CPS-03: User logs in successfully with the new password @regression', async () => {
        const row = scenario('password_changed_successfully');
        await loginPage.doLogin(process.env.EMAIL!, row.newPassword, process.env.OTP!);
        expect(await loginPage.isUserOnHomePage(), 'TC-CPS-03: User should be able to log in successfully with the new password').toBe(true);
    });
});
