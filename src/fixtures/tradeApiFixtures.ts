import { test as baseTest } from '@playwright/test';
import { TradeApiHelper } from '../api/TradeApiHelper';

type TradeApiFixtures = {
    tradeApiHelper: TradeApiHelper;
};

// Use this fixture for isolated tests that can authenticate independently (e.g. indi-style tests).
// For serial describe blocks that share state across tests, create TradeApiHelper in test.beforeAll
// using playwright.request.newContext() so one session is reused across all tests in the block.
export const test = baseTest.extend<TradeApiFixtures>({
    tradeApiHelper: async ({ playwright }, use) => {
        const ctx = await playwright.request.newContext();
        const helper = new TradeApiHelper(ctx, process.env.TRADE_BASE_URL!);
        await helper.login(
            process.env.TRADE_USER_EMAIL!,
            process.env.TRADE_USER_PASSWORD!,
            process.env.TRADE_2FA_SECRET!,
        );
        await use(helper);
        await ctx.dispose();
    },
});

export { expect } from '@playwright/test';
