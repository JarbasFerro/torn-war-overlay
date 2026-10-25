# Torn War Overlay: repo inventory

Scope: read-only inventory of `/Users/jarbas/Documents/ChatGPT/torn-war-overlay` at HEAD `8b1543e` (branch main, clean tree at start). All line numbers refer to `torn-war-overlay.user.js` unless a path is given.

## 1. Version

- Current version: **0.26.0** (`torn-war-overlay.user.js:4` `@version`; `:37` `SCRIPT_VERSION = '0.26.0'`; `:48`-`:49` `API_BASE` and `API_COMMENT = 'two-v0.26.0'`).
- README "Development status" calls v0.26.0 the current release candidate (`README.md:~177`).
- Repo layout: `torn-war-overlay.user.js` (7,016 lines), `README.md` (189), `CHANGELOG.md` (258), `docs/` (GREASY-FORK.md, RESEARCH-2026-09-13.md, RESEARCH-2026-09-14.md, TACTICAL-INTELLIGENCE-ROADMAP.md), `tools/` (smoke-test.mjs, winprob-sim.py).

## 2. User-facing features (function / section : location)

Page routing and boot
- Page mode detection: `PAGE_MODE` (`:25`). Values `faction` (factions.php), `attack` (loader.php, loader2.php, page.php with sid=attack).
- Instance guard `INSTANCE_KEY` (`:21`); top-level `await openTwoStorage()` (`:46`); `init()` (`:6956`), `initAttackPage()` (`:6922`); `installNavigationHooks()` (`:5521`); `startWatchdog()` (`:5234`).

Faction page: target list and rows
- Member-list observation: `observeMembersList` (`:3535`), `scanWarRows` (`:3591`), `renderUser` (`:3203`), `renderAll` (`:3331`).
- Row badges: age `ensureAgeBadge` (`:1502`), activity `ensureActivityBadge` (`:1522`), hospital countdown `ensureHospitalBadge` (`:1538`), attack-history dots `ensureAttackHistoryBadge` (`:1554`) / `renderAttackHistoryBadge` (`:1596`), intel/verdict badge `ensureIntelBadge` (`:2629`) / `renderIntelBadge` (`:2730`).
- `OUT EARLY` label: `noteEarlyExit` (`:3453`), `getEarlyExit` (`:3463`), window `EARLY_EXIT_DISPLAY_MS` (`:188`).
- Live hospital countdowns: `tickCountdowns` (`:3353`), `scheduleCountdownTick` (`:3408`).
- Target classification: `getTargetState` (`:2966`), `getEffectiveStatus` (`:2944`), `getTargetCountsForList` (`:3049`).
- Tap-to-explain row sheet: `ensureRowSheet` (`:1376`), `openRowSheet` (`:1430`), `renderRowSheet` (`:1445`).
- Target toolbar `ALL | TARGETS | FILT | SET`: `ensureTargetToolbar` (`:2755`), `addGroup` (`:2800`), `updateTargetToolbars` (`:3088`), `syncIndicatorText` (`:3066`).
- Filters (match verdict, status, activity, min EV chips): `sanitizeFilters` (`:539`), `currentFilters` (`:551`), `passesFilterSpec` (`:572`), `rowPassesFilters` (`:583`), `toggleFilterValue` (`:596`), `setMinEvFilter` (`:609`), `clearFilters` (`:617`); min-EV options `FILTER_MIN_EV_OPTIONS` (`:187`).
- Chain chip (`BONUS #n`): `refreshOwnChain` (`:1753`), `getChainSnapshot` (`:1782`), `renderChainChip` (`:3147`).
- War context and decay: `refreshWarContext` (`:4079`), `normalizeRankedWar` (`:4047`), `getWarDecayInfo` (`:3136`).
- Verdict model (EASY/GOOD/RISKY/AVOID): `estimateMatchFromProxy` (`:2002`), `verdictFromRatio` (`:2051`), `winProbabilityFromRatio` (`:1850`), `estimateScoreFromProxy` (`:1904`), `rankBandFromInputs` (`:1830`).
- Personal intel (observed Fair Fight, expected score, EV, PROVEN/LIKELY/UNKNOWN/RISK/CHANGED): `recordAttackIntel` (`:2345`), `deriveOpponentIntel` (`:2420`), `describeVerdict` (`:2658`), `describeIntel` (`:2701`).
- `BEST` target: `bestCandidateRank` (`:2582`), `pickBestCandidate` (`:2596`), `computeBestTarget` (`:2609`).
- Leave/Hospitalize hint: `finishHintFor` (`:2202`), `finishHintForUser` (`:2215`).

Attack page
- Floating war panel: `ensureAttackPanel` (`:6657`), `renderAttackPanel` (`:6733`), `renderFinishChip` (`:6787`), `renderEnergyChip` (`:6801`), `renderAttackNext` (`:6815`), `attackPageTick` (`:6864`).
- Fight-result capture: `classifyFightLine` (`:5593`), `scanAttackLog` (`:5624`), `attachAttackLogObserver` (`:5644`), `onAttackFightFinished` (`:6479`), `ingestRecentAttacksOnAttackPage` (`:6898`).
- Hunt mode state and scanner: constants `:5694`-`:5703` (request gap 1.5 s, save throttle, revalidate 90 s, goal min 20); `huntApplyStatus` (`:5812`), `classifyHuntProfile` (`:5841`), `huntPriorityOrder` (`:5876`), `huntConfirmedCount` (`:5888`), `huntAvailableGoal` (`:5898`), `huntRefreshEntry` (`:5905`), `huntNextJob` (`:5938`), `huntScanOne` (`:5978`), `runHuntWorker` (`:6036`), `huntPickNext` (`:6084`), `setHuntEnabled` (`:6120`), `resetHuntCursor` (`:6127`), `huntRecordResult` (`:6222`).
- Hunt dock (bottom-docked panel, `Skip`/`NEXT` button, `HUNT n` pill, minimise `–`): `renderAttackHunt` (`:6135`), `bottomBarTop` (`:6164`), `measureBottomObstruction` (`:6179`), `updateHuntDockOffset` (`:6198`), `ensureHuntDock` (`:6282`), `renderHuntDock` (`:6367`), `renderHuntDetail` (`:6452`) (`Stop hunting` button, details sheet).
- Hunt mode is gated by `huntCanRun()` (`:5973`) and `PAGE_MODE === 'attack'`, visible page and key.

Toasts, tools sheet, diagnostics, settings
- Native Torn PDA toasts: `pdaToast` (`:4758`), `toastOnce` (`:4765`, per-id cooldown). Toast calls seen: storage moved, storage full, energy unreadable, rejected key, no free hunt target (per CHANGELOG 0.26.0).
- Tools sheet (`⋯` on faction toolbar; Torn PDA substitute for menu): `openToolsSheet` (`:4872`), `closeToolsSheet` (`:4867`), `toolActions` (`:4842`). Action groups: Keys (set API key, set attack-history key, clear it), Hunt (on/off, restart scan, clear list), Settings and help (Target rules SET, diagnostics, reset settings), Clear data (cached ages, statuses, attack dots, personal intel memory). Button wiring around `:4898`.
- Userscript menu (desktop): `GM_registerMenuCommand` block at `:895`-`:899` (open tools, plus each `toolActions()` entry).
- Diagnostics: `getDiagnosticSnapshot` (`:815`), `showDiagnosticSnapshot` (`:890`, prompt), `shareDiagnostics` (`:4821`, clipboard in PDA), `diagnosticsLabel` (`:4861`).
- Target rules / settings dialog (`SET`): `openSettingsDialog` (`:664`, prompts for max level and similar), `loadSettings` (`:628`), `saveSettings` (`:632`), `sanitizeSettings` (`:515`), readers `configuredMaxAgeYears` (`:640`), `configuredGreenHospitalSec` (`:644`), `configuredYellowHospitalSec` (`:648`), `configuredMaxLevel` (`:652`), `allowIdleTargets` (`:660`), `intelEnabled` (`:624`).
- Self-tests: `runSelfTests` (`:5313`), run from `init()` at `:6959`.
- Styles: `injectStyles` (`:4917`).

Torn PDA integration (v0.26)
- `pdaCall` (`:4740`, 3 s timeout, `PDA_CALL_TIMEOUT_MS` `:4732`), `pollPdaTabState` (`:4789`), `startPdaTabStatePolling` (`:4816`), `onPdaVisibilityChanged` (`:4778`), `PDA_TAB_POLL_MS = 2000` (`:4733`). Pauses work when the PDA tab is not active.

## 3. Torn API endpoints and selections

Base: `https://api.torn.com/v2` (`:48`). Only `@connect api.torn.com` (`:14`) is declared. Key is appended as a query parameter (`buildApiUrl`, `:910`; `includeKey` in `apiGetRaw` `:1018`-`:1019`), or sent through `PDA_httpGet` headers.

Key and capability checks
- `GET /key/info` (`:1125`, `:1140`) via `apiGet`; selection test `keyInfoAllowsUserSelection` (`:1117`).
- `GET /user/basic` (`:5966`); `GET /user/{id}/basic` (`:6619`).

Own user
- `GET /user/battlestats` (`:1730`, uses attack key when set).
- `GET /user/personalstats?cat=popular` (`:2097`).
- `GET /user/profile` (`:2103`).
- `GET /user/bars` (`:6565`, energy; uses attack key).
- `GET /user/attacks` with `filters=outgoing`, `sort=DESC`, `from` window (`:4238` for scope fetch, `:6904` for attack-page ingest, `from = now - 6h`, `limit 25`).

Faction
- `GET /faction/chain` (`:1759`).
- `GET /faction/wars` (`:4093`).
- `GET /faction/warfareranked` with `sort=DESC`, `limit=100`, `from = now - 7d` (`:4104`).
- `GET /faction` with `selections=members,timestamp&id=` (`:4475`).
- `GET /faction/{id}/members` (`:4488`, `:5912`, `:6535`).
- `GET /faction/timestamp` (`:4489`, `:6929`).
- `GET /user/{id}/faction` (`:3920`, active faction fallback).

Opponents and targets
- `GET /user/{id}/profile` (`:2237`, `:3822`, `:5920`, `:5984`, `:6529`).
- `GET /user/{id}/personalstats?cat=popular` (`:2230`, `:6004`).
- `GET /user/search` with `filters` and `offset`, cache-busted (`:4637`), used by the young-account prefilter.

Hunt mode (`huntApiGet` `:5958` wraps `apiGet`)
- Uses `/faction/{id}/members`, `/user/{id}/profile`, `/user/{id}/personalstats?cat=popular`, `/user/basic`.

Note: `:2097`/`:2103` are the own-stats path and `:2230`/`:2237` are the opponent path.

## 4. Storage

Backends
- Torn PDA: `PDA_storage` (`:359`), per-script SQLite store, 10 MB default (`:339` comment). Loaded once at start, writes batched (`:406`, `:429`, debounce 400 ms / 5 s), flushed on `pagehide` and hidden visibility (`:435`-`:436`).
- Fallback: `localStorage` (`:351`-`:355`). First-run migration of `localStorage` keys into `PDA_storage` with read-back before removal (`:346`-`:392`, marker `two.__migratedFromLocalStorage` `:348`).
- Tampermonkey: no `GM_getValue`/`GM_setValue` calls found (grep below); storage is the `localStorage` path above.
- Torn PDA key placeholder: `PDA_API_KEY = '###PDA-APIKEY###'` (`:50`), resolved by `getStoredApiKey` (`:760`, `isPdaKey` `:752`).

Storage keys (`:52`-`:63`)
- `two.apiKey.v1` (`:52`) public/manual key, set in `setManualApiKey` (`:766`).
- `two.attackApiKey.v1` (`:58`) Limited/Custom key for attack history and battlestats, `setAttackApiKey` (`:785`).
- `two.settings.v1` (`:59`).
- `two.signupCache.v2` (`:53`), `two.factionStatusCache.v2` (`:55`), `two.attackHistoryCache.v3` (`:57`), `two.opponentIntel.v1` (`:60`), `two.selfIntel.v1` (`:61`), `two.strengthCache.v2` (`:63`).
- Legacy keys read and removed on migration: `two.profileCache.v1` (`:54`), `two.attackHistoryCache.v2` (`:56`), `two.strengthCache.v1` (`:62`).
- Hunt state: `two.hunt.v1` per CHANGELOG 0.23.0. The storage-key constant (`HUNT_STORAGE`) was not located by grep in the main file; it is used by `loadHuntState` (`:5714`) and `saveHuntState` (`:5745`).

Retention and pruning
- Persisted caches kept 7 days (`PERSISTED_CACHE_RETENTION_MS`, `:168`); strength cache 7 days (`:102`); intel retention 240 days, sample age 180 days, FF age 120 days (`:92`-`:94`); pruning in `prunePersistentCaches` (`:506`).
- Hunt pool up to 5,000 targets (`HUNT_POOL_MAX`, pruned `:5756`; per CHANGELOG 0.23.1).

Diagnostics and clearing: `clearStoredAndReload` (`:441`) used by Clear-data tools.

## 5. Polling, timers and rate limiting

Torn API traffic control
- Request layer `apiGetRaw` (`:1006`): backoff check (`API backoff active` `:1012`), `REQUEST_TIMEOUT_MS = 15000` (`:76`), error classification `classifyApiError` (`:922`), failure/success counters `registerApiFailure` (`:946`), `registerApiSuccess` (`:978`). In-flight dedupe `apiFlightKey` (`:998`), `apiGet` (`:1103`).
- Clock sync from server timestamps: `syncClockFromTimestamp` (`:1187`), `serverNowSec` (`:1183`).

Faction page intervals
- Status refresh: active 10 s (`:65`), watch 20 s (`:66`), idle 30 s (`:67`); adaptive scheduler `getAdaptiveFactionRefreshMs` (`:4405`), `scheduleFactionRefresh` (`:4426`).
- Profile worker start gaps: hot 900 ms (`:68`), cold 4 s (`:69`), fallback 1.5 s (`:70`); `runProfileWorker` (`:3839`).
- Attacks refresh 30 s (`:80`); `ATTACKS_CACHE_MAX_AGE_MS` 30 min (`:84`).
- War context 60 s (`:86`-`:87`); chain 30 s (`:88`); self stats 6 h (`:89`); own proxy 6 h (`:105`).
- Strength worker request gap 3 s, about 40/min (`:104`, `runStrengthWorker` `:2259`).
- Young-account prefilter `prefilterYoungAccounts` (`:4611`).
- DOM countdown ticker, watchdog 5 s (`:169`, stale grace 10 s `:170`).

Attack page intervals
- Target status 10 s active / 30 s idle (`:5557`-`:5558`); `attackStatusRefreshMs` (`:6598`).
- Own bars 60 s (`:5583`).
- Attack tick 1 s (`:6873`).

Hunt mode pacing
- 1,500 ms between requests, about 40/min (`HUNT_REQUEST_GAP_MS`, `:5694`); save throttle 5 s (`:5696`); revalidate status older than 90 s (`:5699`); pauses at the goal and while the page is hidden (`huntCanRun` `:5973`). Torn's limit is 100/min (per CHANGELOG 0.23.0).

Persistence timers
- Intel save debounce 2 s (`:96`); signup cache save debounce 1.5 s (`:75`); status cache persist 60 s (`:74`).

Resume and visibility
- `pauseForegroundWork` (`:5240`), `resumeForegroundWork` (`:5260`), `performResume` (`:5270`); coalesced `RESUME_DEBOUNCE_MS` 300 ms (`:100`); `flushPersistentState` (`:5299`).
- Attack page `pauseAttackPage` (`:6876`), `resumeAttackPage` (`:6884`), `attackPageVisible` (`:6608`).

## 6. Platform support and architecture

Platforms
- Torn PDA (primary): README `:5`, `:112`; PDA bridge `:4724`-`:4733` (documented `PDA_httpGet`, `PDA_storage`, plus undocumented handlers `PDA_getTabState` and toast calls, feature-checked with timeouts).
- Desktop userscript managers: `@match` `:10`-`:13`, `@grant GM_xmlhttpRequest` `:15`, `@grant GM_registerMenuCommand` `:16`, `@connect api.torn.com` `:14`, `@run-at document-end` `:17`. Greasy Fork is the preferred public route (README `:~141`, docs/GREASY-FORK.md).
- Request path priority: `PDA_httpGet` (`:1028`), else `GM_xmlhttpRequest` (`:1034`), else `fetch` (`:1050`).
- Mobile: README `:26`, `:27` and GREASY-FORK.md `:140` mention mobile CPU and conservative polling.

Architecture constraints
- Single file: all code, CSS (`injectStyles` `:4917`) and self-tests in `torn-war-overlay.user.js` (7,016 lines). Wrapped in `'use strict'` (`:21`).
- No build step (README `:153`); no `@require` or external dependencies in the header (`:2`-`:17`).
- Canonical source is the root `.user.js`; `@version` must be bumped with each release (docs/GREASY-FORK.md `:172`).
- Test harness: `node --check torn-war-overlay.user.js && node tools/smoke-test.mjs` (README `:155`-`:157`). `tools/smoke-test.mjs` stubs the DOM, boots the script, runs the self-tests and a hunt-mode stub (CHANGELOG 0.23.0). `tools/winprob-sim.py` is a standalone Python simulation (2.4 KB) not referenced by the script.
- Single-instance guard: `INSTANCE_KEY = '__TORN_WAR_OVERLAY_V0260__'` (`:21`).

## 7. Halloween / event / competition keyword grep

Commands run (from repo root):

```
grep -n -i -E 'halloween|treat|basket|competition|event|candy|pumpkin' torn-war-overlay.user.js
grep -rn -i -E 'halloween|treat|basket|competition|event|candy|pumpkin' README.md CHANGELOG.md docs tools
```

Results
- `halloween`: matches in the main file at `:5678` (comment "Hunt mode (v0.23, built for the Halloween event)") and `:6141` (`toggle.title` "Halloween hunt mode ..."). Matches in README.md `:25`, `:90`, `:92`, `:122`, `:179`, `:181`; CHANGELOG.md `:65`, `:67`.
- `treat`: no event-related match. Hits in the main file are `treat events` comments at `:1933`, `:2433`, `:2466` (about stored data, not an event).
- `basket`: no matches.
- `competition`: no matches in any file. (`docs/TACTICAL-INTELLIGENCE-ROADMAP.md` uses "competitive advantage", `:28`, not a competition feature.)
- `candy`: no matches.
- `pumpkin`: no matches in the script or docs. The only hit is a fake user name `Pumpkin` in the smoke-test stub data, `tools/smoke-test.mjs:151`.
- `event`: noisy. Almost all hits are `addEventListener`, `removeEventListener`, `Event` (for example `:435`, `:1360`, `:4898`, `:5262`, `:6950`). None are Halloween or game-event features. The `docs/TACTICAL-INTELLIGENCE-ROADMAP.md` hits at `:439`, `:655` refer to Torn ranked-war score decay events, not an in-game event.

Summary: Halloween-specific code exists only as hunt mode (section 2, hunt rows) and its text; no basket, candy, pumpkin, treat or competition features, and no event-specific API selection beyond the general hunt scan.

## 8. Last 10 CHANGELOG entries (one line each)

1. **0.26.0** (`CHANGELOG.md:7`): Torn PDA tab awareness (pauses when the PDA tab is hidden), a tools sheet with actions the userscript menu had, and native Torn PDA toasts.
2. **0.25.0** (`:15`): Stores all data in Torn PDA's native `PDA_storage` with a one-time, verified move from localStorage.
3. **0.24.2** (`:24`): Hunt dock stays put, measured from the chat buttons instead of Torn's invisible fixed layer.
4. **0.24.1** (`:29`): Energy read via the Limited key; dock sits above Torn's chat buttons and tucks into a pill during fights.
5. **0.24.0** (`:37`): Bottom-docked hunt panel with a large Skip/NEXT button, confirmed-free count and details sheet.
6. **0.23.2** (`:49`): Hunt stops at a goal of 2x hits (20 to 100); re-checks weakest saved targets before scanning new IDs.
7. **0.23.1** (`:57`): Hunt keeps going while the page is visible, pool up to 5,000 targets, weakest-first NEXT.
8. **0.23.0** (`:65`): Hunt mode for the Halloween event: ID walk downward from your own ID, local pool, attack-page HUNT button, menu commands.
9. **0.22.1** (`:77`): Attack page recognises Torn's defeat line so losses show as LOSS and trigger NEXT.
10. **0.22.0** (`:82`): Leave-or-Hospitalize hint before each fight on the attack page.

## 9. TODO / roadmap items in README and docs

Markdown checklists and open items. Grep `grep -n -i -E 'TODO|FIXME|XXX' torn-war-overlay.user.js` returned no matches.

- README `:145`-`:151` "Future development research": points to `docs/TACTICAL-INTELLIGENCE-ROADMAP.md`; says later research covers enemy release behaviour, target decay and related items.
- README `:179`-`:183` "Development status": "The native storage in v0.25.0 has so far only been tested against a stand-in for `PDA_storage` ... the first live run should confirm the move succeeds"; v0.14 to v0.16 "need the same real-war validation before promotion" (points to `docs/RESEARCH-2026-09-13.md`).
- docs/GREASY-FORK.md `:203`-`:207` unchecked release checklist: standard userscript-manager smoke test (if claiming compatibility), full Greasy Fork description review, GitHub raw source sync, GitHub webhook after first import, Greasy Fork install test from clean state.
- docs/TACTICAL-INTELLIGENCE-ROADMAP.md (40 KB, the main roadmap): "Immediate next implementation decision" at `:1291`; "Later / optional: Faction Intelligence" at `:942`; "Later integration" at `:639`; "Possible future ranking" `:718`; "Product concept: Next 25E" `:779`; "Definition of success" `:1318`; API nullability note for `attack chain` around 1 January 2027 (`:1204`); "Verify the exact current v2 API schema" (`:159`); diagnostics/self-tests for future API fields (`:895`).
- docs/RESEARCH-2026-09-14.md: ranked candidate table with "Fight-end capture on the attack page" (`:77`, already shipped as v0.20.0 per CHANGELOG).
- docs/RESEARCH-2026-09-13.md: candidate table with "Release fingerprint and contention (roadmap v0.17)" (`:90`); open question on calibration growth rate (`:117`).
- README `:92`-`:103` describes hunt mode as currently implemented (not a roadmap item).

No standalone TODO file exists in the repo.
