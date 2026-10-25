# Top 5 refactors for torn-war-overlay

25 Oct 2026, at v0.30.2. Sources: three code audits in `research_notes/Refactor audit/` (architecture, API layer, tests and fragility), the Torn API v2 OpenAPI spec (v6.13.8), Torn's API page, and the bug history in `CHANGELOG.md`. Claims marked ✔ were re-checked against the code.

## The shape of the problem

The script is one 7,530-line file: 335 functions and 134 shared mutable variables. Three patterns keep producing bugs and risk:

- **Nothing enforces Torn's 100-requests-a-minute limit across the whole script.** Each feature paces itself. Normal use is about 26 a minute on the faction page and 50 on the attack page while hunting. A first faction-page attack backfill can reach about 175–200 a minute in the worst case. The v0.30.1 hit-goal backfill (✔ 6 pages every 5 s) can push the attack page past 100. Torn counts per user, so a hunt tab and a faction tab add together.
- **Every feature reimplements fetch, throttle and error handling.**
  - Nine `refreshX` functions repeat the same guard, in-flight, interval, backoff, try/catch and "unsupported" logic, using about 25 flags.
  - ✔ "API backoff active." is compared as a string in 28 places.
  - ✔ Two of them, at `:1773` and `:6980`, treat any non-retryable error as "this key can't do it", so a single bad reply turns chain or war context off until the page reloads.
- **Recent releases were mostly fixes, and no test caught any of them.** Two root causes recur, four times each:
  - unverified API or wiki semantics: lifetime vs per-step thresholds, hit goals reading 0, Public-key energy, war dots;
  - assumptions about Torn's markup: hidden item lists, dock jump, defeat wording, basket shortcut.

  Faction row rendering, hit goals, basket progress, the chain and war guard, and storage edge cases have no coverage at all. The smoke test takes about 24 s, almost all of it fixed sleeps.

## The five refactors, ranked by impact for the effort

### 1. One request scheduler in `apiGetRaw`: a global per-minute budget with priority lanes

**What:** every request goes through one queue that holds a sliding 60-second window of sends. It allows about 85 requests a minute, leaving headroom for Torn PDA and other scripts. When the window is full, requests wait instead of failing. Three priority lanes decide who goes first:
1. **Live:** attack-page status, faction live polling, chain.
2. **Normal:** treats, wars, goals, own stats.
3. **Background:** hunt scanning and history backfills.

Background work sleeps while live work is waiting. The window is shared across tabs through a `localStorage` timestamp ring, which Torn PDA's tabs share. Diagnostics and the hunt details show the real total a minute, not only hunt requests.

**Why first:** this is the only refactor that cuts account risk. Going over the limit gets the key throttled, which breaks every feature at once in the middle of a war, and the API rules allow misuse to end in a ban. It also removes the per-feature pacing constants, so new features can't add bursts. The hit-goal backfill becomes background work and stays safe automatically.

**Effort:** medium, all in the transport layer (`apiGetRaw`/`apiGet`, about `:900–1115`), with call sites unchanged apart from a lane argument.

### 2. A `resource()` helper and one error policy for every polled endpoint

**What:** replace the nine hand-written refreshers (`refreshOwnChain`, `refreshOwnBars`, `refreshTreats`, `refreshOwnWar`, `refreshHitCounts`, `refreshSelfStats`, `refreshOwnProxy`, `refreshWarContext`, `ensurePrimaryKeyInfo`) with a single helper. It takes the path, query, key, how long a value stays fresh, its lane and a parse function, and gives back the cached value plus `refresh({ force })`, `state` (fresh, stale, unsupported, off) and `error`. One `classifyApiError(err)` decides what an error means, replacing the 28 string compares and the five retry schemes:
- **unsupported:** codes 7 and 16;
- **backoff:** codes 5, 8 and 9, and HTTP 429;
- **bad key:** code 2;
- **transient:** everything else.

The same helper drops the `timestamp` cache-buster on long-lived endpoints (competition, wars, bars, key info) so Torn's 30-second cache can absorb repeats. It also shares the duplicate fetches the audit found: `/faction/wars` twice, `personalstats` with `cat=popular` three times, `/faction/{id}/members` three times.

**Why:** it fixes the session-long "unsupported after one error" bug, removes about 25 globals and a few hundred lines, and makes the next feature, such as an event countdown, a few lines long. It also builds on the scheduler from refactor 1.

**Effort:** medium; it can be done one refresher at a time.

### 3. One attack-log service shared by war dots, attack-page intel and hit goals

**What:** ✔ `/user/attacks` is fetched by three separate pieces of code, at `:4240` (the faction-page history backfill), `:7326` (attack-page ingest) and `:6629` (hit goals). Each has its own query, cursor and store, and two of them repeat the same paging loop. Replace them with one service:
- **One cursor and one store**, with fights deduplicated by ID and kept to a time window.
- **Shared paging:** `from` is exclusive and `to` inclusive, which the spec confirms.
- **Subscribers:** recording opponent intel, war-scope dots and goal tallies all subscribe to it.

The attack page then reads new fights once instead of twice, and hit goals stop needing their own backfill.

**Why:** the attack log is the single most important data source, feeding personal Fair Fight, verdicts, war dots and goals. Today, fixing it means fixing it in three places, and each copy has its own blind spots, such as the war dots dropping losses (fixed in v0.22.1). It also cuts requests on every page.

**Effort:** medium; do it after 1 and 2.

### 4. A testable core: a test hook, node unit tests and a fake clock

**What:**
- **Test hook:** expose the pure functions on a `__TWO_TEST__` object, but only when the smoke harness sets a flag, so there is no runtime cost and no build step.
- **Unit tests:** add a table-driven `tools/unit-tests.mjs` (`node --test`) for basket progress, `halloweekWindow`, goal pacing, the chain bonus table, the finish hint, `normalizeRankedWar`, the hunt classifier and the strength and verdict maths.
- **Separate logic from fetching:** split hit goals into a pure `applyAttackPage(state, attacks)` and `hitGoalView(state, now)`, so recorded `/user/attacks` replies can be replayed as fixtures.
- **Fake clock:** inject a clock into the smoke harness and replace the `waitMs` sleeps (up to 6.5 s each) with `advance(ms)`, taking the run from about 24 s to about 2 s.

**Why:** three of the last five regressions were pure maths or semantics on data the overlay already had: basket thresholds, goal baselines and day maths. Table tests with real numbers from the game, like your basket page's "100 / 250" and the TCT ladder, would have caught them before release. A fast suite also gets run.

**Effort:** low for the test hook and unit tests, medium for the clock. The `runSelfTests` checks can move into the node suite later.

### 5. One registry of Torn markup assumptions, with a health check

**What:** gather every assumption about Torn's own pages into one `TORN_DOM` block: selectors, attributes, fight-line wording regexes and the `elementsFromPoint` probes. Each entry gets a name and an expected minimum match count. A cheap health check on each page records misses to diagnostics: for example, "attack log `ul[aria-describedby="log-header"]`: 0 matches". It also shows a single Torn PDA toast when a critical entry has been missing for a while.

**The riskiest entries today:**
- `ul[aria-describedby="log-header"]` (`:5607`) is the only trigger for fight results.
- The `[class*="member"]` and `[class*="status"]` substring matches (`:1218`, `:3613`) can hit the wrong nodes.
- The defeat and stalemate wording regexes (`:306–308`).
- The chat-bar hit-testing, which already broke once (v0.24.2).

**Why:** markup assumptions are the other recurring cause of regressions, and so far they fail silently. You found the hidden-list and basket bugs by looking at screenshots. With the registry, a Torn markup change shows up as one clear diagnostic line on day one, and the fix touches one block.

**Effort:** low to medium. It doesn't change behaviour, so it can be done gradually.

## Runners-up, small and worth doing alongside

- **Quick fixes:** ✔ `API_COMMENT = 'two-v0.26.0'` and the duplicate-injection warning hardcode an old version; derive them from `SCRIPT_VERSION`.
- **ToS disclosure:** the README table doesn't mention the second (Limited) key or the hunt pool's purpose in detail. Bring it in line with the code.
- **Render scheduling:** `renderAttackPanel` is a global "something changed" signal with about 28 callers and its own home and dock dispatch. A `requestRender()` that batches into one animation frame per page mode would cut redundant DOM work and untangle the dispatch.
- **Old migrations:** remove v0.15–v0.25 storage migrations whose users have long since migrated, together with their self-tests.
- **v1-style call:** `/faction?selections=members,timestamp` is the only one left; move it to `/faction/{id}/members`.

## Suggested order

Do 1, then 2, then 3, because each builds on the previous. Start 4 in parallel, beginning with the test hook and basket and goal tables, since it makes 1–3 safer to ship. Do 5 whenever a Torn markup change next breaks something.
