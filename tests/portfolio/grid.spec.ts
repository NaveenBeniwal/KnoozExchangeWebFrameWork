import { test, expect } from '../../src/fixtures/pagefixtures';

test.beforeEach(async ({ loginPage, portfolioGridPage }) => {
    await loginPage.goToLoginPage();
    await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!);
    await portfolioGridPage.goToGridTab();
});

// ─── Grid Tab ─────────────────────────────────────────────────────────────────

test('Grid tab is visible @regression', async ({ portfolioGridPage }) => {
    // Arrange — Grid tab loaded in beforeEach
    // Act
    const isVisible = await portfolioGridPage.isGridTabVisible();
    // Assert
    expect(isVisible).toBe(true);
});

test('Grid total balance is visible @regression', async ({ portfolioGridPage }) => {
    // Arrange — Grid tab loaded in beforeEach
    // Act
    const isVisible = await portfolioGridPage.isGridTotalBalanceVisible();
    // Assert
    expect(isVisible).toBe(true);
});

test('Grid balance contains USDT @regression', async ({ portfolioGridPage }) => {
    // Arrange — Grid tab loaded in beforeEach
    // Act
    const balanceText = await portfolioGridPage.getGridBalanceText();
    // Assert
    expect(balanceText).toContain('USDT');
});

test('Grid position table is visible @regression', async ({ portfolioGridPage }) => {
    // Arrange — Grid tab loaded in beforeEach
    // Act
    const isVisible = await portfolioGridPage.isGridPositionTableVisible();
    // Assert
    expect(isVisible).toBe(true);
});

test('Create Grid button is visible on Grid tab @regression', async ({ portfolioGridPage }) => {
    // Arrange — Grid tab loaded in beforeEach
    // Act
    const isVisible = await portfolioGridPage.isCreateGridButtonVisible();
    // Assert
    expect(isVisible).toBe(true);
});
