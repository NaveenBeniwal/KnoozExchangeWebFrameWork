export interface LimitBuyPayload {
    market: string;
    side: 'buy';
    volume: number;
    ord_type: 'limit';
    price: number;
    enabled: null;
}

export interface MarketBuyPayload {
    market: string;
    side: 'buy';
    ord_type: 'market';
    total: number;
    enabled: null;
}

export class SpotTradeBuyOrderPayload {
    static limitBuy(): LimitBuyPayload {
        return {
            market: process.env.TRADE_BUY_MARKET ?? 'btcusdt',
            side: 'buy',
            volume: parseFloat(process.env.TRADE_BUY_VOLUME ?? '0.0001'),
            ord_type: 'limit',
            price: parseFloat(process.env.TRADE_BUY_PRICE ?? '62500'),
            enabled: null,
        };
    }

    static marketBuy(totalUsdt: number): MarketBuyPayload {
        return {
            market: process.env.TRADE_BUY_MARKET ?? 'btcusdt',
            side: 'buy',
            ord_type: 'market',
            total: totalUsdt,
            enabled: null,
        };
    }
}
