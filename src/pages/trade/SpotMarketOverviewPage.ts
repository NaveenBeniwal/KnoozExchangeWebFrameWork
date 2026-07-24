import { SpotTradingBasePage } from './SpotTradingBasePage';
export type { FundsEntry, FullBalanceSnapshot, BalanceCheckResult, SpotOrderDetails } from './SpotTradingBasePage';

// Shared, order-type-agnostic checks (page chrome, ticker, order book, trades panels) that were
// previously duplicated identically across SpotBuyLimitOrderPage/SpotSellLimitOrderPage/
// SpotMarketBuyOrderPage/SpotMarketSellOrderPage's spec files. Everything these checks need
// already lives on SpotTradingBasePage — this class exists only so spotMarketOverview.spec.ts
// has a concrete page object to instantiate.
export class SpotMarketOverviewPage extends SpotTradingBasePage {}
