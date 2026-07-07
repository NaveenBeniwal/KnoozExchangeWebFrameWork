// BinanceHelper — wraps Binance public REST API calls used for reference-data
// validation in trading-page tests. Uses Playwright's page.request so no extra
// HTTP library is needed and the calls share the test's proxy / network config.

import type { Page } from '@playwright/test';

export interface BinanceTicker24h {
    symbol:         string;
    lastPrice:      number;
    priceChange:    number;
    priceChangePct: number;  // e.g. -2.536 means -2.536%
    highPrice:      number;
    lowPrice:       number;
    volume:         number;  // base-currency volume
    quoteVolume:    number;  // quote-currency volume
}

export interface BinanceOrderBook {
    bids: Array<{ price: number; qty: number }>;
    asks: Array<{ price: number; qty: number }>;
}

export interface BinanceTrade {
    price:        number;
    qty:          number;
    time:         number;   // unix ms
    isBuyerMaker: boolean;
}

export class BinanceHelper {

    private static readonly BASE = 'https://api.binance.com/api/v3';

    // "BTC/USDT" → "BTCUSDT"
    static toSymbol(pair: string): string {
        return pair.replace('/', '');
    }

    static async get24hTicker(page: Page, pair: string): Promise<BinanceTicker24h> {
        const symbol = this.toSymbol(pair);
        const resp   = await page.request.get(`${this.BASE}/ticker/24hr?symbol=${symbol}`);
        const d      = await resp.json() as Record<string, string>;
        return {
            symbol:         d['symbol'] ?? symbol,
            lastPrice:      parseFloat(d['lastPrice']            ?? '0'),
            priceChange:    parseFloat(d['priceChange']          ?? '0'),
            priceChangePct: parseFloat(d['priceChangePercent']   ?? '0'),
            highPrice:      parseFloat(d['highPrice']            ?? '0'),
            lowPrice:       parseFloat(d['lowPrice']             ?? '0'),
            volume:         parseFloat(d['volume']               ?? '0'),
            quoteVolume:    parseFloat(d['quoteVolume']          ?? '0'),
        };
    }

    static async getOrderBook(page: Page, pair: string, limit = 20): Promise<BinanceOrderBook> {
        const symbol = this.toSymbol(pair);
        const resp   = await page.request.get(`${this.BASE}/depth?symbol=${symbol}&limit=${limit}`);
        const d      = await resp.json() as { bids: string[][]; asks: string[][] };
        return {
            bids: (d.bids ?? []).map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) })),
            asks: (d.asks ?? []).map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) })),
        };
    }

    static async getRecentTrades(page: Page, pair: string, limit = 20): Promise<BinanceTrade[]> {
        const symbol = this.toSymbol(pair);
        const resp   = await page.request.get(`${this.BASE}/trades?symbol=${symbol}&limit=${limit}`);
        const data   = await resp.json() as Array<Record<string, unknown>>;
        return data.map(t => ({
            price:        parseFloat(t['price']        as string ?? '0'),
            qty:          parseFloat(t['qty']          as string ?? '0'),
            time:         t['time']                    as number ?? 0,
            isBuyerMaker: t['isBuyerMaker']            as boolean ?? false,
        }));
    }

    // True when |pageVal - refVal| / refVal ≤ toleranceFraction.
    // Skips the check (returns true) when refVal is 0.
    static withinTolerance(pageVal: number, refVal: number, toleranceFraction: number): boolean {
        if (refVal === 0) return true;
        return Math.abs(pageVal - refVal) / Math.abs(refVal) <= toleranceFraction;
    }
}
