# Spot Market Buy Order — Complete Test Steps

**File:** `tests/trade/spotMarketBuyOrder.spec.ts`
**Data:** `src/data/spotMarketBuyData.csv`
**Mode:** Serial (each step depends on the previous one)

---

## SETUP — Before All Tests

**Step 1:** Launch a Chromium browser (non-headless, 1280×720 viewport) and open a new browser page.

**Step 2:** Navigate to the login page (`BASE_URL` + login route).

**Step 3:** Enter the email address in the email field and click "Continue".

**Step 4:** Enter the password in the password field and click "Continue".

**Step 5:** Read the current TOTP/OTP value and enter it in the OTP field, then click "Continue" to complete login successfully.

**Step 6:** Dismiss any post-login dialogs (popups, banners, announcements) and wait for the home/dashboard page to be fully loaded.

---

## TC-01 — Navigate to Spot Trading

**Step 7:** Click on the Spot Trading link/menu item to navigate to the Spot Trading page and wait for it to load.

---

## TC-02 — Verify Page Labels

**Step 8:** Read all visible labels on the Spot Trading page and verify each one is correct:
- "Depth View" label is present
- "Order Book" heading is present
- "Buy" tab is present
- "Sell" tab is present
- "Limit" tab is present
- "Market" tab is present
- "Market Trades" label is present
- "My Trades" label is present
- "All Orders" tab is present
- "Trade History" label is present

---

## TC-03 — Search Currency Pair

**Step 9:** Type the pair name (e.g. `BTC/USDT`, read from CSV `searchPair` column) into the search/filter input in the market dropdown and wait for results to appear.

---

## TC-04 — Mark as Favorite

**Step 10:** Click the star/favorite icon next to the pair in the search results to mark it as a favorite.

**Step 11:** Verify the success toast/status message confirms the pair was **added** to favorites.

---

## TC-05 — Unmark from Favorites

**Step 12:** Click the star/favorite icon again to unmark the pair from favorites.

**Step 13:** Verify the status message confirms the pair was **removed** from favorites.

---

## TC-06 — Select Currency Pair

**Step 14:** Click the "ALL" tab in the pair list, find the pair (e.g. BTC/USDT), and click it to activate it as the active trading pair. The whole page (order book, ticker, trade form) now shows data for this pair.

---

## TC-02b — Verify 24h Ticker vs Binance

**Step 15:** Simultaneously fetch the 24h ticker data from the page and from the Binance public API for the same pair, then verify:
- Page last price is a positive number
- Page last price is within 1% of Binance last price (live price tolerance)
- Page 24h high matches Binance exactly
- Page 24h low matches Binance exactly

---

## TC-03b — Order Book Column Headers

**Step 16:** Read the order book column headers and verify all three are visible and non-empty: **Price**, **Amount**, **Total**.

---

## TC-03c — Order Book View Switches

**Step 17:** Switch the order book to "Sell-only" view → verify the order book is still visible and the top ask price is positive.

**Step 18:** Switch to "Buy-only" view → verify the order book is still visible and the top bid price is positive.

**Step 19:** Switch back to "All" view → verify both top ask and top bid prices are positive.

---

## TC-03d — Order Book Precision Dropdown

**Step 20:** Cycle through precision values `0.01 → 0.1 → 1 → 0.01` (restoring the default). For each precision, and for each of the three views (all / sell / buy), verify that displayed prices have no more decimal places than the precision allows:
- `0.01` → max 2 decimal places
- `0.1`  → max 1 decimal place
- `1`    → max 0 decimal places

Restore to "All" view at `0.01` precision at the end.

---

## TC-03e — Order Book LTP & Buy/Sell Ratio (Suggestions Only)

**Step 21:** Attempt to read the Last Traded Price (LTP) from the order book mid-row. Record as a **suggestion** that LTP display is not yet implemented. No assertion failure.

**Step 22:** Attempt to read the buy % and sell % ratio bar values. Record as a **suggestion** that the ratio bar is not yet implemented. No assertion failure.

---

## TC-03f — Order Book Has Real Data Rows

**Step 23:** Count the ask rows and bid rows in the order book, read the top ask price and top bid price. Verify:
- Ask row count > 0
- Bid row count > 0
- Top ask price > 0
- Top bid price > 0

---

## TC-03g — Valid Spread

**Step 24:** Read the top bid and top ask prices. Verify that top bid < top ask (a valid market spread exists).

---

## TC-03h — Bid/Ask vs Binance within 0.5%

**Step 25:** Simultaneously fetch the top bid/ask from the page and from the Binance order book API. Verify:
- Page top bid is within 0.5% of Binance top bid
- Page top ask is within 0.5% of Binance top ask

---

## TC-03i — Order Book LTP vs Binance within 0.5%

**Step 26:** Simultaneously read the page order book LTP and the Binance 24h last price. Verify the LTP is positive and within 0.5% of the Binance last price.

---

## TC-06a — Market Buy Tab Price Field is Disabled

**Step 27:** Click the **Buy** tab, then click the **Market** tab to activate the Market Buy form.

**Step 28:** Verify the Price input field is **disabled / read-only** (on Market orders the price is determined by the market, not entered by the user).

---

## TC-06a1 — Buy Button Label

**Step 29:** Read the text on the Buy button. Verify it contains "BUY" and the base coin name (e.g. "BUY BTC").

---

## TC-06a2 — Quote Currency Available Balance is Non-Negative

**Step 30:** Read the "Available" balance shown next to the buy form (quote coin, e.g. USDT). Verify it is ≥ 0.

---

## TC-06a3 — 25% Button

**Step 31:** Click the **25%** button. Verify the total spend field is filled with a positive value close to 25% of the available USDT balance (within 5% tolerance).

---

## TC-06a4 — 50% Button

**Step 32:** Click the **50%** button. Verify the total spend field is filled close to 50% of the available USDT balance (within 5% tolerance).

---

## TC-06a5 — 75% Button

**Step 33:** Click the **75%** button. Verify the total spend field is filled close to 75% of the available USDT balance (within 5% tolerance).

---

## TC-06a6 — 100% Button

**Step 34:** Click the **100%** button. Verify the total spend field is filled close to 100% of the available USDT balance (within 5% tolerance).

---

## TC-06a7 — Pair Header Shows Selected Pair

**Step 35:** Read the pair header/title shown above the order form. Verify it contains the base coin name (e.g. "BTC") or the full pair name (e.g. "BTC/USDT").

---

## TC-06b — Capture Pre-Order Balance Snapshot

**Step 36:** Navigate to the **Portfolio → Spot** page and capture a full balance snapshot including:
- Available USDT balance (buy side)
- Available BTC balance (sell side)
- Portfolio spot balances for both USDT and BTC
- Funds balances for both USDT and BTC

Navigate back to the Spot Trading page. Verify the buy available balance is ≥ 0 and matches the portfolio USDT spot balance.

---

## TC-07 — Enter Buy Total and Verify Estimated Fee

**Step 37:** Click the **Market** tab to ensure it is active.

**Step 38:** Clear the total field and type the USDT amount to spend (e.g. `8` USDT — value from CSV `buyTotal` column).

**Step 39:** Read the estimated fee shown on the form. Calculate the expected fee as:
`buyTotal × feePercent ÷ 100` (feePercent from CSV, e.g. 0.15%).
Verify the UI estimated fee matches the calculated fee. If the fee element is not displayed, log a suggestion and skip the assertion.

---

## TC-08 — Note USDT Balance Before Placing Order

**Step 40:** Read and log the current USDT available balance (from the snapshot captured in TC-06b). Verify it is ≥ 0. This is the baseline for the post-order comparison.

---

## TC-09 — Place Market Buy Order and Verify Success

**Step 41:** Click the **Market** tab (re-activate to ensure a clean state), then re-enter the buy total amount from CSV.

**Step 42:** Check if the text "Insufficient balance" is visible on the form within 2 seconds.
- If **YES** → mark order as failed, record a soft failure with the message "Insufficient balance — top up and re-run", and **stop this test**. All remaining tests (TC-09b through TC-14b) will be skipped.

**Step 43:** If balance is sufficient → record the current timestamp as `orderPlacedAt`.

**Step 44:** Click the **Buy BTC** button to submit / open the confirmation dialog.

**Step 45:** In the confirmation dialog/modal, read the executed price, executed amount, and order ID. Click **Confirm** to finalize the order.

**Step 46:** Wait for the success message/toast. Verify the message contains "success", "created", "placed", or "status:". If it does → `orderSucceeded = true`.

---

## TC-09b — Balance Snapshot After Fill

> Skipped if TC-09 failed or balance was insufficient.

**Step 47:** Wait 2 seconds for the exchange to process the fill.

**Step 48:** Navigate to Portfolio and capture a new full balance snapshot.

**Step 49:** Calculate expected balance changes:
- USDT should **decrease** by `buyTotal`
- BTC should **increase** by `executedAmount`

**Step 50:** Compare the before-snapshot (TC-06b) vs the after-snapshot for all of the following, each within 0.5% tolerance:
- Buy available balance (USDT)
- Sell available balance (BTC)
- Portfolio USDT spot balance
- Portfolio BTC spot balance
- Funds USDT amount
- Funds BTC amount

If a coin is not found in the portfolio, log a suggestion instead of failing.

---

## TC-09c — Market Trades Panel Has Correct Headers

**Step 51:** Click the **Market Trades** tab in the bottom panel. Read the column headers. Verify they include "price", "amount" (or "qty"), and "time".

---

## TC-09d — My Trades Panel Has Correct Headers

**Step 52:** Click the **My Trades** tab. Read its column headers. Verify they include "price", "amount" (or "qty"), and "time". Switch back to Market Trades tab.

---

## TC-09e — Market Trades Has Real Data Rows

**Step 53:** Read the data rows in the Market Trades panel. Verify:
- At least 1 row exists
- The first row's price is positive
- The first row's amount is positive

---

## TC-09f — Market Trades Prices Match Binance within 1%

**Step 54:** Simultaneously read the Market Trades rows from the page and fetch the 20 most recent trades from the Binance API. Verify the most recent page trade price is within 1% of the Binance most recent trade price.

---

## TC-10 — Market Buy is NOT in Open Orders

> Skipped if TC-09 failed.

**Step 55:** Open the **Open Orders** tab. Look for a row matching the pair. Verify the buy order is **not present as a pending entry** — market orders fill immediately and should never appear in Open Orders.

---

## TC-11 — All Orders Shows Market Buy as Filled

> Skipped if TC-09 failed.

**Step 56:** Open the **All Orders** tab. Find the latest row. Verify:
- Pair column contains "BTCUSDT" (slash-stripped comparison)
- Side contains "buy"
- Type contains "market"
- Status matches `done` / `filled` / `complete`
- Executed price > 0
- Filled amount > 0
- Remaining = 0
- Total > 0
- Date/time is within 60 seconds of when the order was placed (`orderPlacedAt`)

---

## TC-12 — My Trades Shows the Executed Buy Entry

> Skipped if TC-09 failed.

**Step 57:** Read the **My Trades** tab entries. Verify:
- At least 1 entry exists
- The entry price is positive
- The entry amount is positive
- The entry timestamp is within 2 minutes of the order placement time

---

## TC-13 — USDT Decreases by Actual Total; BTC Increases by Filled Minus Fee

> Skipped if TC-09 failed.

**Step 58:** Verify the All Orders total does not exceed the entered USDT total by more than 5% (guard against market order overspend bug).

**Step 59:** Read the current USDT available balance from the trade form. Verify it has decreased by the actual total spent (All Orders total, or entered total if not available), within 3% tolerance.

**Step 60:** If filled amount is available from All Orders, calculate:
`btcFee = filledAmount × feePercent ÷ 100`
`btcReceived = filledAmount − btcFee`
Verify the BTC available balance has increased by `btcReceived`, within 3% tolerance.

---

## TC-14 — Trade History Shows the Market Buy Order

> Skipped if TC-09 failed.

**Step 61:** Open the **Trade History** tab. Find the latest entry matching the order.
- If **no entry found** → log a suggestion ("market order may not appear yet — verify manually") and skip assertions.

**Step 62:** If entry is found, verify:
- Pair contains "BTCUSDT"
- Side contains "buy"
- Executed price > 0
- Amount > 0
- Total > 0
- Fee ≥ 0
- Date/time is within 60 seconds of the order placement time

---

## TC-14b — Trade History Bottom Widget Shows the Buy Entry

> Skipped if TC-09 failed.

**Step 63:** Read the first row of the Trade History widget at the bottom of the trading page (this is separate from the full Trade History tab above). Verify:
- Pair references "BTC" or "BTCUSDT"
- Side contains "buy"
- Price is positive

---

## TEARDOWN — After All Tests

**Step 64:** Close the browser.

---

## Quick Reference Summary

| Step Range | Area |
|---|---|
| 1 – 6   | Browser launch, login, dismiss dialogs |
| 7       | Navigate to Spot Trading page |
| 8       | Verify all page labels |
| 9       | Search for currency pair |
| 10 – 11 | Mark pair as favorite |
| 12 – 13 | Unmark pair from favorites |
| 14      | Select pair from ALL tab |
| 15      | Verify 24h ticker vs Binance |
| 16      | Verify order book column headers |
| 17 – 19 | Order book view switches (all/sell/buy) |
| 20      | Order book precision dropdown |
| 21 – 22 | Order book LTP & ratio bar (suggestions) |
| 23 – 24 | Order book real rows and valid spread |
| 25 – 26 | Order book bid/ask/LTP vs Binance |
| 27 – 28 | Market Buy tab Price field is disabled |
| 29      | Buy button label is correct |
| 30      | Quote currency (USDT) available balance is non-negative |
| 31 – 34 | 25% / 50% / 75% / 100% percentage buttons |
| 35      | Pair header shows selected pair |
| 36      | Capture pre-order full balance snapshot |
| 37 – 39 | Enter buy total and verify estimated fee |
| 40      | Note USDT balance before placing order |
| 41 – 46 | Place market buy order and verify success |
| 47 – 50 | Post-fill balance snapshot comparison |
| 51      | Market Trades panel headers |
| 52      | My Trades panel headers |
| 53      | Market Trades has real data rows |
| 54      | Market Trades prices vs Binance within 1% |
| 55      | Market buy NOT in Open Orders |
| 56      | All Orders shows buy as Filled |
| 57      | My Trades shows executed buy entry |
| 58 – 60 | USDT decreased and BTC increased after buy |
| 61 – 62 | Trade History full tab validation |
| 63      | Trade History bottom widget validation |
| 64      | Close browser |
