# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: otppagevalidation.spec.ts >> OTP Page Validation >> continue without OTP - Click Continue without requesting OTP code @sanity @regression
- Location: tests/otppagevalidation.spec.ts:42:9

# Error details

```
TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByText('Get OTP', { exact: true }) to be visible

```

# Test source

```ts
  1   | import type { Locator, Page } from '@playwright/test';
  2   | import { BasePage } from './BasePage';
  3   | 
  4   | export class OtpPageValidation extends BasePage {
  5   | 
  6   |     //private locators (declared in the order the scenarios below use them):
  7   |     private readonly emailInput: Locator;
  8   |     private readonly passwordInput: Locator;
  9   |     private readonly continueButton: Locator;
  10  |     private readonly getOtpButton: Locator;
  11  |     private readonly getVerificationCodeValidation: Locator;
  12  |     private readonly otpSentSuccessfullyMessage: Locator;
  13  |     private readonly otpRequiredValidation: Locator;
  14  |     private readonly pleaseEnterCodeValidation: Locator;
  15  |     private readonly codeInput: Locator;
  16  |     private readonly enterValidEmailOtpErrorMessage: Locator;
  17  |     private readonly maxOtpLimitValidation: Locator;
  18  |     private readonly mustBeOnlyDigitsValidation: Locator;
  19  |     private readonly resendOtpButton: Locator;
  20  |     private readonly resendOtpTimer: Locator;
  21  |     private readonly otpResentSuccessfullyMessage: Locator;
  22  |     private readonly cancelSigningInLink: Locator;
  23  | 
  24  |     private otpAlreadyRequested = false;
  25  | 
  26  |     constructor(page: Page) {
  27  |         super(page);
  28  |         this.emailInput = page.getByRole('textbox', { name: 'Email' });
  29  |         this.passwordInput = page.getByRole('textbox', { name: 'Password' });
  30  |         this.continueButton = page.getByRole('button', { name: 'Continue' });
  31  |         this.getOtpButton = page.getByText('Get OTP', { exact: true });
  32  |         this.getVerificationCodeValidation = page.getByText('Please get a verification code first', { exact: true });
  33  |         this.otpSentSuccessfullyMessage = page.locator(`span:has-text("OTP sent successfully")`);
  34  |         this.otpRequiredValidation = page.getByText('OTP is required', { exact: true });
  35  |         this.pleaseEnterCodeValidation = page.getByText('Please enter code', { exact: true });
  36  |         this.codeInput = page.getByRole('textbox', { name: 'Enter code' });
  37  |         this.enterValidEmailOtpErrorMessage = page.locator(`span:has-text("Please enter valid email OTP")`);
  38  |         this.maxOtpLimitValidation = page.locator('.errorCls');
  39  |         this.mustBeOnlyDigitsValidation = page.getByText('Must be only digits', { exact: true });
  40  |         this.resendOtpButton = page.getByText('Resend OTP', { exact: true }).last();
  41  |         this.resendOtpTimer = page.locator('text=/Resend OTP in \d+s/');
  42  |         this.otpResentSuccessfullyMessage = page.locator(`span:has-text("OTP resent successfully")`);
  43  |         this.cancelSigningInLink = page.getByRole('link', { name: 'Cancel Signing In' });
  44  |     }
  45  | 
  46  |     // Standard 3-line trace for every step: what we did, what we expected, what we got — so the
  47  |     // HTML report's console output shows exactly what happened without needing to re-run headed.
  48  |     private logStep(step: string, expected: string, actual: string): void {
  49  |         console.log(
  50  |             `[OtpPageValidation] Step     : ${step}\n` +
  51  |             `[OtpPageValidation] Expected : ${expected}\n` +
  52  |             `[OtpPageValidation] Actual   : ${actual}`
  53  |         );
  54  |     }
  55  | 
  56  |     //public page actions(methods)/behaviors, in the order the spec file's scenarios run them:
  57  | 
  58  |     async getOtpPage(email: string, password: string): Promise<void> {
  59  |         console.log(`user creds: ${email} : ${password}`);
  60  |         await this.emailInput.fill(email);
  61  |         await this.passwordInput.fill(password);
  62  |         await this.continueButton.click();
> 63  |         await this.getOtpButton.waitFor({ state: 'visible', timeout: 10000 });
      |                                 ^ TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
  64  |         this.logStep(
  65  |             'Filled email + password and clicked Continue',
  66  |             '"Get OTP" button visible — OTP entry screen reached',
  67  |             'OTP entry screen reached',
  68  |         );
  69  |     }
  70  | 
  71  |     // Scenario 1: click Continue without requesting OTP → "Please get a verification code first"
  72  |     async getOtpVerificationCode(): Promise<string | null> {
  73  |         await this.continueButton.click();
  74  |         await this.getVerificationCodeValidation.waitFor({ state: 'visible', timeout: 5000 });
  75  |         const message = await this.getVerificationCodeValidation.textContent();
  76  |         this.logStep(
  77  |             'Clicked Continue without requesting an OTP',
  78  |             'validation message: "Please get a verification code first"',
  79  |             `validation message: "${message}"`,
  80  |         );
  81  |         return message;
  82  |     }
  83  | 
  84  |     // The one designated place in the whole suite that actually requests a fresh OTP — every later
  85  |     // scenario reuses this same session (see requestOtpAndVerify's otpAlreadyRequested guard below),
  86  |     // so the account only takes one real "Get OTP" hit per full run instead of one per scenario.
  87  |     async getOtpSentSuccessfullyMessage(): Promise<string | null> {
  88  |         await this.getOtpButton.click();
  89  |         await this.page.waitForTimeout(2000);
  90  |         await this.otpSentSuccessfullyMessage.waitFor({ state: 'visible', timeout: 5000 });
  91  |         const message = await this.otpSentSuccessfullyMessage.textContent();
  92  |         this.otpAlreadyRequested = true;
  93  |         this.logStep(
  94  |             'Clicked "Get OTP" for the first time this run',
  95  |             'validation message: "OTP sent successfully"',
  96  |             `validation message: "${message}"`,
  97  |         );
  98  |         return message;
  99  |     }
  100 | 
  101 |     // Scenario 2: click Get OTP → fill OTP → clear → click Continue → "OTP is required"
  102 |     // Requests OTP only if not already active — reuses a session an earlier scenario started.
  103 |     async getOtpRequiredValidation(otpValue: string): Promise<string | null> {
  104 |         await this.requestOtpAndVerify();
  105 |         await this.continueButton.click();
  106 |         await this.otpRequiredValidation.waitFor({ state: 'visible', timeout: 5000 });
  107 |         const message = await this.otpRequiredValidation.textContent();
  108 |         this.logStep(
  109 |             'Left the code field empty and clicked Continue',
  110 |             'validation message: "OTP is required"',
  111 |             `validation message: "${message}"`,
  112 |         );
  113 |         return message;
  114 |     }
  115 | 
  116 |     // Scenario 3: click Get OTP → fill OTP (e.g. "1234") → click Continue → "Please enter valid email OTP"
  117 |     // Requests OTP only if not already active — reuses a session an earlier scenario started.
  118 |     async getPleaseEnterValidEmailOtpErrorMessage(otpValue: string): Promise<string | null> {
  119 |         await this.requestOtpAndVerify();
  120 |         await this.codeInput.fill(otpValue);
  121 |         await this.continueButton.click();
  122 |         const results = await Promise.allSettled([
  123 |             this.enterValidEmailOtpErrorMessage.textContent({ timeout: 6000 }),
  124 |             this.getVerificationCodeValidation.textContent({ timeout: 6000 }),
  125 |         ]);
  126 |         const message = results[0].status === 'fulfilled'
  127 |             ? results[0].value
  128 |             : results[1].status === 'fulfilled'
  129 |                 ? results[1].value
  130 |                 : null;
  131 | 
  132 |         this.logStep(
  133 |             `Entered code "${otpValue}", clicked Continue`,
  134 |             'validation message: "Please enter valid email OTP"',
  135 |             `validation message: "${message}"`,
  136 |         );
  137 | 
  138 |         // No "Get OTP" recovery here on purpose: this scenario already reuses the session from
  139 |         // "OTP sent successfully", and re-requesting after it just burned 2 wasted attempts every
  140 |         // run (confirmed live: both always came back "did not register (possible rate limit)"),
  141 |         // pushing the account closer to a real rate limit for no benefit — the scenarios after this
  142 |         // one (max OTP limit, must be only digits) only need the existing session to still be active,
  143 |         // not a fresh one.
  144 |         return message;
  145 |     }
  146 | 
  147 |     // Scenario 4: fill OTP with >5 digits → "Max OTP limit should be 5 digits."
  148 |     // Requests OTP only if not already active — reuses a session an earlier scenario started.
  149 |     async getMaxOtpLimitValidation(otpValue: string): Promise<string | null> {
  150 |         await this.requestOtpAndVerify();
  151 |         await this.codeInput.fill(otpValue);
  152 |         await this.continueButton.click();
  153 |         await this.maxOtpLimitValidation.waitFor({ state: 'visible', timeout: 5000 });
  154 |         const message = await this.maxOtpLimitValidation.textContent();
  155 |         this.logStep(
  156 |             `Entered ${otpValue.length}-digit code "${otpValue}", clicked Continue`,
  157 |             'validation message: "Max OTP limit should be 5 digits."',
  158 |             `validation message: "${message}"`,
  159 |         );
  160 |         return message;
  161 |     }
  162 | 
  163 |     // Scenario 5: fill OTP with non-digit characters → "Must be only digits"
```