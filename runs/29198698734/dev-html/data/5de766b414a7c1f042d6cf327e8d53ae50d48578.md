# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: loginpagevalidation.spec.ts >> invalid email - abc@-example.com @regression
- Location: tests/loginpagevalidation.spec.ts:19:5

# Error details

```
Error: Email "abc@-example.com" was accepted as valid — no validation message was shown (expected: "Please enter valid email")

expect(received).toBe(expected) // Object.is equality

Expected: "Please enter valid email"
Received: null
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e7]:
    - img "img" [ref=e8] [cursor=pointer]
    - heading "Sign in to Knooz" [level=2] [ref=e9]
    - paragraph [ref=e10]: Not your device? Use a private or incognito window to sign in.
    - generic [ref=e11]:
      - generic [ref=e13]:
        - tablist [ref=e14]:
          - generic [ref=e16]:
            - tab "Email" [selected] [ref=e18] [cursor=pointer]
            - tab "Phone number" [ref=e20] [cursor=pointer]
        - tabpanel "Email" [ref=e23]:
          - generic [ref=e25]:
            - generic [ref=e27]: Email*
            - textbox "Email" [ref=e28]: abc@-example.com
      - generic [ref=e29]:
        - generic [ref=e30]:
          - generic [ref=e32]: Password*
          - generic [ref=e33]:
            - textbox "Password" [ref=e34]
            - img "eye-invisible" [ref=e36] [cursor=pointer]:
              - img [ref=e37]
        - text: Password is required
      - link "Forgot Password?" [ref=e40] [cursor=pointer]:
        - /url: /resetPassword
      - generic [ref=e41]:
        - button "Continue" [active] [ref=e42] [cursor=pointer]:
          - generic [ref=e43]: Continue
        - button "Create an account" [ref=e44] [cursor=pointer]:
          - generic [ref=e45]: Create an account
    - link "Privacy policy" [ref=e46] [cursor=pointer]:
      - /url: /privacyPolicy
      - paragraph [ref=e47]: Privacy policy
  - img
```

# Test source

```ts
  1  | import { test, expect } from '../src/fixtures/pagefixtures';
  2  | import { CsvHelper } from '../src/utils/CsvHelper';
  3  | 
  4  | test.beforeEach(async ({ loginPage }) => {
  5  |     await loginPage.goToLoginPage();
  6  | });
  7  | 
  8  | test('invalid login test with empty email @sanity @regression', async ({ loginPageValidation }) => {
  9  |     expect(await loginPageValidation.getEmptyEmailValidationMessage()).toBe('Email is required');
  10 | });
  11 | 
  12 | test('invalid login test with empty password @sanity @regression', async ({ loginPageValidation }) => {
  13 |     expect(await loginPageValidation.getEmptyPasswordValidationMessage()).toBe('Password is required');
  14 | });
  15 | 
  16 | const allValidationData = CsvHelper.readCsv('src/data/loginValidationData.csv');
  17 | 
  18 | for (let row of allValidationData.filter(r => r.scenario === 'invalid_email')) {
  19 |     test(`invalid email - ${row.email} @regression`, async ({ loginPageValidation }) => {
  20 |         await loginPageValidation.getInvalidEmailValidation(row.email);
  21 |         const message = await loginPageValidation.getInvalidEmailValidationMessage(row.expectedError);
  22 |         const failureReason = message === null
  23 |             ? `Email "${row.email}" was accepted as valid — no validation message was shown (expected: "${row.expectedError}")`
  24 |             : `Email "${row.email}" — validation message text does not match (expected: "${row.expectedError}", received: "${message}")`;
> 25 |         expect(message, failureReason).toBe(row.expectedError);
     |                                        ^ Error: Email "abc@-example.com" was accepted as valid — no validation message was shown (expected: "Please enter valid email")
  26 |     });
  27 | }
  28 | 
  29 | test('invalid password - all attempts lockout flow @regression', async ({ loginPageValidation }) => {
  30 |     for (let row of allValidationData.filter(r => r.scenario === 'invalid_password')) {
  31 |         await loginPageValidation.doLogin(row.email, row.password);
  32 |         expect.soft(await loginPageValidation.getLoginErrorMessage(row.expectedError)).toBe(row.expectedError);
  33 |     }
  34 | });
  35 | 
  36 | for (let row of allValidationData.filter(r => r.scenario === 'both_wrong')) {
  37 |     test(`both wrong - ${row.email} - ${row.password} @regression`, async ({ loginPageValidation }) => {
  38 |         await loginPageValidation.doLogin(row.email, row.password);
  39 |         expect(await loginPageValidation.getLoginErrorMessage(row.expectedError)).toBe(row.expectedError);
  40 |     });
  41 | }
  42 | 
```