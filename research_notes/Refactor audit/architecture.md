# Architecture and state-flow audit (torn-war-overlay.user.js v0.30.2, 7,530 lines)

All line refs are to `torn-war-overlay.user.js`. 335 top-level functions, 134 top-level `let` (193-326, plus scattered 1375-7386).

## 1. Section map

| Lines | ~Size | Subsystem |
|---|---|---|
| 1-192 | 190 | Userscript header, PAGE_MODE (29), dupe guard (42), constants (`API_COMMENT` 51) |
| 193-337 | 145 | Shared mutable state block (mixes API, faction, attack-history, strength, render) |
| 338-906 | 570 | Storage (PDA/localStorage 338-470), settings and filters (517-705), signup/status caches (707-752), API-key mgmt (754-815), diagnostics (817-905) |
| 907-1195 | 290 | API client (`apiGetRaw` 1008, backoff 948-1000), key-info (1119-1170), server clock (1172-1194) |
| 1196-1625 | 430 | Row helpers, age/activity/risk, row sheet (1371-1502), badges, attack-history badge |
| 1626-1799 | 175 | Personal intel math, `refreshSelfStats`, `refreshOwnChain` |
| 1800-2310 | 510 | Strength proxy and worker (`refreshOwnProxy` 2088, `runStrengthWorker` 2261) |
| 2312-2930 | 620 | Attack intel recording, `deriveOpponentIntel` 2422, best target, toolbar (2757) |
| 2930-3600 | 670 | Faction overlay: status model, `renderUser` 3205, countdown tick, DOM-status reconcile, observers, `scanWarRows` 3593 |
| 3689-3935 | 250 | Profile queue and worker |
| 3936-4724 | 790 | Attack-history scope/cache, war context (4081), recent attacks (4200), faction refresh loop, age prefilter |
| 4725-4919 | 195 | PDA bridge, toasts, tools sheet |
| 4920-5158 | 240 | `injectStyles` CSS |
| 5161-5575 | 415 | Discovery, watchdog, pause/resume (5265-5320), `runSelfTests` 5338-5544 (~205) |
| 5546-5701 | 155 | Navigation hooks, attack page state (5584-5606), attack-log observer |
| 5702-7377 | 1,675 | Hunt: state (5733-5755), pool/classify (5757-6000), worker (6103), dock (6352-6560), goals (6578-6711), basket (6713-6779), refreshers (6893-6990), attack panel (7077-7284), attack-page init (7344) |
| 7378-7530 | 150 | Home card, `init` 7469 |

Observation: the hunt subsystem (23% of the file) holds the attack panel, hit goals, basket and treats, because it was grown in place. Faction-overlay code is scattered over 2930-4724 and interleaved with API-refresh plumbing.

## 2. Module-level state and coupling

Computed by counting references per section (A=1-1370, D=1800-4724, E=4725-5575, G=5702-7377, H=home).

Worst 10:
1. `apiKey` (193): 28 refs across 6 sections. Guard in nearly every refresher (1721, 1756, 2089, 6612, 6929, 6969, 6894).
2. `globalBackoffUntil` (196): 31 refs in 5 sections. Written by `registerApiFailure` (948), read by 7+ refreshers and the hunt worker (6109).
3. `apiPermanentlyDisabled` (195): 32 refs, 5 sections. Same guard family as 1-2.
4. `activeFactionId` (201): 41 refs; 33 in the faction block, plus home (2), E (3), A (3).
5. `huntState` (5733): 71 refs (68 in hunt) but also read at 7154 (panel dispatch) and 3 in E/H. Persisted object shared by pool, session, dock, goals.
6. `attackHistoryFeatureState` (311): 18 refs across 5 sections; set to 'unsupported' from the attack page (7338) and the faction page.
7. `apiHealth` / `apiHealthDetail` (214-215): 36 refs across A, D, E (UI indicator and API client).
8. `attackApiKey` (194): 14 refs; passed as `keyOverride` in 5+ callsites (4247, 6631, 7330, 6898).
9. `settings` (326): 23 refs, A heavy; accessed through the helper accessors (638-665) but also directly in D and E.
10. `factionLiveReady` / `lastFreshSnapshotAt` / `lastFreshSnapshotPerfAt` (211-213): written in D, read in E (watchdog), G (hunt) and A.

Also: `strengthUnsupported` (244) is written from the strength worker (2124, 2289) and from the hunt scan (6073), so the hunt reaches into the faction strength flag. `bestTargetUserId` (252) is shared by A, B and D. `ownFactionId` (226) is shared by A, D, G.

Pattern: most "cross-subsystem" state is API-session state (keys, backoff, disable flag, health). It wants one `api` object (`api.key`, `api.backoffUntil`, `api.health`) rather than loose lets. The attack page, hunt and home variables are well separated by name prefix (`attack*`, `hunt*`, `home*`) but not by scope.

## 3. Rendering

- Fully imperative DOM. 113 `document.createElement` calls; `ensureX()` builds once and stashes refs as `panel.__twoName`, `__twoVerdict`, `__twoChain` etc. (about 33 `__two*` assignments); `renderX()` writes into them.
- `setText` / `setClass` (6299-6305) exist to skip redundant DOM writes but are used only in the dock path; `renderAttackPanel` (7153-7206) writes `textContent`/`className` directly (7176-7178), and `renderUser` (3205) uses a signature string (`getUserRenderSignature` 3172) instead. Three different dirty-check strategies (setText, signature, `dataset.twoSignature` at 7194).
- `renderAttackPanel` is a de-facto event bus: 32 references, ~28 call sites (3329, 5661, 6109, 6111, 6115, 6137, 6145, 6176, 6190, 6375, 6431, 6657, 6708, 6817, 6828, 6860, 6889, 6958, 7059, 7111, 7293, 7311, 7337, 7347, 7359-7364). Its first lines (7154-7160) dispatch to `renderHomeCard` on the home page and to `renderHuntDock` when hunt is on, so workers in the hunt layer (6109-6176) and the data refreshers (6657 hit counts, 6958 treats) call a function named for one view to repaint all three. `renderAll` (3333) calls it too (3329).
- Duplication in UI building: the dock (6352-6444), home card (7388-7423) and panel (7077-7150) each hand-build container, link/button, status chip and basket/goal rows. Basket/goal sub-rows are shared via `makeBasketRow` (6745) and `renderGoalLine` (6693), which is the right direction; `makeDockButton` (6337) is dock only. The attack panel's detail rebuild (7192-7205) duplicates the dock's detail builder `renderHuntDetail` (6780).

## 4. Duplicated "refresh X" shape

Shared shape: `guard(apiKey, !apiPermanentlyDisabled, !unsupported) -> in-flight dedupe -> min-interval check vs lastAt (-1000 ms fudge) -> globalBackoffUntil check -> stamp lastAt -> try apiGet -> catch (code 7 or 16 => unsupported = true; 'API backoff active.' silent; else warn)`.

| Function | Lines | Vars (lastAt / inFlight / unsupported) |
|---|---|---|
| refreshSelfStats | 1720 | selfStatsLastFetchedAt / selfStatsInFlight / none |
| refreshOwnChain | 1755 | ownChainLastFetchedAt / none / ownChainUnsupported |
| refreshOwnProxy | 2088 | ownProxyLastFetchedAt / ownProxyInFlight / none (strengthUnsupported separate) |
| refreshWarContext | 4081 | warContextLastCheckedAt / warContextInFlight / warContextState |
| refreshRecentAttacks | 4200 | attackRefreshInFlight / attackHistoryFeatureState |
| refreshHitCounts | 6611 | hitWonAt / hitInFlight / hitUnsupported |
| refreshOwnBars | 6893 | ownBarsLastAt / none / ownBarsUnsupported |
| refreshTreats | 6928 | huntTreatsLastAt / huntTreatsInFlight / huntTreatsOffUntil |
| refreshOwnWar | 6968 | ownWarLastAt / none / ownWarUnsupported |

That is about 9 functions and ~25 state vars for one pattern. The unsupported test is written 3 different ways (`code === 7 || code === 16` at 1773, 6073, 6654, 6981; `!err.retryable` at 1773). A `makeResource({fetch, minMs, key:'attack'|'primary', onUnsupported})` returning `{get, refresh(force), reset}` would collapse most of it and also fix the inconsistent in-flight dedupe (refreshOwnChain/Bars/OwnWar have none).

Attack-log pagination: `/user/attacks` is called at 4240 (paged backfill with `fetchPage`, `to` walking), 6629 (hit goals, nearly identical paging loop with `from/to/limit`), and 7326 (single 25-row page). Query object `{filters:'outgoing', sort:'DESC', limit, from, to, cacheBust:true, keyOverride: attackApiKey}` is rebuilt 3 times; a `fetchOutgoingAttacks({from,to,limit})` and a `pageAttacks(from, to, onPage)` helper would share it. Both paged loops terminate on the same condition (short page / no progress / `oldest >= to`, 4252 vs 6644).

## 5. Dead or stale code

- Unused top-level `const`s: none found (every const is referenced at least twice).
- Stale version strings: duplicate-injection message says "v0.26.0 is already running" (42) and `API_COMMENT = 'two-v0.26.0'` (51) while version is 0.30.2. Comments mention versions throughout (339, 1627, 1801, 4726, 5577, 5703, 6218, 6569, 7379) as history rather than behavior.
- Legacy migrations: signup cache from v0.5 (711-719, `LEGACY_PROFILE_CACHE_STORAGE` 56, also referenced in tools menu 4856); key purge list (723-724: `two.pins.v1`, `attackHistoryCache.v1`, `LEGACY_ATTACK_HISTORY_CACHE_STORAGE` 58, `LEGACY_STRENGTH_CACHE_STORAGE` 64); strength records pre-v0.15/v0.19 (1935, 1998); pre-v0.18.1 Fair Fight (2435); hunt pool v0.23.0 shape (5792) and old downward cursor (5762); hit goals v0.30.0 baselines (6587). `MIGRATED_MARK` localStorage-to-PDA migration (350). All are candidates for removal once users are known to be past those versions. The self-test at 5349 and 5533 asserts legacy paths, so they must go together.
- Basket: only the shortcut was removed. The basket progress/row code is live (6561-6779, CSS 5053+, ~45 references). No leftover shortcut code found.

## 6. CSS

`injectStyles` is 4920-5158, a single template literal of ~238 lines (3% of file) with 123 rules led by `.two-` prefix: roughly 45 `.two-hd*` (hunt dock), 31 `.two-attack*`, 12 `.two-sheet*`; the rest cover the faction overlay, toolbar, badges, tools sheet. Design tokens come first (4925, shared with Market Edge). Concerns mixed: tokens, faction-page rows, attack panel, hunt dock, home card, sheets, and responsive rules (only 2 `@media` blocks, so mobile layout is handled by ad hoc rules). It is injected once for all pages regardless of PAGE_MODE, so the home page loads faction-row CSS and vice versa.

## Top 5 refactors (impact / effort)

1. **`makeResource` helper for the 9 refreshers** (high impact, medium effort): removes ~25 state vars and the three inconsistent unsupported/in-flight/backoff styles.
2. **Single `api` session object** (`key`, `attackKey`, `backoffUntil`, `disabled`, `health`) (high, medium): collapses the top 3 coupling hot spots and makes the smoke test able to reset one object.
3. **Replace `renderAttackPanel` as bus with `requestRender()` that dispatches by PAGE_MODE** (medium-high, low): rename plus one dispatcher; removes the home/dock branches from 7154-7160 and the misleading call sites in workers.
4. **Shared `fetchOutgoingAttacks` / `pageAttacks`** (medium, low): unifies 4240, 6629, 7326 and the termination condition.
5. **Split by page and delete legacy migrations** (medium, low-medium): split CSS per page mode (and inject only what applies), drop pre-v0.25 migrations (711-724, 1935, 1998, 2435, 5762, 5792, 6587) and fix the stale v0.26.0 strings (42, 51). Larger physical split of the 1,675-line hunt section into dock / goals / panel needs a build step, which the project does not have, so do it as internal `const hunt = {...}` namespaces first.
