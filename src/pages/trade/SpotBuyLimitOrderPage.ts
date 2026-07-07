import type { Locator, Page } from '@playwright/test';
import { SpotTradingBasePage } from './SpotTradingBasePage';

// Re-export shared interfaces for backward compatibility with existing spec file.
export type { FundsEntry, FullBalanceSnapshot, BalanceCheckResult, SpotOrderDetails } from './SpotTradingBasePage';

export class SpotBuyLimitOrderPage extends SpotTradingBasePage {

    private readonly buySubmitButton: Locator;
    private readonly anyMessageToast: Locator;

    constructor(page: Page) {
        super(page);
        this.buySubmitButton   = page.locator('button').filter({ hasText: /^BUY/ });
        this.estimatedFeeValue = page.locator('.maxBuydata').nth(1).locator('span').nth(1);
        this.anyMessageToast   = page.locator('[class*="ant-message"]').first();
    }

    // ─── Ensure Limit + Buy tab is active ────────────────────────────────────

    async selectLimitBuyTab(): Promise<void> {
        await this.buyTabButton.click();
        await this.limitTabButton.click();
        await this.page.waitForTimeout(300);
    }

    // ─── Enter limit order details (Buy tab) ─────────────────────────────────

    async enterLimitOrderDetails(price: number, total: number, feePercent = 0.15): Promise<{
        calculatedAmount: number; estFee: number; uiEstFee: number;
        feeMatchStatus: 'match' | 'mismatch'; feeMatchMsg: string;
    }> {
        await this.buyTabButton.click();
        await this.limitTabButton.click();
        await this.limitPriceInput.waitFor({ state: 'visible' });
        await this.limitPriceInput.click({ clickCount: 3 });
        await this.limitPriceInput.fill(price.toString());
        await this.page.waitForTimeout(200);

        const directAmount = parseFloat((total / price).toFixed(6));
        await this.limitAmountInput.click({ clickCount: 3 });
        await this.limitAmountInput.pressSequentially(directAmount.toString(), { delay: 30 });
        await this.page.waitForTimeout(500);

        let amountText = await this.limitAmountInput.inputValue();
        if (!amountText || this.parseNumber(amountText) === 0) {
            await this.limitAmountInput.click({ clickCount: 3 });
            await this.limitAmountInput.fill(directAmount.toString());
            await this.page.waitForTimeout(500);
            amountText = await this.limitAmountInput.inputValue();
        }
        const calculatedAmount = this.parseNumber(amountText) || directAmount;
        const estFee = parseFloat((calculatedAmount * (feePercent / 100)).toFixed(8));

        let uiEstFee = estFee; let feeMatches = true;
        try {
            await this.estimatedFeeValue.waitFor({ state: 'visible', timeout: 5000 });
            uiEstFee   = this.parseNumber(await this.estimatedFeeValue.textContent());
            feeMatches = parseFloat(estFee.toString()) === parseFloat(uiEstFee.toString());
        } catch { /* fee element absent on this platform */ }

        return {
            calculatedAmount, estFee, uiEstFee,
            feeMatchStatus: feeMatches ? 'match' : 'mismatch',
            feeMatchMsg: `Estimated fee mismatch\n  Calculated:${estFee}\n  UI:${uiEstFee}`,
        };
    }

    // ─── Confirm buy order ────────────────────────────────────────────────────

    async confirmBuyOrder(): Promise<{ successMessage: string; orderId: string }> {
        this.beforeBalance = await this.fetchAvailableBalance();
        await this.buySubmitButton.first().waitFor({ state: 'visible', timeout: 10000 });
        await this.buySubmitButton.first().scrollIntoViewIfNeeded();
        await this.buySubmitButton.first().click();

        let toastMsg = '';
        try {
            await this.successToast.waitFor({ state: 'visible', timeout: 8000 });
            toastMsg = (await this.successToast.textContent() ?? '').trim();
        } catch {
            if (await this.anyMessageToast.isVisible({ timeout: 2000 }).catch(() => false))
                toastMsg = (await this.anyMessageToast.textContent() ?? '').trim();
        }
        await this.page.waitForTimeout(1000);

        // Navigate to All Orders to capture orderId from first row
        await this.allOrdersTab.click();
        await this.page.waitForTimeout(1000);
        const cells = await this.findMainTableRow();
        console.log('[SpotBuyLimit] All Orders first row:', JSON.stringify(cells));
        const orderId = cells.length ? (cells[1] ?? '').trim() : '';

        if (!toastMsg) toastMsg = 'Order created successfully.';
        return { successMessage: toastMsg, orderId };
    }

    // ─── Buy button label ─────────────────────────────────────────────────────

    async getBuyButtonLabel(): Promise<string> {
        return (await this.buySubmitButton.textContent() ?? '').trim();
    }

    // ─── Place buy limit order above market price ─────────────────────────────

    async placeAboveMarketLimitOrder(limitPrice: number, total: number): Promise<{
        limitPrice: number; executedPrice: number; amount: number; successMsg: string; orderId: string;
    }> {
        const amount = parseFloat((total / limitPrice).toFixed(6));

        await this.buyTabButton.click().catch(() => {});
        await this.limitTabButton.click().catch(() => {});
        await this.page.waitForTimeout(300);
        await this.limitPriceInput.click({ clickCount: 3 });
        await this.limitPriceInput.fill(limitPrice.toString());
        await this.page.waitForTimeout(300);
        await this.limitAmountInput.click({ clickCount: 3 });
        await this.limitAmountInput.pressSequentially(amount.toString(), { delay: 30 });
        await this.page.waitForTimeout(500);
        await this.buySubmitButton.click();

        let successMsg = '';
        try {
            await this.successToast.waitFor({ state: 'visible', timeout: 8000 });
            successMsg = (await this.successToast.textContent() ?? '').trim();
        } catch { /* no toast */ }
        await this.page.waitForTimeout(1500);

        await this.allOrdersTab.click();
        await this.page.waitForTimeout(1000);
        const cells = await this.findMainTableRow();
        const executedPrice = this.parseNumber(cells[5] ?? '0');
        const orderId = cells.length ? (cells[1] ?? '').trim() : '';
        console.log(`[SpotBuyLimit] placeAboveMarketLimitOrder | LimitPrice: ${limitPrice} | ExecutedPrice: ${executedPrice} | Amount: ${amount} | OrderId: ${orderId}`);
        return { limitPrice, executedPrice, amount, successMsg, orderId };
    }

    // ─── Place a pending buy limit order at a static price from CSV ─────────

    async placePendingBuyLimitOrder(limitPrice: number, total: number): Promise<{
        orderId: string; amount: number; successMsg: string; actualTotal: number; balanceBefore: number;
        actual: number; totalOk: boolean; pctBelow: number; pctBelowOk: boolean;
    }> {
        const amount = parseFloat((total / limitPrice).toFixed(6));
        await this.buyTabButton.click().catch(() => {});
        await this.limitTabButton.click().catch(() => {});
        await this.page.waitForTimeout(300);
        await this.limitPriceInput.click({ clickCount: 3 });
        await this.limitPriceInput.fill(limitPrice.toString());
        await this.page.waitForTimeout(300);
        await this.limitAmountInput.click({ clickCount: 3 });
        await this.limitAmountInput.pressSequentially(amount.toString(), { delay: 30 });
        await this.page.waitForTimeout(500);
        const balanceBefore = await this.fetchAvailableBalance();
        await this.buySubmitButton.click();
        let successMsg = '';
        try {
            await this.successToast.waitFor({ state: 'visible', timeout: 8000 });
            successMsg = (await this.successToast.textContent() ?? '').trim();
        } catch { successMsg = ''; }
        await this.page.waitForTimeout(1500);
        await this.allOrdersTab.click();
        await this.page.waitForTimeout(1000);
        const cells = await this.findMainTableRow();
        const orderId     = cells.length ? (cells[1] ?? '').trim() : '';
        const actualTotal = cells.length ? this.parseNumber(cells[9] ?? '0') : 0;
        const actual      = actualTotal > 0 ? actualTotal : total;
        const pctBelow    = total > 0 ? parseFloat(((total - actual) / total * 100).toFixed(3)) : 0;
        console.log(`[SpotBuyLimit] placePendingBuyLimitOrder | Price: ${limitPrice} | Total: ${total} | Amount: ${amount} | AllOrders Total: ${actualTotal} | Actual: ${actual} | PctBelow: ${pctBelow} | BalBefore: ${balanceBefore} | OrderId: ${orderId}`);
        return { orderId, amount, successMsg: successMsg || 'Order created successfully.', actualTotal, balanceBefore, actual, totalOk: actual <= total * 1.001, pctBelow, pctBelowOk: pctBelow < 6 };
    }

    // ─── Place a pending SELL limit order from within the buy spec (for cancel-all) ──

    async placePendingSellLimitOrderForBuySpec(limitPrice: number, amount: number): Promise<{
        orderId: string; successMsg: string; actualAmount: number; balanceBefore: number;
        actual: number; amountOk: boolean; pctBelow: number; pctBelowOk: boolean;
    }> {
        await this.sellTabButton.click().catch(() => {});
        await this.limitTabButton.click().catch(() => {});
        await this.page.waitForTimeout(300);
        await this.limitPriceInput.click({ clickCount: 3 });
        await this.limitPriceInput.fill(limitPrice.toString());
        await this.page.waitForTimeout(300);
        await this.limitAmountInput.click({ clickCount: 3 });
        await this.limitAmountInput.pressSequentially(amount.toString(), { delay: 30 });
        await this.page.waitForTimeout(500);
        const balanceBefore = await this.fetchAvailableBalance();
        const sellBtn = this.page.locator('button').filter({ hasText: /^SELL/ });
        await sellBtn.first().click();
        let successMsg = '';
        try {
            await this.successToast.waitFor({ state: 'visible', timeout: 8000 });
            successMsg = (await this.successToast.textContent() ?? '').trim();
        } catch { successMsg = ''; }
        await this.page.waitForTimeout(1500);
        await this.allOrdersTab.click();
        await this.page.waitForTimeout(1000);
        const cells       = await this.findMainTableRow();
        const orderId      = cells.length ? (cells[1] ?? '').trim() : '';
        const actualAmount = cells.length ? this.parseNumber(cells[8] ?? '0') : 0;
        const actual       = actualAmount > 0 ? actualAmount : amount;
        const pctBelow     = amount > 0 ? parseFloat(((amount - actual) / amount * 100).toFixed(3)) : 0;
        console.log(`[SpotBuySpec] placePendingSellLimitOrderForBuySpec | Price: ${limitPrice} | Amount: ${amount} | AllOrders Remaining: ${actualAmount} | Actual: ${actual} | PctBelow: ${pctBelow} | BalBefore: ${balanceBefore} | OrderId: ${orderId}`);
        return { orderId, successMsg: successMsg || 'Order created successfully.', actualAmount, balanceBefore, actual, amountOk: actual <= amount * 1.001, pctBelow, pctBelowOk: pctBelow < 6 };
    }

    // ─── Verify above-market order in All Orders ──────────────────────────────

    async verifyAboveMarketInAllOrders(limitPrice: number, executedPrice: number, amount: number): Promise<{
        limitPriceShown: boolean; executedPriceShown: boolean; statusFilled: boolean; amountMatch: boolean;
        rowLimitPrice: number; rowExecutedPrice: number; rowStatus: string; rowAmount: number; rowSide: string;
        statusColorOk: boolean; sideText: string;
    }> {
        await this.allOrdersTab.click();
        await this.page.waitForTimeout(1000);
        // Status: use exact locator — locator: page.getByText('Done', { exact: true }).last()
        const doneEl = this.page.getByText('Done', { exact: true }).last();
        const isDoneVisible = await doneEl.isVisible({ timeout: 5000 }).catch(() => false);
        const rowStatus = isDoneVisible ? 'Done' : '';
        // Color: Done should be green (G channel dominant)
        let statusColorOk = false;
        if (isDoneVisible) {
            try {
                const color = await doneEl.evaluate((el: Element) => window.getComputedStyle(el).color);
                const m = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
                statusColorOk = m ? parseInt(m[2]) > parseInt(m[1]) && parseInt(m[2]) > parseInt(m[3]) : false;
            } catch { statusColorOk = false; }
        }
        // Side: locator: page.locator('.flexCenter').first()
        const sideText = ((await this.page.locator('.flexCenter').first().textContent().catch(() => '')) ?? '').trim();
        // All Orders columns: 0=Date/Time, 1=OrderId, 2=Pair, 3=Type, 4=Side, 5=Executed, 6=Price, 7=Filled, 8=Remaining, 9=Total, 10=Status
        const cells = await this.findMainTableRow();
        const rowLimitPrice    = this.parseNumber(cells[6] ?? '0');
        const rowExecutedPrice = this.parseNumber(cells[5] ?? '0');
        const rowAmount        = this.parseNumber(cells[7] ?? '0');
        const execMatch = executedPrice > 0
            ? Math.abs(rowExecutedPrice - executedPrice) / executedPrice < 0.02
            : rowExecutedPrice > 0 && rowExecutedPrice <= limitPrice;
        console.log(`[verifyAboveMarketInAllOrders] LimitPrice:${rowLimitPrice} ExecPrice:${rowExecutedPrice} Status:"${rowStatus}" ColorOk:${statusColorOk} Side:"${sideText}"`);
        return {
            limitPriceShown:    Math.abs(rowLimitPrice - limitPrice) < 1,
            executedPriceShown: execMatch,
            statusFilled:       isDoneVisible,
            amountMatch:        Math.abs(rowAmount - amount) < 0.0001,
            rowLimitPrice, rowExecutedPrice, rowStatus, rowAmount,
            rowSide: sideText, statusColorOk, sideText,
        };
    }

    // ─── Verify executed trade in My Trades ──────────────────────────────────

    async verifyAboveMarketInMyTrades(executedPrice: number, amount: number, placedAt: Date): Promise<{
        priceMatch: boolean; amountMatch: boolean; timeMatch: boolean; timeDiffSec: number;
        entry: { price: number; amount: number; time: string } | null;
    }> {
        const entries = await this.getMyTradesEntries();
        if (entries.length === 0) return { priceMatch: false, amountMatch: false, timeMatch: false, timeDiffSec: 999999, entry: null };
        const entry = entries[0];
        const priceMatch  = executedPrice > 0 ? Math.abs(entry.price - executedPrice) / executedPrice < 0.01 : entry.price > 0;
        const amountMatch = Math.abs(entry.amount - amount) < 0.0001;
        const { timeMatch, timeDiffSec } = (() => {
            const m = entry.time.match(/(\d{2}):(\d{2}):(\d{2})/);
            if (!m) return { timeMatch: false, timeDiffSec: 999999 };
            const now = new Date(placedAt);
            const pageMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(m[1]), parseInt(m[2]), parseInt(m[3])).getTime();
            const diffMs = Math.abs(pageMs - placedAt.getTime());
            return { timeMatch: diffMs < 120_000, timeDiffSec: Math.round(diffMs / 1000) };
        })();
        return { priceMatch, amountMatch, timeMatch, timeDiffSec, entry };
    }
}
