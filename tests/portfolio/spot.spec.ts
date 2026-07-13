import { test, expect } from '../../src/fixtures/pagefixtures';
import { CsvHelper } from '../../src/utils/CsvHelper';

const spotData = CsvHelper.readCsv('src/data/spotValidationData.csv');
const allCoins = spotData.map(r => r.name);
const TABLE_HEADERS = ['Coin', 'Spot Balance', 'In Order', 'Total', 'Action', 'Today PNL', 'Trade'];

test.beforeEach(async ({ loginPage, portfolioSpotPage }) => {
    await loginPage.goToLoginPage();
    await loginPage.doLogin(process.env.EMAIL!, process.env.PASSWORD!, process.env.OTP!);
    await portfolioSpotPage.goToSpotTab();
});

// ─── Header ──────────────────────────────────────────────────────────────────

test('estimated balance label is visible on Spot page', async ({ portfolioSpotPage }) => {
    const isVisible = await portfolioSpotPage.isEstimatedBalanceLabelVisible();
    expect(
        isVisible ? 'visible' : 'not visible',
        '"Estimated Balance:" label on Spot page'
    ).toBe('visible');
});

test('estimated balance shows a valid positive number on Spot page', async ({ portfolioSpotPage }) => {
    const balance = await portfolioSpotPage.getEstimatedBalanceAmount();
    expect(
        balance,
        `Estimated balance should be > 0\n  Received: ${balance} USDT`
    ).toBeGreaterThan(0);
});

test('estimated balance amount element is visible on Spot page', async ({ portfolioSpotPage }) => {
    const isVisible = await portfolioSpotPage.isEstimatedBalanceAmountVisible();
    expect(
        isVisible ? 'visible' : 'not visible',
        'Estimated Balance amount (X.XXXXXXXX USDT) on Spot page'
    ).toBe('visible');
});

test('Total PNL label is visible on Spot page', async ({ portfolioSpotPage }) => {
    const isVisible = await portfolioSpotPage.isTotalPnlLabelVisible();
    expect(
        isVisible ? 'visible' : 'not visible',
        '"Total PNL" label on Spot page'
    ).toBe('visible');
});

test('Total PNL value is visible on Spot page', async ({ portfolioSpotPage }) => {
    const isVisible = await portfolioSpotPage.isTotalPnlValueVisible();
    expect(
        isVisible ? 'visible' : 'not visible',
        'Total PNL value (USDT amount) on Spot page'
    ).toBe('visible');
});

test('Deposit & Withdraw button is visible on Spot page', async ({ portfolioSpotPage }) => {
    const isVisible = await portfolioSpotPage.isDepositWithdrawButtonVisible();
    expect(
        isVisible ? 'visible' : 'not visible',
        '"Deposit & Withdraw" button on Spot page'
    ).toBe('visible');
});

// ─── Tab ──────────────────────────────────────────────────────────────────────

test('Spot tab is visible', async ({ portfolioSpotPage }) => {
    const isVisible = await portfolioSpotPage.isSpotTabVisible();
    expect(
        isVisible ? 'visible' : 'not visible',
        '"Spot" tab in the portfolio tab bar'
    ).toBe('visible');
});

// ─── Table Controls ───────────────────────────────────────────────────────────

test('search currency field is visible', async ({ portfolioSpotPage }) => {
    const isVisible = await portfolioSpotPage.isSearchFieldVisible();
    expect(
        isVisible ? 'visible' : 'not visible',
        '"Search currency" input field on Spot page'
    ).toBe('visible');
});

test('Hide Zero Balance toggle is visible', async ({ portfolioSpotPage }) => {
    const isVisible = await portfolioSpotPage.isHideZeroBalanceVisible();
    expect(
        isVisible ? 'visible' : 'not visible',
        '"Hide Zero Balance" checkbox on Spot page'
    ).toBe('visible');
});

// ─── Table Headers ────────────────────────────────────────────────────────────

test('all table headers are visible', async ({ portfolioSpotPage }) => {
    for (const header of TABLE_HEADERS) {
        const isVisible = await portfolioSpotPage.isTableHeaderVisible(header);
        expect.soft(
            isVisible ? 'visible' : 'not visible',
            `Column header "${header}" in Spot table`
        ).toBe('visible');
    }
});

// ─── Coin Row Visibility ──────────────────────────────────────────────────────

test('all coins from CSV are visible in spot table', async ({ portfolioSpotPage }) => {
    for (const coin of allCoins) {
        const isVisible = await portfolioSpotPage.isCoinRowVisible(coin);
        expect.soft(
            isVisible ? 'visible' : 'not visible',
            `Row for "${coin}" in Spot table`
        ).toBe('visible');
    }
});

// ─── Balance Math: Spot + In Order = Total ────────────────────────────────────

test('spot balances are non-negative for all coins', async ({ portfolioSpotPage }) => {
    for (const coin of allCoins) {
        const { spotBalanceNative } = await portfolioSpotPage.getCoinRowData(coin);
        expect.soft(
            spotBalanceNative,
            `${coin} — Spot Balance should be >= 0`
        ).toBeGreaterThanOrEqual(0);
    }
});

test('in order balances are non-negative for all coins', async ({ portfolioSpotPage }) => {
    for (const coin of allCoins) {
        const { inOrderNative } = await portfolioSpotPage.getCoinRowData(coin);
        expect.soft(
            inOrderNative,
            `${coin} — In Order should be >= 0`
        ).toBeGreaterThanOrEqual(0);
    }
});

test('total equals spot balance plus in order for each coin', async ({ portfolioSpotPage }) => {
    const TOLERANCE = 1e-6;

    for (const coin of allCoins) {
        const { spotBalanceNative, inOrderNative, totalNative } = await portfolioSpotPage.getCoinRowData(coin);
        const calculatedTotal = spotBalanceNative + inOrderNative;
        const diff            = Math.abs(calculatedTotal - totalNative);
        const inRange         = diff <= TOLERANCE;

        // Expected = calculated (Spot + InOrder)  |  Received = displayed Total
        expect.soft(
            inRange ? `${calculatedTotal}` : `${totalNative} (displayed)`,
            `${coin} Total mismatch:\n` +
            `  Spot Balance : ${spotBalanceNative}\n` +
            `  In Order     : ${inOrderNative}\n` +
            `  Calculated   : ${spotBalanceNative} + ${inOrderNative} = ${calculatedTotal}\n` +
            `  Displayed    : ${totalNative}\n` +
            `  Difference   : ${diff}  (allowed ≤ ${TOLERANCE})`
        ).toBe(`${calculatedTotal}`);
    }
});

// ─── Action Buttons ───────────────────────────────────────────────────────────

test('Deposit Withdraw Transfer actions are visible for every coin', async ({ portfolioSpotPage }) => {
    const actions: Array<'Deposit' | 'Withdraw' | 'Transfer'> = ['Deposit', 'Withdraw', 'Transfer'];
    for (const coin of allCoins) {
        for (const action of actions) {
            const isVisible = await portfolioSpotPage.isActionButtonVisible(coin, action);
            expect.soft(
                isVisible ? 'visible' : 'not visible',
                `"${action}" action button in the row for "${coin}"`
            ).toBe('visible');
        }
    }
});

// ─── Search Functionality ─────────────────────────────────────────────────────

test('search by coin name shows matching coins and hides unrelated ones', async ({ portfolioSpotPage }) => {
    for (const item of spotData) {
        await portfolioSpotPage.searchCurrency(item.searchQuery);

        // Any coin whose name contains the search query should be visible;
        // others should be hidden. This handles cases where one search term
        // (e.g. "USDT") legitimately matches multiple coin names.
        const shouldBeVisible = spotData.filter(r =>
            r.name.toLowerCase().includes(item.searchQuery.toLowerCase())
        );
        const shouldBeHidden = spotData.filter(r =>
            !r.name.toLowerCase().includes(item.searchQuery.toLowerCase())
        );

        for (const coin of shouldBeVisible) {
            const isVisible = await portfolioSpotPage.isCoinRowVisible(coin.name);
            expect.soft(
                isVisible ? 'visible' : 'hidden',
                `Search "${item.searchQuery}" — "${coin.name}" name contains search text, should be visible`
            ).toBe('visible');
        }

        for (const coin of shouldBeHidden) {
            const isVisible = await portfolioSpotPage.isCoinRowVisible(coin.name);
            expect.soft(
                isVisible ? 'visible' : 'hidden',
                `Search "${item.searchQuery}" — "${coin.name}" name does not contain search text, should be hidden`
            ).toBe('hidden');
        }

        await portfolioSpotPage.clearSearch();
    }
});

test('clearing the search field restores all coin rows', async ({ portfolioSpotPage }) => {
    await portfolioSpotPage.searchCurrency('USDT');
    await portfolioSpotPage.clearSearch();

    for (const coin of allCoins) {
        const isVisible = await portfolioSpotPage.isCoinRowVisible(coin);
        expect.soft(
            isVisible ? 'visible' : 'not visible',
            `After clearing search — "${coin}" should be visible again`
        ).toBe('visible');
    }
});

// ─── Hide Zero Balance ────────────────────────────────────────────────────────

test('Hide Zero Balance hides zero-total coins and toggle works correctly across 3 cycles', async ({ portfolioSpotPage }) => {
    await portfolioSpotPage.setHideZeroBalance(false);

    // Dynamically detect zero/non-zero coins from live data
    const zeroCoins    = await portfolioSpotPage.getZeroBalanceCoinNames(allCoins);
    const nonZeroCoins = allCoins.filter(c => !zeroCoins.includes(c));

    console.log(
        `[Spot] Hide Zero Balance test:\n` +
        `  Non-zero coins : [${nonZeroCoins.join(', ')}]\n` +
        `  Zero coins     : [${zeroCoins.join(', ') || 'none'}]`
    );

    for (let cycle = 1; cycle <= 3; cycle++) {

        // ── Check: zero-balance coins must disappear ──────────────────────────
        await portfolioSpotPage.setHideZeroBalance(true);

        for (const coin of zeroCoins) {
            const isVisible = await portfolioSpotPage.isCoinRowVisible(coin);
            expect.soft(
                isVisible ? 'visible' : 'hidden',
                `Cycle ${cycle}/3 — Hide ON: "${coin}" has $0 balance and should be hidden`
            ).toBe('hidden');
        }

        for (const coin of nonZeroCoins) {
            const isVisible = await portfolioSpotPage.isCoinRowVisible(coin);
            expect.soft(
                isVisible ? 'visible' : 'hidden',
                `Cycle ${cycle}/3 — Hide ON: "${coin}" has non-zero balance and should remain visible`
            ).toBe('visible');
        }

        // ── Uncheck: all coins must reappear ──────────────────────────────────
        await portfolioSpotPage.setHideZeroBalance(false);

        for (const coin of allCoins) {
            const isVisible = await portfolioSpotPage.isCoinRowVisible(coin);
            expect.soft(
                isVisible ? 'visible' : 'not visible',
                `Cycle ${cycle}/3 — Hide OFF: "${coin}" should be visible again`
            ).toBe('visible');
        }

        console.log(`[Spot] Hide Zero Balance cycle ${cycle}/3 complete`);
    }
});

test('Hide Zero Balance checkbox state reflects the UI correctly', async ({ portfolioSpotPage }) => {
    await portfolioSpotPage.setHideZeroBalance(false);
    const afterUncheck = await portfolioSpotPage.isHideZeroBalanceChecked();
    expect(
        afterUncheck ? 'checked' : 'unchecked',
        'Hide Zero Balance state after setHideZeroBalance(false)'
    ).toBe('unchecked');

    await portfolioSpotPage.setHideZeroBalance(true);
    const afterCheck = await portfolioSpotPage.isHideZeroBalanceChecked();
    expect(
        afterCheck ? 'checked' : 'unchecked',
        'Hide Zero Balance state after setHideZeroBalance(true)'
    ).toBe('checked');

    await portfolioSpotPage.setHideZeroBalance(false);
    const afterUncheckAgain = await portfolioSpotPage.isHideZeroBalanceChecked();
    expect(
        afterUncheckAgain ? 'checked' : 'unchecked',
        'Hide Zero Balance state after setHideZeroBalance(false) again'
    ).toBe('unchecked');
});
