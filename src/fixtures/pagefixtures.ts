import { test as baseTest } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { LoginPageValidation } from '../pages/LoginPageValidation';
import { CsvHelper } from '../utils/CsvHelper';
import { OtpPageValidation } from '../pages/OtpPageValidation';
import { PortfolioOverviewPage } from '../pages/portfolio/overview';
import { PortfolioSpotPage } from '../pages/portfolio/spot';
import { PortfolioFundingPage } from '../pages/portfolio/funding';
import { PortfolioGridPage } from '../pages/portfolio/grid';
import { PortfolioCopyPage } from '../pages/portfolio/copy';
import { CoinDetailPage } from '../pages/portfolio/coinDetail';
import { HomePage } from '../pages/HomePage';
import { ChangePasswordPage } from '../pages/ChangePasswordPage';
import { ChangePasswordValidationPage } from '../pages/ChangePasswordValidationPage';

//define types for page fixtures:
type pageFixtures = {
    loginPage: LoginPage,
    loginPageValidation: LoginPageValidation,
    testData: Record<string, string>[],
    otpPageValidation: OtpPageValidation,
    portfolioPage: PortfolioOverviewPage,
    portfolioSpotPage: PortfolioSpotPage,
    portfolioFundingPage: PortfolioFundingPage,
    portfolioGridPage: PortfolioGridPage,
    portfolioCopyPage: PortfolioCopyPage,
    coinDetailPage: CoinDetailPage,
    homePage: HomePage,
    changePasswordPage: ChangePasswordPage,
    changePasswordValidationPage: ChangePasswordValidationPage
};

//extend playwright base test:
export let test = baseTest.extend<pageFixtures>({

    loginPage: async ({ page }, use) => {
        let loginPage = new LoginPage(page);
        await use(loginPage);
    },

     loginPageValidation: async ({ page }, use) => {
        let loginPageValidation = new LoginPageValidation(page);
        await use(loginPageValidation);
    },

    otpPageValidation: async ({ page }, use) => {
        let otpPageValidation = new OtpPageValidation(page);
        await use(otpPageValidation);
    },

    testData: async ({ }, use) => {
        let testData = CsvHelper.readCsv('src/data/loginData.csv');
        await use(testData);
    },

    portfolioPage: async ({ page }, use) => {
        let portfolioPage = new PortfolioOverviewPage(page);
        await use(portfolioPage);
    },

    portfolioSpotPage: async ({ page }, use) => {
        let portfolioSpotPage = new PortfolioSpotPage(page);
        await use(portfolioSpotPage);
    },

    portfolioFundingPage: async ({ page }, use) => {
        let portfolioFundingPage = new PortfolioFundingPage(page);
        await use(portfolioFundingPage);
    },

    portfolioGridPage: async ({ page }, use) => {
        let portfolioGridPage = new PortfolioGridPage(page);
        await use(portfolioGridPage);
    },

    portfolioCopyPage: async ({ page }, use) => {
        let portfolioCopyPage = new PortfolioCopyPage(page);
        await use(portfolioCopyPage);
    },

    coinDetailPage: async ({ page }, use) => {
        let coinDetailPage = new CoinDetailPage(page);
        await use(coinDetailPage);
    },

    homePage: async ({ page }, use) => {
        let homePage = new HomePage(page);
        await use(homePage);
    },

    changePasswordPage: async ({ page }, use) => {
        let changePasswordPage = new ChangePasswordPage(page);
        await use(changePasswordPage);
    },

    changePasswordValidationPage: async ({ page }, use) => {
        let changePasswordValidationPage = new ChangePasswordValidationPage(page);
        await use(changePasswordValidationPage);
    }

});

export { expect } from '@playwright/test';
