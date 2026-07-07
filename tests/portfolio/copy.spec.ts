import { test, expect } from '../../src/fixtures/pagefixtures';

test.beforeEach(async ({ loginPage, portfolioCopyPage }) => {
    await loginPage.goToLoginPage();
    await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!);
    await portfolioCopyPage.goToCopyTab();
});

// ─── Copy Tab ─────────────────────────────────────────────────────────────────

test('Copy tab is visible', async ({ portfolioCopyPage }) => {
    // Arrange — Copy tab loaded in beforeEach
    // Act
    const isVisible = await portfolioCopyPage.isCopyTabVisible();
    // Assert
    expect(isVisible).toBe(true);
});

test('Copy total balance is visible', async ({ portfolioCopyPage }) => {
    // Arrange — Copy tab loaded in beforeEach
    // Act
    const isVisible = await portfolioCopyPage.isCopyTotalBalanceVisible();
    // Assert
    expect(isVisible).toBe(true);
});

test('Copy balance contains USDT', async ({ portfolioCopyPage }) => {
    // Arrange — Copy tab loaded in beforeEach
    // Act
    const balanceText = await portfolioCopyPage.getCopyBalanceText();
    // Assert
    expect(balanceText).toContain('USDT');
});

test('Copy position table is visible', async ({ portfolioCopyPage }) => {
    // Arrange — Copy tab loaded in beforeEach
    // Act
    const isVisible = await portfolioCopyPage.isCopyPositionTableVisible();
    // Assert
    expect(isVisible).toBe(true);
});

test('Start Copying button is visible on Copy tab', async ({ portfolioCopyPage }) => {
    // Arrange — Copy tab loaded in beforeEach
    // Act
    const isVisible = await portfolioCopyPage.isStartCopyingButtonVisible();
    // Assert
    expect(isVisible).toBe(true);
});
