// MarketDataHelper — fetches live market data from CoinGecko's free public API.
// CoinGecko aggregates prices from major exchanges including Binance, so the
// market cap, 24h volume, and circulating supply it returns reflect the same
// underlying data the coin-detail page sources from Binance.
//
// To add a new coin: add a row to coinDetailData.csv with its coingeckoId
// (e.g., "solana" for SOL). No code changes needed here.

export interface CoinMarketData {
    marketCap:         number;  // USD total market capitalisation
    volume24h:         number;  // USD 24-hour trading volume
    circulatingSupply: number;  // coin units in circulation
    currentPrice:      number;  // USD spot price
    priceChange24h:    number;  // 24h percentage change, e.g. 2.5 means +2.5%
}

export class MarketDataHelper {

    private static readonly COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

    /**
     * Fetch live market data for a list of CoinGecko coin IDs in a single API call.
     * Returns a Map from coingeckoId → CoinMarketData; IDs absent in the response are omitted.
     * On network failure the map is empty and a console warning is emitted.
     *
     * CSV-driven: just add `coingeckoId` to a CSV row for any new coin — no code changes needed.
     */
    static async fetchMarketData(ids: string[]): Promise<Map<string, CoinMarketData>> {
        const result   = new Map<string, CoinMarketData>();
        const validIds = ids.filter(id => typeof id === 'string' && id.trim().length > 0);
        if (validIds.length === 0) return result;

        const url = `${MarketDataHelper.COINGECKO_BASE}/coins/markets` +
            `?vs_currency=usd&ids=${validIds.join(',')}&per_page=250&page=1`;

        try {
            const response = await fetch(url, {
                headers: { Accept: 'application/json', 'User-Agent': 'playwright-test' },
            });

            if (!response.ok) {
                console.warn(`[MarketDataHelper] CoinGecko responded ${response.status} — live validation skipped`);
                return result;
            }

            const coins = (await response.json()) as Record<string, unknown>[];
            for (const coin of coins) {
                const id = coin['id'] as string;
                if (!id) continue;
                result.set(id, {
                    marketCap:         (coin['market_cap']                    as number) ?? 0,
                    volume24h:         (coin['total_volume']                  as number) ?? 0,
                    circulatingSupply: (coin['circulating_supply']            as number) ?? 0,
                    currentPrice:      (coin['current_price']                 as number) ?? 0,
                    priceChange24h:    (coin['price_change_percentage_24h']   as number) ?? 0,
                });
            }
        } catch (err) {
            console.warn(`[MarketDataHelper] Failed to fetch live market data: ${err}`);
        }

        return result;
    }

    /**
     * Parse a formatted value string shown on the coin-detail page into a raw number.
     *
     * Handles all formats the page renders:
     *   "$186B"        → 186_000_000_000
     *   "$1.3T"        → 1_300_000_000_000
     *   "$78B+41.2%"   → 78_000_000_000  (% change stripped)
     *   "$32B-5.1%"    → 32_000_000_000
     *   "$00.0%"       → 0               (XYZ-style no-data placeholder)
     *   "2.1M xyz"     → 2_100_000       (circulating supply with coin name)
     *   "0 tether usdt"→ 0
     *   "$1,234,567"   → 1_234_567       (comma-formatted)
     */
    static parsePageValue(raw: string): number {
        // Remove trailing ±N.N% change indicator (e.g. "+41.2%", "-5.1%")
        const withoutChange = raw.replace(/[+\-]\d+\.?\d*%\s*$/, '').trim();

        // Match an optional $, digits (with commas), optional decimal, optional K/M/B/T suffix
        const match = withoutChange.match(/^\$?([\d,]+\.?\d*)\s*([KMBT])?/i);
        if (!match) return 0;

        const num    = parseFloat(match[1].replace(/,/g, ''));
        const suffix = (match[2] ?? '').toUpperCase();
        const scales: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
        return isNaN(num) ? 0 : num * (scales[suffix] ?? 1);
    }

    /**
     * Returns true when the page value is within `toleranceFraction` of the live value.
     * Skips the check (returns true) when liveValue is 0 to avoid divide-by-zero.
     *
     * Example: toleranceFraction = 0.25 → ±25 % allowed.
     * Use a generous tolerance (≥20 %) because the page may cache data while the
     * live API reflects the current second.
     */
    static withinTolerance(pageValue: number, liveValue: number, toleranceFraction: number): boolean {
        if (liveValue === 0) return true;
        return Math.abs(pageValue - liveValue) / liveValue <= toleranceFraction;
    }

    /**
     * Extracts the percentage change appended to a page market-stat value.
     * Examples:
     *   "$18B+39.3%"   → 39.3
     *   "$30B-5.1%"    → -5.1
     *   "$18B"         → null  (no change displayed)
     *   "$00.0%"       → null  (no leading ±, treated as absent)
     *
     * No free public API provides 24h volume change % directly, so this helper
     * lets the test parse it from the page display and run a sanity-range check.
     */
    static parseChangePercent(raw: string): number | null {
        const match = raw.match(/([+\-]\d+\.?\d*)%/);
        return match ? parseFloat(match[1]) : null;
    }

    // Format a raw number into a human-readable abbreviated form.
    // Examples: 1_330_439_093_025 → "$1.33T" | 107_769_544_881 → "$107.77B"
    //           20_043_412 → "20.04M" | 186_549 → "186.55K"
    // Pass useCurrency=false for coin-unit quantities (circulating supply).
    static formatLargeNumber(value: number, useCurrency = true): string {
        const prefix = useCurrency ? '$' : '';
        if (value >= 1e12) return `${prefix}${(value / 1e12).toFixed(2)}T`;
        if (value >= 1e9)  return `${prefix}${(value / 1e9 ).toFixed(2)}B`;
        if (value >= 1e6)  return `${prefix}${(value / 1e6 ).toFixed(2)}M`;
        if (value >= 1e3)  return `${prefix}${(value / 1e3 ).toFixed(2)}K`;
        return `${prefix}${value.toLocaleString()}`;
    }
}
