import { test, expect } from '../src/fixtures/pagefixtures';

test.beforeEach(async ({ loginPage }) => {
    await loginPage.goToLoginPage();
});

test('login page title test @sanity', async ({ loginPage }) => {
    const pageTitle = await loginPage.getLoginPageTitle();
    console.log('login page title:', pageTitle);
    expect(await loginPage.isLogoVisible()).toBeTruthy();
    expect(pageTitle).toBe('KNOOZ');
    expect(await loginPage.isForgotPasswordLinkExist()).toBeTruthy();
});

test('login test @smoke @sanity', async({ loginPage }) => {
    await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!);
    let isUserOnHomePage = await loginPage.isUserOnHomePage();
    expect(isUserOnHomePage).toBeTruthy();
});

// DD_1: sequence mode -- only 1 test is running with test data one by one using testData from fixtures
// test('login to app using wrong credentials with Data driven test', async ({ loginPage, testData }) => {
//     for(let row of testData) {
//         console.log(`Testing with data: ${JSON.stringify(row)}`);
//         await loginPage.doLogin(row.email, row.password, row.otp);
//         const isErrorDisplayed = await loginPage.isInvalidLoginErrorDisplayed();
//         expect(isErrorDisplayed).toBeTruthy();
//     }

// });

//DD_2: without fixtures, parallel mode -- read csv data directly and loop the test method row wise....
// let testData = CsvHelper.readCsv('src/data/loginData.csv');
//     for(let row of testData) {
//         test(`invalid login test with - ${row.email} - ${row.password} -${row.otp}`, async ({ loginPage }) => {
//             await loginPage.doLogin(row.email, row.password, row.otp);
//             expect(await loginPage.isInvalidLoginErrorDisplayed()).toBeTruthy();
//         });
//  };

//  let loginTestData = ExcelHelper.readExcel('src/data/loginData.xlsx', 'LoginData');
//     for(let row of loginTestData) {
//         test(`invalid login test with excel data - ${row.email} - ${row.password}`, async ({ loginPage }) => {
//             await loginPage.doLogin(row.email, row.password);
//             expect(await loginPage.isInvalidLoginErrorDisplayed()).toBeTruthy();
//         });
//  };

//  let loginJSONData = JsonHelper.readJson('src/data/loginData.json');
//     for(let row of loginJSONData) {
//         test(`invalid login test with JSON data - ${row.email} - ${row.password}`, async ({ loginPage }) => {
//             await loginPage.doLogin(row.email, row.password);
//             expect(await loginPage.isInvalidLoginErrorDisplayed()).toBeTruthy();
//         });
//  };