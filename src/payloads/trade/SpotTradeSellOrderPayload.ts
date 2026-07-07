export interface LimitSellPayload {
    market: string;
    side: 'sell';
    volume: number;
    ord_type: 'limit';
    price: number;
    enabled: null;
}

export interface MarketSellPayload {
    market: string;
    side: 'sell';
    ord_type: 'market';
    volume: number;
    enabled: null;
}

export class SpotTradeSellOrderPayload {
    static limitSell(): LimitSellPayload {
        return {
            market: process.env.TRADE_SELL_MARKET ?? 'btcusdt',
            side: 'sell',
            volume: parseFloat(process.env.TRADE_SELL_VOLUME ?? '0.0001'),
            ord_type: 'limit',
            price: parseFloat(process.env.TRADE_SELL_PRICE ?? '85000'),
            enabled: null,
        };
    }

    static marketSell(volumeValue: number): MarketSellPayload {
        return {
            market: process.env.TRADE_SELL_MARKET ?? 'btcusdt',
            side: 'sell',
            ord_type: 'market',
            volume: volumeValue,
            enabled: null,
        };
    }
}
