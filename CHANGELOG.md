# Changelog

All notable Torn War Overlay changes are documented here.

The project is currently in release-candidate status. Version numbering before v1.0 reflects rapid iterative development and real-war validation.

## 0.17.0 - Attack page continuity

- The script now also runs on the attack page (`loader.php`, `loader2.php` and `page.php` with `sid=attack`, covering Torn PDA's attack URL) and shows a compact floating panel: target name and level, the same `EASY | GOOD | RISKY | AVOID` verdict and `EV`, a live hospital countdown or `OKAY` status, and your chain count/timer with the bonus-hit warning.
- Tap the `i` button for the full explanation in words (mobile has no hover); `×` hides the panel until the next page load.
- Data comes only from the Torn API and your local memory: one status check every 10 to 30 seconds while the page is visible, the cached chain state, and a one-off age and public-stats lookup for this target if they are not already known. Nothing is scraped from the attack page and nothing runs while the page is hidden.
- The attack page never prompts for an API key; set it once on the faction page.
- The smoke harness now boots faction, attack and unrelated pages.

## 0.16.0 - Calibrated strength model

- Rebuilt the public-stats strength estimate on Torn's gym formula: stats grow exponentially with gym energy up to the 50M-per-stat cap and roughly linearly after it. The old square-root-of-energy proxy is gone.
- Counted natural energy regeneration (about 480 per active day, more for donators) and subtracted energy spent on attacks and revives. This fixes the v0.15 misread where an old, active account with few xanax could show as `~EASY`.
- Fetch the exact account age of every enemy member once (cold queue, one request per member ever) so the natural-energy term is correct; activity time stands in while it loads.
- Compare against your real battle stats when the key allows it, otherwise against your own public stats and account age.
- Self-calibration: every real fight gives an observed strength for a player whose public stats are cached; the median correction is applied once three fights exist and is shown in diagnostics and the tooltip.
- Estimates now carry a plausible range. The tooltip shows it, and a verdict is withheld as `?` when the range spans every tier.
- Tooltip explains the estimate in words: estimated total stats, gym energy breakdown (items, natural, spent), and what it was compared against.

## 0.15.0 - Match verdicts

- Added a plain-language match verdict on every enemy row: `EASY`, `GOOD`, `RISKY` or `AVOID`, with a tap/hover explanation in words ("the sweet spot: good respect per hit and you should still win").
- Verdicts are available before the first fight: the script compares each player's public lifetime training effort (xanax, energy refills, energy drinks) with your own, using a Public key, and shows the result with a `~` prefix (dashed border) to mark it as an estimate. One request per enemy member per week, paced behind the existing age lookups.
- A real fight replaces the estimate: observed Fair Fight, projected Fair Fight and your win/loss record against the player set the verdict, and a recent loss always shows `AVOID`.
- Attack Elo far above yours moves an estimate one step harder; three or more wins without a loss move it one step easier.
- `★ BEST` now works from estimates too, and never picks a `RISKY` or `AVOID` opponent.
- Fixed the `SET` dialog wording and added the strength cache to the "clear personal intel memory" command.

## 0.14.0 - Personal tactical intelligence

- Added personal Fair Fight memory: every outgoing attack record now retains the observed Fair Fight, respect and ranked-war flag, and the opponent's battle-stat score is derived from it so the expected Fair Fight can be re-projected as your own stats grow.
- Added expected ranked-war score per hit (level base x2 war x Fair Fight x chain scale) and an expected value per 25 energy (`EV`) on each enemy row.
- Added a transparent `PROVEN | LIKELY | UNKNOWN | RISK | CHANGED` confidence label with tap/hover explanation; one-sample records are never shown as high confidence and evidence older than 180 days is discounted.
- Added a single `★ BEST` recommendation among current green targets (highest EV; switches to safest proven target when your next chain hit is a bonus hit).
- Added `WAR +lead / target` and `CHAIN n m:ss` chips above the member list, including the next target-decay time and a `BONUS #n` warning.
- Switched attack-history polling from `/user/attacksfull` to `/user/attacks` with paginated backfill, `is_ranked_war` scoping and a start-time cursor. A Custom key must now grant `user -> attacks` (and `user -> battlestats` for projection); a Limited key covers both.
- Switched current-war detection to `/faction/wars` (live score, target and chains), keeping `/faction/warfareranked` as a fallback.
- Read member level from the faction API payload instead of scraping the DOM.
- Fixed a potential false green `DUE` target when Torn returns a null hospital timer.
- Coalesced focus/visibility resume bursts into one API round and re-used a snapshot fetched within the last 3 seconds.
- Added long-term opponent memory in local storage with pruning (600 opponents, 240 days), a `SET` toggle to hide intel, and a menu command to clear it.
- Added a Node smoke-test harness (`tools/smoke-test.mjs`) that boots the script and runs its self-tests.
- Added Torn API ToS disclosure text to the key prompts and the Greasy Fork listing.

## 0.13.1 - Distribution metadata and canonical source

- Published the canonical production userscript at the repository root as `torn-war-overlay.user.js`.
- Finalized Greasy Fork distribution metadata, including author, licence, homepage and support links, while keeping the userscript namespace stable.
- Updated internal release/version identifiers to 0.13.1.
- No tactical targeting, polling or attack-history behaviour changed from v0.13.0.

## 0.13.0 - Release candidate hardening

- Fixed a background/resume lifecycle bug from v0.12.
- Backgrounding now invalidates previously trusted faction status until a fresh snapshot is received.
- Preserves war context and attack history across background/resume for faster recovery.
- Added a lightweight watchdog to recover lost timers, observers, row discovery and polling loops.
- Added explicit request timeouts across Torn PDA, userscript-manager and fetch transports.
- Added an in-flight war-scope guard so old attack responses cannot contaminate a new war scope.
- Improved incremental attack-history cursor handling.
- Added internal runtime diagnostic counters without exposing API keys.
- Kept the visible interface unchanged: `ALL | TARGETS | SET`.

## 0.12.0 - Efficiency and war awareness

- Stopped unnecessary exact-age profile requests for accounts already known to be outside the configured target age window.
- Added configured maximum level directly to the `/user/search` candidate filter.
- Added ranked-war context using Torn's warfare API.
- Scoped recent attack-result history to the current ranked war.
- Replaced repeated full attack-history downloads with incremental updates.
- Moved hospital timing to a monotonic Torn-server clock anchor.
- Added adaptive faction polling based on target urgency.
- Added row render signatures and batched DOM work.
- Added API-key capability detection.
- Improved SPA navigation/remount handling.
- Refined revive-risk handling.

## 0.11.1 - Simplified tactical UI

- Removed manual target pinning.
- Removed shortlist mode and shortlist storage.
- Kept targeting, timers, attack history and resilience improvements intact.

## 0.11.0 - Resilience and QA

- Hardened API error isolation and transport behavior.
- Added faction API fallback handling.
- Added age-search race protection.
- Improved Torn React remount handling and DOM detection.
- Added cache corruption/pruning protection.
- Corrected non-decisive attack-result classification.
- Added startup self-checks and resilience validation.

## 0.10.x - Configuration and tactical UX

- Added configurable account-age, hospital-release and optional maximum-level thresholds.
- Added option to include/exclude Idle players from targets.
- Added persistent settings.
- Added `SET` control.
- Iteratively fixed Torn PDA metadata/import handling, maximum-level null handling and encoding/mojibake issues.
- Removed the experimental SHORT and DIAG tabs after field testing.

## 0.9.x - Recent attack history

- Added up to five recent outgoing attack-result dots per visible opponent.
- Added separate attack-history key support when the main API key lacks sufficient permissions.
- Isolated attack-history permission failures from the main overlay.

## 0.8.0 - Activity and hospital intelligence

- Added activity recency badges.
- Added Early Discharge and revive-risk context.
- Added READY/DUE handling and focused-page early-release detection.

## 0.6-0.7 - API/performance architecture

- Added `/user/search` candidate prefiltering.
- Added fresh faction polling and server-clock synchronization.
- Added profile request prioritization and deduplication.
- Added stale-status protections, API backoff and foreground lifecycle handling.
- Required exact signup confirmation before a player could become a highlighted age-qualified target.

## 0.3-0.5 - Target model and filtering

- Defined green target logic around account age, activity and immediate attack availability.
- Added yellow hospital watch-window targets.
- Added `ALL | TARGETS` filtering and live target counts.

## 0.1-0.2 - Initial prototype

- Added account age beside enemy faction members.
- Added hospital-release countdowns.
- Improved row placement, request pacing and lower-level candidate loading behavior.
