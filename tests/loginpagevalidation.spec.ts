import { test, expect } from '../src/fixtures/pagefixtures';
import { CsvHelper } from '../src/utils/CsvHelper';

test.beforeEach(async ({ loginPage }) => {
    await loginPage.goToLoginPage();
});

test('invalid login test with empty email @sanity', async ({ loginPageValidation }) => {
    expect(await loginPageValidation.getEmptyEmailValidationMessage()).toBe('Email is required');
});

test('invalid login test with empty password @sanity', async ({ loginPageValidation }) => {
    expect(await loginPageValidation.getEmptyPasswordValidationMessage()).toBe('Password is required');
});

const allValidationData = CsvHelper.readCsv('src/data/loginValidationData.csv');

for (let row of allValidationData.filter(r => r.scenario === 'invalid_email')) {
    test(`invalid email - ${row.email}`, async ({ loginPageValidation }) => {
        await loginPageValidation.getInvalidEmailValidation(row.email);
        const message = await loginPageValidation.getInvalidEmailValidationMessage(row.expectedError);
        const failureReason = message === null
            ? `Email "${row.email}" was accepted as valid — no validation message was shown (expected: "${row.expectedError}")`
            : `Email "${row.email}" — validation message text does not match (expected: "${row.expectedError}", received: "${message}")`;
        expect(message, failureReason).toBe(row.expectedError);
    });
}

test('invalid password - all attempts lockout flow', async ({ loginPageValidation }) => {
    for (let row of allValidationData.filter(r => r.scenario === 'invalid_password')) {
        await loginPageValidation.doLogin(row.email, row.password);
        expect.soft(await loginPageValidation.getLoginErrorMessage(row.expectedError)).toBe(row.expectedError);
    }
});

for (let row of allValidationData.filter(r => r.scenario === 'both_wrong')) {
    test(`both wrong - ${row.email} - ${row.password}`, async ({ loginPageValidation }) => {
        await loginPageValidation.doLogin(row.email, row.password);
        expect(await loginPageValidation.getLoginErrorMessage(row.expectedError)).toBe(row.expectedError);
    });
}
