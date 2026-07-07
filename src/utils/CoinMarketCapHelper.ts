// CoinMarketCapHelper — fetches live 24h volume from CoinMarketCap's public web-data endpoint
// (the same one coinmarketcap.com's own site calls; no API key required, unlike their official
// Pro API). Used specifically for Volume (24h): CoinGecko's "total_volume" applies a trust-score
// discount to some exchange volume and can differ from CoinMarketCap's figure by 40-80%+ for a
// given coin, while Knooz's own displayed volume tracks CoinMarketCap closely (confirmed by
// direct comparison against coinmarketcap.com). Market cap and circulating supply are NOT fetched
// here — CoinGecko already matches those closely, so there's no need to depend on a second source.
//
// To add a new coin: add its numeric CoinMarketCap ID to the "cmcId" column in coinDetailData.csv
// (find it in the coin's CoinMarketCap URL or via CMC's ID map). No code changes needed here.

export interface CmcVolumeData {
    volume24h: number; // USD 24-hour trading volume
}

export class CoinMarketCapHelper {

    private static readonly CMC_BASE = 'https://api.coinmarketcap.com/data-api/v3/cryptocurrency/quote/latest';

    /**
     * Fetch live 24h volume for a list of CoinMarketCap numeric IDs in a single call.
     * Returns a Map from cmcId (as string) → CmcVolumeData; IDs absent in the response are omitted.
     * On network failure the map is empty and a console warning is emitted — callers should treat
     * a missing entry the same as "no live reference available", not a hard failure.
     */
    static async fetchVolumeData(ids: string[]): Promise<Map<string, CmcVolumeData>> {
        const result   = new Map<string, CmcVolumeData>();
        const validIds = ids.filter(id => typeof id === 'string' && id.trim().length > 0);
        if (validIds.length === 0) return result;

        const url = `${CoinMarketCapHelper.CMC_BASE}?id=${validIds.join(',')}&convert=USD`;

        try {
            const response = await fetch(url, {
                headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 playwright-test' },
            });

            if (!response.ok) {
                console.warn(`[CoinMarketCapHelper] CMC responded ${response.status} — live volume validation skipped`);
                return result;
            }

            // Response shape (verified live): { data: [ { id, quotes: [ { volume24h, ... } ] }, ... ] }
            // — data is an ARRAY (not keyed by id), and each coin's convert-currency data is the
            // first (only, since we request a single "convert=USD") entry of its own "quotes" array.
            const body  = (await response.json()) as { data?: Array<Record<string, unknown>> };
            const coins = body.data ?? [];
            for (const coin of coins) {
                const id = coin['id'] != null ? String(coin['id']) : '';
                if (!id) continue;
                const quotes    = (coin['quotes'] as Array<Record<string, unknown>>) ?? [];
                const volume24h = (quotes[0]?.['volume24h'] as number) ?? 0;
                result.set(id, { volume24h });
            }
        } catch (err) {
            console.warn(`[CoinMarketCapHelper] Failed to fetch live volume data: ${err}`);
        }

        return result;
    }
}
