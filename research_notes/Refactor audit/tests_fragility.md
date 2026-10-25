# Test coverage and fragility audit (v0.30.2)

Files: `torn-war-overlay.user.js` (7,530 lines), `tools/smoke-test.mjs` (332), `CHANGELOG.md`.

## 1. What is tested

**Smoke test (`tools/smoke-test.mjs`)** boots the script in a node `vm` and counts errors, prompts and storage writes. Scenarios (lines refer to the harness):

| Scenario | Asserts |
|---|---|
| `/factions.php` boot (l.~150) | no self-test faults, no init errors, exactly one key prompt |
| attack page, no key | zero prompts, zero errors |
| attack page + stub API (hospital target) | no errors, panel mounted |
| hunt mode, stub API (l.199, 6.5 s wait) | IDs 1003/1004/1005 walked upward, weak one kept, cursor >= 1006, `dir==='up'`, `NEXT` link |
| home card (l.241) | docked card links to `page.php` |
| PDA storage (`makePdaStorage`, l.245-268) | migration, `failLoad`, `corruptReadBack` fall back to localStorage |
| PDA runtime tab state (l.304, 315) | background tab sends no hunt requests in 3 s |

**`runSelfTests` (l.5338-~5545, about 100 `faults.push` checks)** covers pure code only: settings and filter sanitising, `classifyAttackResult`, `classifyFightLine`, `finishHintFor`, base respect, `chainScaleForHit`, `isChainBonusHit`, fair-fight formulas, `statsFromEnergy`, `trainingEnergy`, `estimateMatchFromProxy`, `rankBandFromInputs`, verdict shifts, the intel states (PROVEN, RISK, CHANGED, ...), `classifyHuntProfile`, `huntReadyAt`, `huntPriorityOrder`, `huntTier`, `normalizeHuntPool`, and diagnostics key leak.

**Zero coverage (no assertion anywhere):**

| Subsystem | Where | Gap |
|---|---|---|
| Faction row rendering | `ensure*Badge` 1353-2635, row scan 3600-3625 | the stub returns `null` from `querySelector`, so the row loop never runs |
| Goals | `loadHitGoals` 6584, `halloweekWindow`, `hitWinsBetween` 6664, `hitGoalView` 6670, the fetch loop ~6620-6660 | no tests for midnight rollover (`huntTodayKey` 6279), the year edge, `need N/day` pacing, `fillTo` backfill or the v1 to v2 migration |
| Basket | `huntBasketProgress` 6713, `huntBasketInfo` 6561, `HUNT_BASKETS` 6556 | the table is pure but untested, and it was wrong twice |
| Chain guard / ranked war | `normalizeRankedWar` 4049, `huntGuardView` 6991 | none |
| Storage | `loadJson` 449 / `saveJson` 464, PDA store 339-420 | only the smoke PDA path; quota-full and the writer timers are untested |
| Dock offset | `measureBottomObstruction` 6246, `updateHuntDockOffset` ~6262 | the stub has no `elementsFromPoint`, so it returns 0 |
| Attack-log scan | `scanAttackLog` 5649 | only `classifyFightLine` is tested, not the observer or seen-line logic |
| Hit-goal API loop | 6620-6660 | no fixture of `/user/attacks` |

## 2. Bug history (v0.22 to v0.30.2)

| Release | Bug | Root cause class |
|---|---|---|
| 0.30.2 | Basket shortcut unreliable, removed | Torn DOM assumption (items page) |
| 0.30.1 | Hit goals read 0 all day | Unverified API semantics (`personalstats&timestamp` returned the current value) |
| 0.29.1 | Basket shortcut found a hidden list | Torn DOM assumption (inactive category lists stay in the DOM) |
| 0.28.1 | `loader.php` links retired by Torn | External contract change, no canary |
| 0.27.2 | Basket thresholds were per-step, not lifetime | Unverified API/wiki semantics; pure table, no test |
| 0.24.2 | Dock jumped about 130 px | Torn DOM assumption (a large invisible fixed layer measured as the chat buttons) |
| 0.24.1 | Energy `-` with a Public key; dock under chat buttons; "0% to 0%" | API permission semantics, DOM assumption, edge-case formatting |
| 0.23.x | Pool/scan tuning | design iterations |
| 0.22.1 | Losses dropped from war dots | Unverified API semantics (ranked-war flag on non-scoring attacks) and DOM text assumption (defeat line wording) |

**Recurring categories:** unverified API or wiki semantics (4: 0.30.1, 0.27.2, 0.24.1, 0.22.1), Torn DOM assumptions (4: 0.30.2, 0.29.1, 0.24.2, 0.22.1). Almost every one shipped as a patch within 1 to 2 days. None was caught by a test; the pure ones (0.27.2 thresholds) were testable but nothing pinned the values against a source.

## 3. DOM coupling

| Selector / assumption | Line | Fragility |
|---|---|---|
| `ul.members-list`, `li.enemy` (fallback `li`) | 3600-3605, 5174 | Medium. A fallback exists, but the class names are Torn's. |
| `a[href*="profiles.php"][href*="XID="]` | 1211, 3451, 3554, 3608 | Low. The URL shape has been stable. |
| `div.member, [class*="member"]`, `div.status, [class*="status"]` | 3613-3614 | High. Substring class matching can hit unrelated nodes. |
| `div.level, [class*="level"]` | 1218 | High, same reason. |
| `ul[aria-describedby="log-header"]` (`ATTACK_LOG_SELECTOR`) | 5607, 5686-5689 | High. This is the single trigger for fight results, and one `aria` attribute change breaks it silently. |
| Fight-line regexes (`you lost`, `stalemate`, `escaped`) | 306-308, 5618 | High. Wording is localised and free text. |
| `elementsFromPoint` + `getComputedStyle.position` | 6247-6255, 6233 | High. It is hit-testing Torn's layout and already broke once. |
| `.two-*` CSS reaching into `ul.members-list li ... .attack a` | 5120-5124 | Medium. Visual only. |
| Page routing by `location.pathname` / `sid=attack` | 28-30, `@match` 11-13 | Medium. Torn already moved `loader.php` to `page.php`. |
| Own markers `data-two-*` | 1353-2635 | Low. |

## 4. Pure logic status

| Function (line) | Pure? | Note |
|---|---|---|
| `finishHintFor` 2204 | yes | tested |
| `chainScaleForHit` 1685, `isChainBonusHit` | yes | tested |
| `fairFightFromScores` 1701 | yes | tested |
| `winProbabilityFromRatio` 1852 | yes | only indirectly tested |
| `scoreFromStats` 1900 / `statsFromEnergy` | yes | tested |
| `estimateMatchFromProxy` 2004, `verdictFromRatio` 2053 | yes | tested |
| `classifyHuntProfile` 5897 | yes by arguments, but reads `serverNowSec()` as a default | tested |
| `huntBasketProgress` 6713 | yes | **untested** |
| `huntBasketInfo` 6561 | yes | **untested** |
| `huntTodayKey` 6279 | reads `serverNowMs()` | **untested** |
| `halloweekWindow` 6600 | pure, `nowSec` parameter | **untested** |
| `hitWinsBetween` 6664 | reads the global `hitGoals` | tangled |
| `hitGoalView` 6670 | pure maths mixed with the globals `hitGoals`, `hitWonNow`, `hitUnsupported` and the DOM-free string build | **untested**, needs state injection |
| `loadHitGoals` 6584 | reads storage | migration logic is testable once split from IO |
| Hit-goal fetch loop ~6620 | IO, the pagination logic is inline | cursor and `fillTo` logic is buried |
| `huntGuardView` 6991 | reads globals | tangled |
| `normalizeRankedWar` 4049 | pure | **untested** |
| `computeBestTarget` 2611 | reads globals | tangled |
| `measureBottomObstruction` 6246 | DOM | needs a fake `elementsFromPoint` |

## 5. Harness

* **DOM stub:** `makeElement` (l.25) is a static shell. `querySelector`/`querySelectorAll` always return `null`/`[]`, `classList.contains` is always false, `closest` always returns `null`, `MutationObserver` never fires, and `getElementById` is `null`. It can count what the script appended to `body`, but it cannot test row rendering, text content or observers.
* **Run time:** 24.3 s wall, 0.29 s CPU. Nearly all of it is waiting.
* **Brittleness:** fixed sleeps of 150, 300, 1,500, 3,000, 5,500 and 6,500 ms (l.113, 199, 233, 241, 268, 304, 315). The 6.5 s waits depend on real timers (three scans 1.5 s apart plus the 2 s save throttle), so a slowdown yields a false failure and a speed-up wastes time. Assertions check storage state after a delay, not events. Expected API warnings are printed on every run (about 12 lines of "Incorrect ID"), which hides new warnings.

## 6. Recommended strategy (no build, single file)

1. **Test hook, no build.** Near the end of the IIFE add `if (typeof globalThis.__TWO_TEST__ === 'object') Object.assign(globalThis.__TWO_TEST__, { halloweekWindow, huntBasketProgress, hitGoalView, ... });`. The userscript behaves identically in production. A node `vm` test file creates `__TWO_TEST__ = {}`, loads the source with the existing stub, and reads the exports.
2. **Table-driven tests** in `tools/unit-tests.mjs` using `node --test` (zero dependencies): basket boundaries, midnight and year edges, goal pacing, chain table, finish-hint truth table.
3. **Fixtures:** record real responses to `tools/fixtures/*.json` (`/user/attacks`, `/user/competition`, `/faction/wars`, `/user/{id}/profile`, key info). Feed them through the fake `fetch`; the same fixtures replace hand-written stubs in the smoke test.
4. **Fake clock:** inject `serverNowMs`, or override `Date.now` in the vm sandbox, instead of real waits (this removes the 24 s).
5. **Minimal HTML fixtures** of a members list and attack log in a small DOM (linkedom or jsdom as a dev-only dependency, or a hand-written selector engine) to cover the row scan and the log selector; keep the fixtures when Torn changes.
6. **Runtime canary:** when the attack page opens and `ATTACK_LOG_SELECTOR` or `ul.members-list` is missing after N seconds, show a "Torn layout changed" line in diagnostics.

## Top 5 refactors (impact / effort)

| # | Refactor | Impact | Effort |
|---|---|---|---|
| 1 | Add the `__TWO_TEST__` export hook plus `tools/unit-tests.mjs` with table tests for basket, goals, `halloweekWindow`, chain and finish hint. Covers three of the five recent regressions. | High | Low (about 2 hours) |
| 2 | Split goals into pure `hitGoalView(state, nowSec)` and `applyAttackPage(state, attacks)` (cursor, `fillTo`, `seen`) so a fixture of `/user/attacks` can be replayed. Remove the globals `hitGoals`/`hitWonNow`/`hitUnsupported` from the maths. | High | Medium |
| 3 | Injectable clock and a fake-timer smoke test. Replace the `waitMs` sleeps with a manual `advance(ms)` so the suite goes from 24 s to a few seconds and stops being flaky. | Medium-high | Medium |
| 4 | Move every Torn selector and fight-line regex into one `TORN_DOM` constant block with a runtime canary that logs to diagnostics when a selector finds nothing. Replaces the `[class*="member"]` guessing with a single place to fix. | Medium-high | Low-medium |
| 5 | DOM fixtures for the faction row scan and attack log (dev-only linkedom) so row rendering, hidden-list handling and `elementsFromPoint` bars have regression tests. | Medium | Medium-high |
