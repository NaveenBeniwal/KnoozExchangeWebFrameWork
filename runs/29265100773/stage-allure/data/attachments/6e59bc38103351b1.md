# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: portfolio/coinDetail.spec.ts >> Portfolio Module — Coin Detail Page >> Resources section shows Whitepaper and Official Website links @sanity
- Location: tests/portfolio/coinDetail.spec.ts:316:1

# Error details

```
Error: ETHEREUM — link (searched exact text: "Official website")
  RESOURCES heading visible : true

expect(received).toBe(expected) // Object.is equality

Expected: "visible"
Received: "not visible"
```

```
Error: BNB — link (searched exact text: "Whitepaper")
  RESOURCES heading visible : true

expect(received).toBe(expected) // Object.is equality

Expected: "visible"
Received: "not visible"
```

```
Error: BNB — link (searched exact text: "Official website")
  RESOURCES heading visible : true

expect(received).toBe(expected) // Object.is equality

Expected: "visible"
Received: "not visible"
```

# Test source

```ts
  243 |         // Swap in CoinMarketCap's volume when available; keep CoinGecko for market cap/circulating supply.
  244 |         const live = cgLive && cmcVol ? { ...cgLive, volume24h: cmcVol.volume24h } : cgLive;
  245 | 
  246 |         // ── Live market stats ────────────────────────────────────────────────────
  247 |         for (const stat of LIVE_STATS) {
  248 |             const r = await coinDetailPage.checkMarketStatLiveValue(stat, live, item.displayName);
  249 |             expect.soft(r.nonEmptyStatus, r.nonEmptyMsg).toBe('valid');
  250 |             if (r.hasLiveData) {
  251 |                 expect.soft(r.liveStatus, r.liveMsg).toBe(r.liveExpected);
  252 |             }
  253 |         }
  254 | 
  255 |         // ── Volume (24h) change % — sanity range check only (see method doc) ─────
  256 |         const vcr = await coinDetailPage.checkVolumeChange24hPercent(item.displayName);
  257 |         if (vcr.hasValue) {
  258 |             expect.soft(vcr.sanityStatus, vcr.sanityMsg).toBe('sane');
  259 |         }
  260 | 
  261 |         // ── Popularity rank (admin-assigned, stored in CSV per coin) ─────────────
  262 |         const pr = await coinDetailPage.checkPopularityRank(item.popularity, item.displayName);
  263 |         if (pr.hasExpected) {
  264 |             expect.soft(pr.actualRank, pr.rankMsg).toBe(pr.expectedRank);
  265 |         } else {
  266 |             expect.soft(pr.hasValueStatus, pr.valueMsg).toBe('has value');
  267 |         }
  268 | 
  269 |         await coinDetailPage.goBackToSpot();
  270 |     }
  271 | });
  272 | 
  273 | // ─── Overview text section ────────────────────────────────────────────────────
  274 | 
  275 | test('overview text section is visible and content matches expected text from CSV @sanity', async () => {
  276 |     for (const item of coinData) {
  277 |         await coinDetailPage.goToCoinDetail(item.name);
  278 | 
  279 |         // Act
  280 |         const r = await coinDetailPage.checkOverviewSection(item.displayName);
  281 | 
  282 |         // Assert
  283 |         expect.soft(
  284 |             r.sectionVisible,
  285 |             `${item.displayName} — overview text paragraph (div.scrollportfolio > section.cointdetailPage_tabs_textlineRight > p)`,
  286 |         ).toBe('visible');
  287 | 
  288 |         if (r.sectionVisible === 'visible') {
  289 |             if (item.overviewText.trim().length > 0) {
  290 |                 expect.soft(
  291 |                     r.actualText,
  292 |                     `${item.displayName} — overview text must match the expected value in coinDetailData.csv\n` +
  293 |                     `  Expected (CSV) : "${item.overviewText.trim()}"\n` +
  294 |                     `  Received (page): "${r.actualText}"`,
  295 |                 ).toBe(item.overviewText.trim());
  296 |             } else {
  297 |                 expect.soft(
  298 |                     r.contentStatus,
  299 |                     `${item.displayName} — overview text paragraph should not be empty`,
  300 |                 ).toBe('has content');
  301 | 
  302 |                 if (r.contentStatus === 'has content') {
  303 |                     const rowIndex = coinData.indexOf(item);
  304 |                     CsvHelper.updateRow('src/data/coinDetailData.csv', rowIndex, 'overviewText', r.actualText);
  305 |                     console.log(`[CoinDetail] "${item.displayName}" overview text captured to CSV (row ${rowIndex})`);
  306 |                 }
  307 |             }
  308 |         }
  309 | 
  310 |         await coinDetailPage.goBackToSpot();
  311 |     }
  312 | });
  313 | 
  314 | // ─── Resources section ────────────────────────────────────────────────────────
  315 | 
  316 | test('Resources section shows Whitepaper and Official Website links @sanity', async () => {
  317 |     test.setTimeout(90000);
  318 | 
  319 |     for (const item of coinData) {
  320 |         await coinDetailPage.goToCoinDetail(item.name);
  321 | 
  322 |         // Act: scroll + collect all three states in one call
  323 |         const r = await coinDetailPage.checkResourcesSection(item.displayName);
  324 | 
  325 |         // Assert: each error message shows the other two elements for context
  326 |         expect.soft(
  327 |             r.sectionVisible,
  328 |             `${item.displayName} — section heading (searched exact text: "RESOURCES")\n` +
  329 |             `  Whitepaper link visible  : ${r.whitepaperVisible === 'visible'}\n` +
  330 |             `  Official website visible : ${r.websiteVisible === 'visible'}`,
  331 |         ).toBe('visible');
  332 | 
  333 |         expect.soft(
  334 |             r.whitepaperVisible,
  335 |             `${item.displayName} — link (searched exact text: "Whitepaper")\n` +
  336 |             `  RESOURCES heading visible : ${r.sectionVisible === 'visible'}`,
  337 |         ).toBe('visible');
  338 | 
  339 |         expect.soft(
  340 |             r.websiteVisible,
  341 |             `${item.displayName} — link (searched exact text: "Official website")\n` +
  342 |             `  RESOURCES heading visible : ${r.sectionVisible === 'visible'}`,
> 343 |         ).toBe('visible');
      |           ^ Error: BNB — link (searched exact text: "Official website")
  344 | 
  345 |         await coinDetailPage.goBackToSpot();
  346 |     }
  347 | });
  348 | 
  349 | // ─── Whitepaper link opens in new tab ─────────────────────────────────────────
  350 | 
  351 | test('clicking Whitepaper opens the document in a new browser tab', async () => {
  352 |     test.setTimeout(120000);
  353 | 
  354 |     for (const item of coinData) {
  355 |         await coinDetailPage.goToCoinDetail(item.name);
  356 |         await coinDetailPage.scrollToResources();
  357 | 
  358 |         const isVisible = await coinDetailPage.isWhitepaperLinkVisible();
  359 |         expect.soft(
  360 |             isVisible ? 'visible' : 'not visible',
  361 |             `${item.displayName} — link (searched exact text: "Whitepaper") should be visible on the Resources section`,
  362 |         ).toBe('visible');
  363 |         if (!isVisible) {
  364 |             await coinDetailPage.goBackToSpot();
  365 |             continue;
  366 |         }
  367 | 
  368 |         // Act
  369 |         const r = await coinDetailPage.checkWhitepaperTab(item.whitepaperUrlContains, item.displayName);
  370 | 
  371 |         // Assert
  372 |         expect.soft(r.tabOpened,  r.tabOpenedMsg).toBe('opened');
  373 |         if (r.hasUrlFragment) {
  374 |             expect.soft(r.urlMatches, r.urlMatchesMsg).toBe('correct url');
  375 |         }
  376 |         if (!r.isPdf) {
  377 |             expect.soft(r.titleStatus, r.titleMsg).toBe('has title');
  378 |         }
  379 | 
  380 |         await coinDetailPage.goBackToSpot();
  381 |     }
  382 | });
  383 | 
  384 | // ─── Official Website link opens in new tab with correct coin branding ────────
  385 | 
  386 | test('clicking Official Website opens the correct coin site in a new tab with its own favicon', async () => {
  387 |     test.setTimeout(120000);
  388 | 
  389 |     for (const item of coinData) {
  390 |         await coinDetailPage.goToCoinDetail(item.name);
  391 |         await coinDetailPage.scrollToResources();
  392 | 
  393 |         const isVisible = await coinDetailPage.isOfficialWebsiteLinkVisible();
  394 |         expect.soft(
  395 |             isVisible ? 'visible' : 'not visible',
  396 |             `${item.displayName} — link (searched exact text: "Official website") should be visible on the Resources section`,
  397 |         ).toBe('visible');
  398 |         if (!isVisible) {
  399 |             await coinDetailPage.goBackToSpot();
  400 |             continue;
  401 |         }
  402 | 
  403 |         // Act
  404 |         const r = await coinDetailPage.checkOfficialWebsiteTab(
  405 |             item.officialWebsiteContains,
  406 |             item.websiteTitleContains,
  407 |             item.displayName,
  408 |         );
  409 | 
  410 |         // Assert
  411 |         expect.soft(r.tabOpened,  r.tabOpenedMsg).toBe('opened');
  412 |         if (r.hasUrlDomain) {
  413 |             expect.soft(r.urlMatches, r.urlMatchesMsg).toBe('correct site');
  414 |         }
  415 |         expect.soft(r.hasTitle, r.hasTitleMsg).toBe('has title');
  416 |         if (r.hasTitleFragment) {
  417 |             expect.soft(r.titleMatches, r.titleMatchesMsg).toBe('correct title');
  418 |         }
  419 |         expect.soft(r.hasFavicon, r.hasFaviconMsg).toBe('has favicon');
  420 |         if (r.hasOwnFaviconCheck) {
  421 |             expect.soft(
  422 |                 r.ownFaviconStatus,
  423 |                 r.ownFaviconMsg,
  424 |             ).toBe(`coin domain favicon (${item.officialWebsiteContains.toLowerCase()})`);
  425 |         }
  426 | 
  427 |         await coinDetailPage.goBackToSpot();
  428 |     }
  429 | });
  430 | 
  431 | });
  432 | 
```