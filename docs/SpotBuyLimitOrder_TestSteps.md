# Spot Buy Limit Order — Complete Test Steps

**File:** `tests/trade/spotBuyLimitOrder.spec.ts`
**Data:** `src/data/spotBuyLimitData.csv`
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

**Step 7:** Click on the Trading menu item and navigate to the Spot Trading page; wait for the page to fully load.

---

## TC-02 — Verify Page Labels

**Step 8:** Read all visible labels on the Spot Trading page and verify each one is correct:
- "Trading" page heading is present
- "Spot" label is present
- "Depth View" label is present
- "Order Book" heading is present
- "Buy" tab is present
- "Sell" tab is present
- "Limit" tab is present
- "Market" tab is present
- "Stop" tab is present
- "Market Trades" label is present
- "My Trades" label is present
- "Open Orders" tab is present
- "All Orders" tab is present
- "Trade History" label is present

---

## TC-03 — Search Currency Pair

**Step 9:** Type `BTC/USDT` (read from CSV `searchPair` column) into the market search input and wait for results to appear.

---

## TC-04 — Mark as Favorite

**Step 10:** Click the star icon next to `BTC/USDT` in the search results to mark it as a favorite.

**Step 11:** Verify the success toast message confirms the pair was **added** to favorites.

---

## TC-05 — Unmark from Favorites

**Step 12:** Click the star icon again next to `BTC/USDT` to unmark it from favorites.

**Step 13:** Verify the status message confirms the pair was **removed** from favorites, and "No records found" is visible in the Favorites tab.

---

## TC-06 — Select Currency Pair

**Step 14:** Click the "ALL" tab in the pair list, find `BTC/USDT`, and click it to activate it as the trading pair. The whole page (order book, ticker, trade form) now shows data for this pair.

---

## TC-07 — Verify 24h Ticker vs Binance

**Step 15:** Simultaneously fetch the 24h ticker data from the page and from the Binance public API for `BTC/USDT`, then verify:
- Page last price is a positive number
- Page last price is within 1% of Binance last price (live price tolerance)
- Page 24h high matches Binance exactly
- Page 24h low matches Binance exactly
- Page 24h base volume is within 1% of Binance base volume
- Page 24h quote volume difference is logged as informational only (exchange counts both sides of each trade, approximately 2× Binance — not a bug)

---

## TC-08 — Order Book Column Headers

**Step 16:** Read the order book column headers and verify all three are visible and non-empty: **Price**, **Amount**, **Total**.

---

## TC-09 — Order Book View Switches

**Step 17:** Switch the order book to "Sell-only" view; verify the order book is still visible.

**Step 18:** Switch to "Buy-only" view; verify the order book is still visible.

**Step 19:** Switch back to "All" view (restoring the default).

---

## TC-10 — Order Book Precision Dropdown

**Step 20:** Cycle through precision values `0.01 → 0.1 → 1 → 0.01` (restoring the default). For each precision, and for each of the three views (all / sell / buy), verify that displayed prices have no more decimal places than the precision allows:
- `0.01` → max 2 decimal places
- `0.1` → max 1 decimal place
- `1` → max 0 decimal places

Restore to "All" view at `0.01` precision at the end.

---

## TC-11 — Order Book LTP and Buy/Sell Ratio Bar (Suggestions)

**Step 21:** Attempt to read the Last Traded Price (LTP) from the order book mid-row. Record as a **suggestion** that LTP display is not yet implemented. No assertion failure.

**Step 22:** Attempt to read the buy % and sell % ratio bar values. Record as a **suggestion** that the ratio bar is not yet implemented. No assertion failure.

---

## TC-12 — Order Book Has Real Data Rows

**Step 23:** Count the ask rows and bid rows in the order book, read the top ask price and top bid price. Verify:
- Ask row count > 0
- Bid row count > 0
- Top ask price > 0
- Top bid price > 0

---

## TC-13 — Valid Spread

**Step 24:** Read the top bid and top ask prices. Verify that top bid < top ask (a valid market spread exists).

---

## TC-14 — Bid/Ask vs Binance within 0.5%

**Step 25:** Simultaneously fetch the top bid/ask from the page and from the Binance order book API. Verify:
- Page top bid is within 0.5% of Binance top bid
- Page top ask is within 0.5% of Binance top ask

---

## TC-15 — Order Book LTP vs Binance within 0.5%

**Step 26:** Simultaneously read the page order book LTP and the Binance 24h last price. Verify the LTP is positive and within 0.5% of the Binance last price.

---

## TC-16 — Precision Toggle Restores LTP

**Step 27:** Read the current order book precision. Switch to an alternate precision (e.g., `0.1` if current is `0.01`, or vice versa). Wait briefly, then restore the original precision. Verify the order book LTP is still a positive number after the toggle.

---

## TC-17 — Order Book Ask Rows Pre-Fill Buy Form

**Step 28:** Click the Buy tab, then click the Limit tab to activate the Buy Limit form.

**Step 29:** Click each of the top 5 ask rows in the order book one at a time. After each click, verify that the Price input field shows the row's price and the Amount input field is filled. Verify all 5 rows pass the price and amount fill check.

---

## TC-18 — Buy Button Label

**Step 30:** Read the text on the Buy button. Verify it contains "BUY" and the base coin name (e.g., "BUY BTC").

---

## TC-19 — Sell Tab Available Balance

**Step 31:** Switch to the Sell tab. Read the "Available" balance shown for the base coin (BTC). Verify it is ≥ 0.

---

## TC-20 — 25% Button

**Step 32:** Switch back to the Buy tab and click the Limit tab. Enter the limit price of `57000` in the price field. Click the **25%** button. Verify the total field is filled with a positive value close to 25% of the available USDT balance (within 5% tolerance).

---

## TC-21 — 50% Button

**Step 33:** Click the **50%** button (limit price `57000` already set). Verify the total field is filled close to 50% of the available USDT balance (within 5% tolerance).

---

## TC-22 — 75% Button

**Step 34:** Click the **75%** button. Verify the total field is filled close to 75% of the available USDT balance (within 5% tolerance).

---

## TC-23 — 100% Button

**Step 35:** Click the **100%** button. Verify the total field is filled close to 100% of the available USDT balance (within 5% tolerance).

---

## TC-24 — Pair Header Shows Selected Pair

**Step 36:** Read the pair header/title shown above the order form. Verify it contains "BTC" or "BTC/USDT".

---

## TC-25 — Capture Pre-Order Balance Snapshot

**Step 37:** Navigate to the **Portfolio → Spot** page and capture a full balance snapshot including:
- Available USDT balance (buy side)
- Available BTC balance (sell side)
- Portfolio spot balances for both USDT and BTC
- Funds balances for both USDT and BTC

Navigate back to the Spot Trading page. Verify the buy available balance (USDT) is ≥ 0 and matches the portfolio USDT spot balance.

---

## TC-26 — Enter Limit Order Details and Verify Estimated Fee

**Step 38:** Click the Buy tab and Limit tab to activate the Buy Limit form. Enter the limit price `57000` USDT and total `8` USDT (values from CSV `buyLimitPrice` and `total` columns).

**Step 39:** Read the estimated fee shown on the form. Calculate the expected fee as:
`total / price × price × feePercent ÷ 100` (feePercent `0.15%` from CSV).
Verify the UI estimated fee matches the calculated fee.

---

## TC-27 — Total Field Auto-Calculates

**Step 40:** Read the current price and amount fields. Verify the Total field value equals price × amount within 1% tolerance.

---

## TC-28 — Fetch Available Balance Before Order

**Step 41:** Read and log the current USDT available balance (from the snapshot captured in TC-25). Verify it is ≥ 0. This is the baseline for the post-order comparison.

---

## TC-29 — Confirm Buy Order and Verify Success

**Step 42:** Check if the text "Insufficient balance" is visible on the form within 2 seconds.
- If **YES** → mark order as failed, record a soft failure with the message "Insufficient balance — top up and re-run", and stop this test. All dependent tests will be skipped.

**Step 43:** If balance is sufficient → click the **BUY BTC** button to submit / open the confirmation dialog.

**Step 44:** In the confirmation dialog, read the executed price, executed amount, and order ID. Click **Confirm** to finalize the order.

**Step 45:** Wait for the success message/toast. Verify the message contains "success", "created", "placed", or "status:".

**Step 46:** Fetch the current Binance market price to detect whether the limit price (`57000`) is above the market price — if so, the order fills immediately; otherwise it remains pending.

---

## TC-30 — Balance Snapshot After Placing Order

> Skipped if TC-29 failed.

**Step 47:** Navigate to Portfolio and capture a new full balance snapshot.

**Step 48:** Compare the before-snapshot (TC-25) vs the after-snapshot:
- If the order is **pending** (limit price below market): verify USDT available balance decreased by the order total (`8` USDT), locked in inOrder.
- If the order **filled immediately** (limit price above market): verify USDT decreased and BTC increased by the correct amounts within 0.5% tolerance.

---

## TC-31 — Market Trades Panel Headers

**Step 49:** Click the **Market Trades** tab in the bottom panel. Read the column headers. Verify they include "price", "amount" (or "qty"), and "time".

---

## TC-32 — My Trades Panel Headers

**Step 50:** Click the **My Trades** tab. Read its column headers. Verify they include "price", "amount" (or "qty"), and "time". Switch back to the Market Trades tab.

---

## TC-33 — Market Trades Has Real Data Rows

**Step 51:** Read the data rows in the Market Trades panel. Verify:
- At least 1 row exists
- The first row's price is positive
- The first row's amount is positive
- The first row has a non-empty time string

---

## TC-34 — Market Trades Prices Match Binance within 1%

**Step 52:** Simultaneously read the Market Trades rows from the page and fetch the 20 most recent trades from the Binance API. Verify the most recent page trade price is within 1% of the Binance most recent trade price.

---

## TC-35 — Open Orders Section Visible

**Step 53:** Read the Open Orders section. Verify the "Open Orders" tab text is present and the "View All" button is present.

---

## TC-36 — Open Orders Shows the Placed Buy Limit Order

> Skipped if TC-29 failed.

**Step 54:** If the order filled immediately (limit price was above market), log a suggestion that no pending entry appears in Open Orders and skip assertions.

**Step 55:** Otherwise, open the **Open Orders** tab and verify the latest order row shows:
- Pair contains "BTCUSDT"
- Type contains "limit"
- Side contains "Buy New"
- Price > 0 (approximately `57000`)
- Amount > 0
- Filled = 0
- Remaining > 0
- Stop Limit = "-"
- Cancel button is present (confirming the order is pending and cancellable)

---

## TC-37 — All Orders Shows the Placed Buy Limit Order

> Skipped if TC-29 failed.

**Step 56:** Open the **All Orders** tab and find the latest row. Verify:
- Pair contains "BTCUSDT"
- Type contains "limit"
- Side contains "Buy New"
- Limit price field > 0
- If **pending**: status matches `new`/`pending`/`open`, filled = 0, remaining > 0
- If **immediately filled**: status matches `done`/`filled`/`complete`, filled > 0

---

## TC-38 — Available Balance Decreases After Order

> Skipped if TC-29 failed.

**Step 57:** Read the All Orders total for the placed order. Verify it does not exceed the entered total (`8` USDT) by more than 0.1%, and the percentage difference is less than 6%. Verify the current buy available balance (USDT) has decreased by the locked amount.

---

## TC-39 — Trade History Shows the Placed Order (Skipped if Pending)

> Skipped if TC-29 failed.

**Step 58:** Open the **Trade History** tab and search for the order by order ID.
- If **not found** → log a suggestion ("order is still pending — Trade History only shows executed trades") and skip assertions.

**Step 59:** If found, verify:
- Pair contains "BTCUSDT"
- Side contains "buy"
- Executed price > 0
- Amount > 0
- Total > 0
- Fee ≥ 0
- Date/time is within 60 seconds of when the order was placed

---

## TC-40 — Trade History Bottom Tab Shows the Placed Order

> Skipped if TC-29 failed.

**Step 60:** Read the first row of the Trade History widget at the bottom of the trading page. If the first row's order ID does not match the placed order, log a suggestion (order still pending) and skip assertions.

**Step 61:** If the row matches, verify:
- Pair references "BTC" or "BTCUSDT"
- Side contains "buy"
- Price is positive

---

## TC-41 — Cancel Latest Open Order

> Skipped if TC-29 failed.

**Step 62:** If the order filled immediately, log a suggestion that there is nothing to cancel and skip.

**Step 63:** Otherwise, click **Cancel** on the first row in Open Orders; confirm the cancel in the modal; verify the success toast confirms cancellation and the USDT balance is restored.

---

## TC-42 — Full Balance Snapshot After Cancel

> Skipped if TC-29 failed.

**Step 64:** If the order filled immediately, skip.

**Step 65:** Navigate to Portfolio and capture a new balance snapshot. Verify:
- USDT available balance has been restored (inOrder returns to 0)
- BTC balance unchanged (no trade took place)
- All differences are within 0.5% tolerance

---

## TC-43 — Snapshot Before Multi-Order Cancel All Test

> Skipped if TC-29 failed.

**Step 66:** Navigate to Portfolio and capture a full balance snapshot before placing multiple pending orders. Verify both USDT available balance and BTC available balance are ≥ 0. This snapshot is the baseline for the Cancel All balance restoration check.

---

## TC-44 — Place 1st Pending Buy Limit Order

> Skipped if TC-29 failed.

**Step 67:** Enter limit price `55000` USDT and total `10` USDT (from CSV `buyLimitPrice2`/`buyLimitTotal2`). Click BUY BTC and confirm. Verify success message contains "success".

**Step 68:** Verify in All Orders that the order status is `new`/`pending`/`open`. Verify Open Orders shows ≥ 1 pending row. Verify the order does NOT appear in Trade History. Verify USDT available balance decreased by the locked amount.

---

## TC-45 — Place 2nd Pending Buy Limit Order

> Skipped if TC-44 failed.

**Step 69:** Enter limit price `54000` USDT and total `8` USDT (from CSV `buyLimitPrice3`/`buyLimitTotal3`). Click BUY BTC and confirm. Verify success message contains "success".

**Step 70:** Verify All Orders status is `new`/`pending`/`open`. Verify Open Orders shows ≥ 2 rows. Verify order is NOT in Trade History. Verify USDT available balance decreased by the locked amount.

---

## TC-46 — Place 3rd Pending Buy Limit Order

> Skipped if TC-44 failed.

**Step 71:** Enter limit price `53000` USDT and total `7` USDT (from CSV `buyLimitPrice4`/`buyLimitTotal4`). Click BUY BTC and confirm. Verify success message contains "success".

**Step 72:** Verify All Orders status is `new`/`pending`/`open`. Verify Open Orders shows ≥ 3 rows. Verify order is NOT in Trade History. Verify USDT available balance decreased by the locked amount.

---

## TC-47 — Place 4th Pending Buy Limit Order

> Skipped if TC-44 failed.

**Step 73:** Enter limit price `52000` USDT and total `9` USDT (from CSV `buyLimitPrice5`/`buyLimitTotal5`). Click BUY BTC and confirm. Verify success message contains "success".

**Step 74:** Verify All Orders status is `new`/`pending`/`open`. Verify Open Orders shows ≥ 4 rows. Verify order is NOT in Trade History. Verify USDT available balance decreased by the locked amount.

---

## TC-48 — Place 1st Pending Sell Limit Order (for Cancel All)

> Skipped if TC-44 failed.

**Step 75:** Switch to the Sell tab and Limit tab. Enter limit price `72000` USDT and amount `0.00011` BTC (from CSV `cancelAllSellPrice1`/`cancelAllSellAmount1`). Click SELL BTC and confirm. Verify success message contains "success".

**Step 76:** Verify All Orders status is `new`/`pending`/`open`. Verify Open Orders shows ≥ 5 rows. Verify order is NOT in Trade History. Verify BTC available balance decreased by the locked amount.

---

## TC-49 — Place 2nd Pending Sell Limit Order (for Cancel All)

> Skipped if TC-44 failed.

**Step 77:** Enter limit price `73000` USDT and amount `0.00012` BTC (from CSV `cancelAllSellPrice2`/`cancelAllSellAmount2`). Click SELL BTC and confirm. Verify success message contains "success".

**Step 78:** Verify All Orders status is `new`/`pending`/`open`. Verify Open Orders shows ≥ 6 rows. Verify order is NOT in Trade History. Verify BTC available balance decreased by the locked amount.

---

## TC-50 — Open Orders Shows All 6 Pending Orders

> Skipped if TC-44 failed.

**Step 79:** Open the Open Orders tab and verify all 6 pending orders are shown (4 buy + 2 sell). Verify the **Cancel All** button is visible.

---

## TC-51 — Balance Shows Buy and Sell Orders Locked in inOrder

> Skipped if TC-44 failed.

**Step 80:** Navigate to Portfolio and compare the current balance against the pre-multi-order snapshot (TC-43). Verify:
- USDT inOrder has increased by the sum of all 4 buy order totals (approximately `10 + 8 + 7 + 9 = 34` USDT)
- BTC inOrder has increased by the sum of all 2 sell order amounts (approximately `0.00011 + 0.00012 = 0.00023` BTC)

---

## TC-52 — Trade History Does NOT Show Pending Orders

> Skipped if TC-44 failed.

**Step 81:** Click the **Trade History** tab. Log the number of rows visible. Verify (informational, no assertion failure) that the pending limit orders placed in TC-44 through TC-49 do not appear in Trade History — only executed trades appear there.

---

## TC-53 — Cancel One Order Individually

> Skipped if TC-44 failed.

**Step 82:** Click the **Open Orders** tab. Click the **Cancel** button on the first row in Open Orders. Confirm the cancel in the modal. Verify the success toast confirms the individual cancellation.

---

## TC-54 — 5 Orders Remain After Individual Cancel

> Skipped if TC-44 failed.

**Step 83:** Click the Open Orders tab again and count the remaining rows. Verify at least 5 rows remain (6 placed minus 1 cancelled).

---

## TC-55 — Cancel All Removes All Remaining Orders

> Skipped if TC-44 failed.

**Step 84:** Click the **Cancel All** button in the Open Orders section. Confirm in the modal. Verify the success toast contains "All order cancelled successfully".

---

## TC-56 — Open Orders Shows "No data" After Cancel All

> Skipped if TC-44 failed.

**Step 85:** Verify Open Orders shows "No data" text and the row count is 0.

---

## TC-57 — All Orders Shows Cancelled Status

> Skipped if TC-44 failed.

**Step 86:** Open the **All Orders** tab. Verify the most recent order row shows a cancelled/done status with red color text.

---

## TC-58 — Trade History Does Not Show Cancelled Pending Orders

> Skipped if TC-44 failed.

**Step 87:** Open the **Trade History** tab. Log the row count. Verify (informational, no assertion failure) that the cancelled pending orders do not appear here — cancelled unfilled orders are never recorded in Trade History.

---

## TC-59 — Balance Fully Restored After Cancel All

> Skipped if TC-44 failed.

**Step 88:** Navigate to Portfolio and capture a new balance snapshot. Compare against the pre-multi-order snapshot (TC-43). Verify:
- USDT available balance restored (inOrder returns to 0) within 0.5% tolerance
- BTC available balance restored (inOrder returns to 0) within 0.5% tolerance

---

## TC-60 — Snapshot Before Above-Market Order

> Skipped if TC-29 failed.

**Step 89:** Navigate to Portfolio and capture a full balance snapshot before placing the above-market buy. Verify USDT available balance is ≥ 0.

---

## TC-61 — Place Buy Limit Order Above Market Price

> Skipped if TC-29 failed.

**Step 90:** Switch to the Buy Limit form. Enter limit price `70000` USDT and total `7` USDT (from CSV `aboveMarketLimitPrice`/`aboveMarketTotal`). Click BUY BTC and confirm.

**Step 91:** Verify success message contains "success" or "created". Verify the executed price is ≤ the limit price of `70000` (the order fills at the best available market ask, which is below `70000`).

---

## TC-62 — Above-Market Order is NOT in Open Orders

> Skipped if TC-29 failed.

**Step 92:** Open the **Open Orders** tab. Verify the above-market order is absent or shows as filled — it should not appear as a pending/cancellable entry since it filled immediately.

---

## TC-63 — All Orders Shows Correct Details for Above-Market Order

> Skipped if TC-29 failed.

**Step 93:** Open the **All Orders** tab. Find the row for the above-market order. Verify:
- Limit price field > 0 (approximately `70000`)
- Executed price > 0
- Status shows "Done" (green color)
- Side contains "Buy Full"

---

## TC-64 — Trade History Shows the Above-Market Buy Order

> Skipped if TC-29 failed.

**Step 94:** Open the **Trade History** tab. Find the row matching the above-market order ID.
- If not found → log a suggestion ("order may still be processing") and skip assertions.

**Step 95:** If found, verify:
- Side contains "buy"
- Executed price > 0
- Amount > 0
- Total > 0

---

## TC-65 — My Trades Shows Executed Market Price (Not Limit Price)

> Skipped if TC-29 failed.

**Step 96:** Click the **My Trades** tab. Verify at least 1 entry exists. For the most recent entry verify:
- Executed price > 0
- Amount > 0
- Executed price is **less than** the limit price `70000` (the market filled at the actual ask, not the limit)
- Executed price is within 1% of the confirmed executed price from the order dialog

---

## TC-66 — Balance After Above-Market Fill

> Skipped if TC-29 failed.

**Step 97:** Navigate to Portfolio and capture a new balance snapshot. Compare against the pre-above-market snapshot (TC-60). Verify:
- USDT available balance decreased by approximately `executedPrice × amount` within 0.5% tolerance
- BTC available balance increased by approximately `amount` within 0.5% tolerance

---

## TEARDOWN — After All Tests

**Step 98:** Close the browser.

---

## Quick Reference Summary

| Step Range | Area |
|---|---|
| 1 – 6 | Browser launch, login, dismiss dialogs |
| 7 | Navigate to Spot Trading page |
| 8 | Verify all page labels |
| 9 | Search for BTC/USDT currency pair |
| 10 – 11 | Mark pair as favorite, verify added |
| 12 – 13 | Unmark pair from favorites, verify removed |
| 14 | Select pair from ALL tab |
| 15 | Verify 24h ticker vs Binance |
| 16 | Verify order book column headers |
| 17 – 19 | Order book view switches (sell / buy / all) |
| 20 | Order book precision dropdown across all views |
| 21 – 22 | Order book LTP and ratio bar (suggestions) |
| 23 – 24 | Order book real rows and valid spread |
| 25 | Order book bid/ask vs Binance within 0.5% |
| 26 | Order book LTP vs Binance within 0.5% |
| 27 | Precision toggle restores LTP |
| 28 – 29 | Order book ask rows pre-fill buy form (5 rows) |
| 30 | Buy button label correct |
| 31 | Sell tab available BTC balance non-negative |
| 32 – 35 | 25% / 50% / 75% / 100% percentage buttons |
| 36 | Pair header shows selected pair |
| 37 | Capture pre-order full balance snapshot |
| 38 – 39 | Enter limit price 57000 / total 8 USDT, verify estimated fee |
| 40 | Total field auto-calculates as price × amount |
| 41 | Fetch USDT available balance before order |
| 42 – 46 | Confirm buy order, detect fill, verify success |
| 47 – 48 | Balance snapshot after order (pending lock or immediate fill) |
| 49 | Market Trades panel headers |
| 50 | My Trades panel headers |
| 51 | Market Trades has real data rows |
| 52 | Market Trades prices vs Binance within 1% |
| 53 | Open Orders section visible with View All button |
| 54 – 55 | Open Orders row matches placed order |
| 56 | All Orders row matches placed order |
| 57 | USDT balance decreases by order total |
| 58 – 59 | Trade History tab validation |
| 60 – 61 | Trade History bottom widget validation |
| 62 – 63 | Cancel latest open order, verify balance restored |
| 64 – 65 | Full balance snapshot after cancel |
| 66 | Snapshot before multi-order Cancel All test |
| 67 – 68 | 1st pending buy at 55000 USDT / 10 USDT total |
| 69 – 70 | 2nd pending buy at 54000 USDT / 8 USDT total |
| 71 – 72 | 3rd pending buy at 53000 USDT / 7 USDT total |
| 73 – 74 | 4th pending buy at 52000 USDT / 9 USDT total |
| 75 – 76 | 1st pending sell at 72000 USDT / 0.00011 BTC |
| 77 – 78 | 2nd pending sell at 73000 USDT / 0.00012 BTC |
| 79 | Open Orders shows all 6 rows + Cancel All button |
| 80 | Balance shows USDT and BTC locked in inOrder |
| 81 | Trade History does not show pending orders |
| 82 | Cancel one order individually |
| 83 | 5 orders remain after individual cancel |
| 84 | Cancel All removes all remaining orders |
| 85 | Open Orders shows "No data" |
| 86 | All Orders shows cancelled status (red) |
| 87 | Trade History does not show cancelled orders |
| 88 | Balance fully restored after Cancel All |
| 89 | Snapshot before above-market order |
| 90 – 91 | Place above-market buy at 70000 USDT / 7 USDT total |
| 92 | Above-market order not in Open Orders |
| 93 | All Orders shows Done (green) for above-market order |
| 94 – 95 | Trade History shows above-market buy |
| 96 | My Trades shows executed market price, not limit price |
| 97 | Balance after above-market fill: USDT down, BTC up |
| 98 | Close browser |
