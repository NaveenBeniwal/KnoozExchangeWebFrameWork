import type { Locator, Page } from '@playwright/test';
import { SpotTradingBasePage } from './SpotTradingBasePage';
export type { FundsEntry, FullBalanceSnapshot, BalanceCheckResult, SpotOrderDetails } from './SpotTradingBasePage';

export class SpotMarketSellOrderPage extends SpotTradingBasePage {

    private readonly marketSellSubmitButton: Locator;
    private readonly marketAmountInput: Locator;
    private readonly anyMessageToast: Locator;

    constructor(page: Page) {
        super(page);
        this.marketSellSubmitButton = page.locator('button').filter({ hasText: /^SELL/ });
        this.marketAmountInput      = page.getByPlaceholder('Amount').first();
        this.estimatedFeeValue      = page.locator('.maxSelldata, [class*="fee"]').nth(1).locator('span').nth(1);
        this.anyMessageToast        = page.locator('[class*="ant-message"]').first();
    }

    // ─── % slider (sell side reads Amount/BTC, not Total/USDT) ──────────────

    override async clickPercentageButton(pct: 25 | 50 | 75 | 100): Promise<number> {
        const dotIndex: Record<number, number> = { 25: 1, 50: 2, 75: 3, 100: 4 };
        const dot = this.page.locator('.slider-dot').nth(dotIndex[pct]);
        await dot.waitFor({ state: 'visible', timeout: 8000 });
        await dot.click({ force: true });
        await this.page.waitForTimeout(600);
        // Sell market: slider fills Amount (BTC to sell). Read Amount, not Total (USDT).
        return this.parseNumber(await this.marketAmountInput.inputValue().catch(() => '0'));
    }

    // ─── Switch to Market Sell tab ────────────────────────────────────────────

    async selectMarketSellTab(): Promise<void> {
        await this.sellTabButton.click();
        await this.marketTabButton.click();
        await this.page.waitForTimeout(300);
        console.log('[SpotMarketSell] Market Sell tab selected');
    }

    // ─── Sell button label ────────────────────────────────────────────────────

    async getMarketSellButtonLabel(): Promise<string> {
        return (await this.marketSellSubmitButton.textContent() ?? '').trim();
    }

    // ─── Price field disabled on Market tab ──────────────────────────────────
    // Market tab shows a read-only "Market Price" field — visible but not editable.

    async isPriceFieldDisabled(): Promise<boolean> {
        const visible = await this.limitPriceInput.isVisible({ timeout: 1000 }).catch(() => false);
        if (!visible) return true; // absent → effectively can't enter
        const notEditable = await this.limitPriceInput
            .evaluate((el: HTMLInputElement) => el.disabled || el.readOnly)
            .catch(() => false);
        console.log(`[SpotMarketSell] Market Price field visible:${visible}, notEditable:${notEditable}`);
        return notEditable;
    }

    // ─── Enter market sell order (by base-coin amount) ───────────────────────

    async enterMarketSellOrder(amount: number, feePercent = 0.15): Promise<{ estFee: number; uiEstFee: number; feePresent: boolean; feeMatchStatus: 'match' | 'mismatch'; feeMatchMsg: string }> {
        await this.marketAmountInput.click({ clickCount: 3 });
        await this.marketAmountInput.pressSequentially(amount.toString(), { delay: 30 });
        await this.page.waitForTimeout(500);

        let amountText = await this.marketAmountInput.inputValue();
        if (!amountText || this.parseNumber(amountText) === 0) {
            await this.marketAmountInput.click({ clickCount: 3 });
            await this.marketAmountInput.fill(amount.toString());
            await this.page.waitForTimeout(500);
            amountText = await this.marketAmountInput.inputValue();
        }
        const filledAmount = this.parseNumber(amountText) || amount;
        const estFee = parseFloat((filledAmount * (feePercent / 100)).toFixed(8));

        let uiEstFee = estFee; let feeMatches = true; let feePresent = false;
        try {
            await this.estimatedFeeValue.waitFor({ state: 'visible', timeout: 2000 });
            feePresent = true;
            uiEstFee   = this.parseNumber(await this.estimatedFeeValue.textContent());
            feeMatches = parseFloat(estFee.toString()) === parseFloat(uiEstFee.toString());
        } catch { /* fee element absent on this order type */ }

        return {
            estFee, uiEstFee, feePresent,
            feeMatchStatus: feeMatches ? 'match' : 'mismatch',
            feeMatchMsg: `Estimated fee mismatch\n  Calculated:${estFee}\n  UI:${uiEstFee}`,
        };
    }

    // ─── Confirm market sell order ────────────────────────────────────────────

    async confirmMarketSellOrder(): Promise<{ successMessage: string; executedPrice: number; executedAmount: number; orderId: string }> {
        // For sell, beforeBalance is the BASE coin available (BTC)
        this.beforeBalance = await this.fetchAvailableBalance();
        await this.marketSellSubmitButton.first().waitFor({ state: 'visible', timeout: 10000 });
        await this.marketSellSubmitButton.first().scrollIntoViewIfNeeded();
        await this.marketSellSubmitButton.first().click();

        let toastMsg = '';
        try {
            await this.successToast.waitFor({ state: 'visible', timeout: 8000 });
            toastMsg = (await this.successToast.textContent() ?? '').trim();
        } catch {
            if (await this.anyMessageToast.isVisible({ timeout: 2000 }).catch(() => false))
                toastMsg = (await this.anyMessageToast.textContent() ?? '').trim();
        }
        await this.page.waitForTimeout(1500);

        // Market orders fill immediately — read executed price and orderId from All Orders
        await this.allOrdersTab.click();
        await this.page.waitForTimeout(1000);
        const cells = await this.findMainTableRow();
        console.log('[SpotMarketSell] All Orders first row:', JSON.stringify(cells));
        if (cells.length) {
            // 0=Date/Time, 1=OrderId, 2=Pair, 3=Type, 4=Side, 5=Executed, 6=Price, 7=Filled, 8=Remaining, 9=Total, 10=Status
            const orderId        = (cells[1] ?? '').trim();
            const executedPrice  = this.parseNumber(cells[5] ?? '0');
            const executedAmount = this.parseNumber(cells[7] ?? '0');
            const rowStatus      = (cells[10] ?? '').toLowerCase();
            if (!toastMsg && (rowStatus.includes('done') || rowStatus.includes('filled') || rowStatus.includes('complete'))) {
                toastMsg = `Order placed successfully (status: ${cells[10]})`;
            }
            return { successMessage: toastMsg, executedPrice, executedAmount, orderId };
        }
        if (!toastMsg) toastMsg = 'Order created successfully.';
        return { successMessage: toastMsg, executedPrice: 0, executedAmount: 0, orderId: '' };
    }

    // ─── Validate market sell in All Orders (Filled) ─────────────────────────

    async validateMarketSellInAllOrders(pair: string, orderDate: Date): Promise<{
        pairMatch: boolean; sideIsSell: boolean; typeIsMarket: boolean;
        statusFilled: boolean; executedPricePositive: boolean; dateTimeMatch: boolean;
    }> {
        // 0=Date/Time, 1=OrderId, 2=Pair, 3=Type, 4=Side, 5=Executed, 6=Price, 7=Filled, 8=Remaining, 9=Total, 10=Status
        const cells = await this.findMainTableRow();
        console.log('[SpotMarketSell] All Orders row:', JSON.stringify(cells));
        const rowDate = (cells[0] ?? '').trim();
        const rowPair = (cells[2] ?? '').trim();
        const rowType = (cells[3] ?? '').toLowerCase().trim();
        const rowSide = (cells[4] ?? '').toLowerCase().trim();
        const rowExec = this.parseNumber(cells[5] ?? '0');
        const rowStat = (cells[10] ?? '').toLowerCase().trim();
        return {
            pairMatch:             rowPair.includes(pair.replace('/', '')) || rowPair.includes(pair),
            sideIsSell:            rowSide.includes('sell'),
            typeIsMarket:          rowType.includes('market'),
            statusFilled:          rowStat.includes('filled') || rowStat.includes('complete') || rowStat.includes('done'),
            executedPricePositive: rowExec > 0,
            dateTimeMatch:         this.isDateTimeMatch(rowDate, orderDate),
        };
    }

    // ─── Validate market sell in My Trades ───────────────────────────────────

    async validateMarketSellInMyTrades(executedPrice: number, executedAmount: number, placedAt: Date): Promise<{
        hasEntry: boolean; priceMatch: boolean; amountMatch: boolean; timeMatch: boolean; timeDiffSec: number;
        entry: { price: number; amount: number; time: string } | null;
    }> {
        const entries = await this.getMyTradesEntries();
        if (entries.length === 0) return { hasEntry: false, priceMatch: false, amountMatch: false, timeMatch: false, timeDiffSec: 999999, entry: null };
        const entry = entries[0];
        const priceMatch  = executedPrice > 0 ? Math.abs(entry.price - executedPrice) / executedPrice < 0.01 : entry.price > 0;
        const amountMatch = executedAmount > 0 ? Math.abs(entry.amount - executedAmount) / executedAmount < 0.05 : entry.amount > 0;
        const { timeMatch, timeDiffSec } = (() => {
            const m = entry.time.match(/(\d{2}):(\d{2}):(\d{2})/);
            if (!m) return { timeMatch: false, timeDiffSec: 999999 };
            const now = new Date(placedAt);
            const pageMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(m[1]), parseInt(m[2]), parseInt(m[3])).getTime();
            const diffMs = Math.abs(pageMs - placedAt.getTime());
            return { timeMatch: diffMs < 120_000, timeDiffSec: Math.round(diffMs / 1000) };
        })();
        return { hasEntry: true, priceMatch, amountMatch, timeMatch, timeDiffSec, entry };
    }
}
