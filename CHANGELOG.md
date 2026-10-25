# Changelog

All notable Torn War Overlay changes are documented here.

The project is currently in release-candidate status. Version numbering before v1.0 reflects rapid iterative development and real-war validation.

## 0.27.2 - Basket thresholds are lifetime totals

- v0.27.1 used the Trick or Treat wiki's per-step amounts (5, 10, 25 …) as if they were lifetime totals, so "next basket" named the wrong number. The 2025 forum guide's table gives the running totals, and the dock now uses them: Creepy 5, Freaky 15, Frightful 40, Haunting 90, Shocking 190, Terrifying 440, Horrifying 940, Petrifying 1,940 and Nightmarish 4,440 lifetime treats from attacks.

## 0.27.1 - Basket ladder from the Trick or Treat wiki

- The hunt details and the `🍬` chip now show your basket's base treat chance and the next basket, from the Trick or Treat wiki (read 25 Oct 2026): 35% on Spooky plus 5% per basket up to 80% on Nightmarish, and the thresholds 5, 10, 25, 50, 100, 250, 500, 1,000 and 2,500 treats earned from attacks.
- The finish hint's explanation says what the wiki confirms: leave, mug and hospitalize all give the same treat chance, so Leave is only about getting the target back sooner.

## 0.27.0 - Halloween treats on the hunt dock, faction guard and shared design system

- Treat counter: while Torn's Halloween competition runs, the hunt dock shows your treat total (`🍬1,234`) from Torn's official `/user/competition`, which works with a Public key. It is read once when hunting starts, 4 and 15 seconds after each fight (the count lags the page), and otherwise every 5 minutes, so about one extra request per fight. After a win the result line shows `🍬 +N` or `no treat`, the session line adds today's gain, and the details show measured treats per fight and per 100 energy. Outside the event the chip stays hidden and the endpoint is checked again after 30 minutes.
- Finish hint: the dock no longer reuses the war rule ("Hospitalize, they are active right now"). Hunt targets are random players, so it always says Leave, and during the event adds to land the last hit with a scary weapon (+10% treat chance with the "Here's Johnny" upgrade).
- Faction guard: a line above the hint warns when the next faction chain hit is a bonus hit (red during a ranked war, where the bonus only counts on an enemy), when your faction is in a ranked war (hunt hits score nothing for it), and when a chain is about to time out and a hunt win would keep it going. The minimised pill shows `⚠` for the red case. Your own ranked war is read from `/faction/wars` every 5 minutes while hunting.
- Design: every surface now uses the design system shared with Torn Market Edge (`docs/DESIGN.md`): `--two-*` tokens with the same values as Market Edge's, following Torn's light and dark mode, a 3 px state edge on floating surfaces, one type and radius scale, and green for best and primary actions.
- The hunt session in `two.hunt.v1` also stores the treat total at the first reading of the day and the fights finished since.

## 0.26.0 - Torn PDA tab awareness, tools sheet and native toasts

- In Torn PDA the script asks the app whether its tab is the one on screen and whether the browser is showing (`PDA_getTabState`), every 2 seconds. When it is not, the page pauses exactly as if it were hidden: no hunt scanning, no status or energy polls, no faction refreshes. iOS cannot pause background Torn PDA tabs, so before this an attack page left open in another tab kept spending the shared 100-requests-a-minute budget. On startup the script waits up to 1 second for the first answer, so a tab opened in the background never starts with a burst of requests. If the app does not answer, the script falls back to page visibility as before.
- New tools sheet with every action that used to live only in the userscript menu, which Torn PDA does not have: set or clear keys, hunt on/off, restart the hunt scan, clear the hunt list, target rules, diagnostics, reset settings and clearing cached data. Destructive actions ask first. Open it with `⋯` on the faction toolbar, `Tools…` in the hunt details, or `Tools…` in the war panel's `i` view. The userscript menu is built from the same list.
- In Torn PDA, diagnostics are copied straight to the clipboard with a confirmation toast; elsewhere they open in a prompt as before.
- Native Torn PDA toasts for the few events that need attention, each rate-limited: data moved to Torn PDA storage (once), storage full (once per page), a key that cannot read energy (at most daily), a rejected API key (at most hourly) and no free hunt target (at most every 30 minutes).
- These app handlers are not part of Torn PDA's userscript documentation, so every call is feature-checked and time-limited; an app without them behaves as before.

## 0.25.0 - Torn PDA native storage

- In Torn PDA the script now keeps everything it saves (API keys, settings, hunt pool, opponent intel, caches) in `PDA_storage`, Torn PDA's per-script store backed by the app. It has 10 MB per script by default (the user can raise it in the app) instead of a localStorage of about 5 MB shared with Torn and every other script, and it survives clearing the browser cache. Tampermonkey and other managers keep using localStorage.
- The store is loaded once when the page opens, so reads stay instant; writes are batched into one call shortly after a change and again when the page is hidden.
- On the first run in Torn PDA the existing localStorage data is moved across, read back to confirm it arrived intact, and only then removed from localStorage. If the store is unavailable or the read-back does not match, the script keeps using localStorage and nothing is lost.
- When the store is full, Torn PDA notifies you and the script stops retrying; the diagnostics snapshot shows the storage backend and whether it is full.
- Menu commands that clear data now wait for the store before reloading.
- The diagnostics snapshot reports the current version instead of 0.22.1.

## 0.24.2 - Hunt dock stays put

- The dock no longer jumps around the bottom of the screen. Torn's chat buttons live inside a large invisible fixed layer, and v0.24.1 measured that layer instead of the buttons, so the dock floated about 130 px too high after the chat loaded. Only a short bar on the bottom edge, or the small button actually under the test point, now counts.
- The dock moves only when two readings in a row agree, so scrolling or a menu opening cannot make it jump. The first time the chat bar appears it moves at once, so it does not sit on the chat buttons while they load, and the move is animated.

## 0.24.1 - Hunt dock fixes from the first live session

- Energy is now read with the Limited attack-history key when one is set. A Public Torn PDA key cannot read bars, so the dock showed `⚡ –` even though battle stats (read with the Limited key) worked. With energy known, the hunt goal follows your hits again.
- The dock and its minimised pill now sit above Torn's floating chat buttons, or any other bar fixed to the bottom of the screen, instead of underneath them. The script finds what is on the bottom edge by hit-testing, so it does not depend on Torn's class names.
- During a fight the dock tucks into the `HUNT n` pill so it never covers the weapon slots; the result brings it back with the bright `NEXT`. Tap the pill to open it mid-fight.
- Tiny strength shares read "under 1%" instead of "0% to 0%".
- The details sheet says the goal is the minimum when your energy is unknown, instead of "twice your hits".

## 0.24.0 - Hunt dock

- In hunt mode the attack page swaps the top panel for a panel docked at the bottom of the screen, under your thumb and clear of Torn's HP bars. The war panel is unchanged.
- One large button carries the next target: `Skip ▸ Name · L1` before the fight, and a bright `NEXT ▸ Name · L1` once the fight is over. Its second line says why that target was picked (how weak they are and when their status was confirmed), or your hits left after a fight.
- The orange hunt button shows how many targets are confirmed free. Tapping it, or `i`, opens the details: pool, scanner, today's wins and losses, energy and the target's intel, plus a `Stop hunting` button.
- The top line shows the target, a solid verdict badge without EV (war respect does not matter while hunting), status and your energy as hits.
- Before the fight a short line says how to finish: Leave, so offline targets are back for another hit sooner, or Hospitalize when they are active. It appears before the fight because the script only sees the result after you choose.
- After each fight the dock shows the result and today's wins and losses (Torn time).
- `–` minimises the dock to a small `HUNT n` pill while hunting continues; it opens again by itself after a fight.
- Buttons are at least 34 px, and the main ones 44 to 50 px, for reliable taps.
- When your energy cannot be read, the dock now says why instead of hiding it.

## 0.23.2 - Hunt mode keeps its list current

- Hunt mode now stops once enough targets are confirmed free: twice the hits your current energy allows, at least 20 and at most 100. "Confirmed free" means okay and in Torn at a check in the last 10 minutes. The row shows this as `free/goal`, for example `14/20 free`.
- Below the goal it re-checks the weakest saved targets before scanning new IDs, because re-checking a known weak player costs one request while finding a new one costs several.
- Targets in a faction are refreshed through the faction roster: one request updates the status, travel and last action of every saved member of that faction. Targets without a faction cost one profile request each. A target who has left their faction is re-read from their profile.
- Hospital and jail timers cost nothing until they run out; travelling or unknown targets are re-checked every 20 minutes.
- `NEXT` order: confirmed free first, then okay-but-stale and expired timers, then travelling or unknown, weakest first within each. The link tooltip shows when the target was last active.

## 0.23.1 - Hunt mode keeps going, weakest first

- The scan no longer pauses once 25 targets are ready; it keeps going while the attack page is visible, still at about 40 requests a minute.
- The pool now holds up to 5,000 targets (was 400) in a compact format of about 0.4 MB. When it is full, the strongest player is dropped, so it always holds the weakest found so far.
- `NEXT` offers the weakest player who is out of hospital and not travelling. Players whose hospital or jail timer has run out count as free; travelling or unknown players come last. A target is only offered when a fresh status check says they can be hit.
- The hunt row also shows how many targets are kept.
- Pools saved by v0.23.0 are converted automatically.

## 0.23.0 - Hunt mode for the Halloween event

- New hunt mode, built for Torn's Halloween event where the volume of easy wins matters more than respect. It lives on the attack page panel as a `HUNT` button (`HUNT ON` while active) and in the userscript menu as "hunt mode on/off", "restart hunt scan from my ID" and "clear hunt pool". To start, open any attack page and tap `HUNT`.
- The scan walks user IDs downward one by one, starting at your own user ID minus 1, and saves its position locally so it resumes on the next attack page. Each ID costs one `/user/{id}/profile` request. Torn's public rank minus the level triggers is a hard ceiling on the stat band (crime and networth triggers can only lower it), so a weak rank proves an easy win with no second call, and the lowest band the rank allows rules out strong players. Only undecided players cost a second request (public personal stats); they are kept only if the estimate is `EASY` (under 30% of your strength) and even the high end of the estimate is under 60% (about 93% win chance at worst). Rank-ceiling accepts also use the 60% worst case.
- Nonexistent IDs, yourself, your faction mates, players in federal jail and fallen accounts are skipped.
- Kept targets go into a local pool of up to 400. Targets in hospital or jail return when their timer ends, and travelling ones are re-checked after 20 minutes. Before a target is offered its status is re-read if the stored one is older than 90 seconds. A target you lose to is removed from the pool.
- The hunt row shows the ready count, the next ID to scan (for example `#1,002`), requests per minute and a `Name [level] ▸` link to the next ready target. After a fight in hunt mode, `NEXT` comes from the hunt pool instead of the enemy faction roster.
- Pacing is about 40 requests a minute (1.5 seconds per request; an ID that needs two requests waits twice as long), only while the attack page is visible. Scanning pauses once 25 targets are ready and honors the existing API backoff. Torn's limit is 100 per minute.
- Hunt mode needs personal intel turned on (the default) because it needs your own strength: exact battle stats with a Limited key, otherwise your public-stats estimate. It works with a Public key. It never attacks or clicks for you; you open each attack yourself.
- State is stored locally under `two.hunt.v1`; nothing is sent anywhere except `api.torn.com`.
- The smoke test now also boots hunt mode with a stubbed API (it keeps a weak player, skips a strong one and a missing ID, and shows the `NEXT` link). Nine new built-in self-tests cover the hunt classifier.

## 0.22.1 - Losses show up

- The attack page now recognises Torn's defeat line, "X lost to Y", so a lost fight shows `LOSS` and triggers NEXT like a win does.
- The war-scoped result dots and the "This war" line in the row sheet include losses and stalemates. A lost fight was dropped by the filter that required Torn's ranked-war flag; the flag's behaviour on non-scoring attacks is not documented, so the filter now also accepts any attack on a member of the enemy faction since the war started.

## 0.22.0 - Leave or Hospitalize hint

- The attack panel now shows `LEAVE` or `HOSP` before the fight, and the row sheet says "If you win: Leave/Hospitalize" with the reason. The rule follows published war guidance: leave offline farm targets so they rotate back in 15 to 30 minutes for another hit; hospitalize anyone online or active in the last 15 minutes, and strong opponents, so they burn medical cooldown and stop scoring against your faction. The tooltip also reminds you never to mug in a ranked war. The hint disappears once the fight is over.

## 0.21.0 - Tap-to-explain on the faction list

- Tapping the badges on any enemy row opens a bottom sheet with the target's name and level, verdict and `EV`, live status or hospital countdown, whether it is a green or yellow target under your rules, activity, exact age, Early Discharge and revive flags, this war's results against them, the full explanation of the estimate, and an "Open attack page" link. Tooltips never show on touch devices, so this is how Torn PDA users reach the reasons. Tap outside the sheet or `×` to close; it closes automatically when the page goes to the background.

## 0.20.0 - Fight result capture and next target

- On the attack page the script now reads the fight's finishing line from the log you are looking at (for example "left X on the street (+3.18)") and shows the result immediately as `WIN +3.18`, `LOSS` or `NO RESULT`. The API record is ingested a few seconds later so the opponent's verdict updates before your next fight. Only the page currently being viewed is read; nothing is automated.
- After a fight the panel offers `NEXT`: the best green target on the enemy roster right now, chosen by the same rule as `★ BEST` (highest expected value among safe verdicts, or the safest proven target before a bonus hit), as a plain link with its verdict badge. One roster request per fight.
- An energy readout on the attack panel, `E 85 · 3 hits`, from your own bars with a Minimal key, refreshed every minute; hidden when the key cannot read it.

## 0.19.0 - Rank-band estimates and modelled win probability

- The strength estimate is now bounded by Torn's own rank: the public rank name is a deterministic function of level, crimes, networth and battle-stat thresholds (the same decode Torn PDA and TornTools use), so every member gets a hard stat band such as `2M-25M`. The energy-based guess is clipped into that band and the plausible range is the band itself. The tooltip shows the band and says when the guess was clipped.
- The profile lookup that supplies rank also supplies exact age, so the separate cold age queue no longer runs; each member costs two public requests per week, paced at one pair every three seconds.
- Win probability now comes from a logistic curve fitted to simulated fights on Torn's combat formulas and widened for gear variance, instead of three fixed steps. An observed capped Fair Fight counts as roughly 85% of your strength.
- Removed the `WAR` and `CHAIN` chips from the faction toolbar; Torn shows both directly above the list, and the chips pushed the mode buttons onto a second line on phones. The attack-page panel keeps its chain chip, and BEST still switches to the safest target before a bonus hit.

## 0.18.4 - Attack page learns from your last fights

- The attack page now reads your outgoing attacks from the last six hours once on load, so a fight you finished a minute ago already shows as an observed verdict instead of the estimate. One Limited-key request.
- Fight samples carry the attack id, so the faction list and an attack page open together cannot record the same fight twice.

## 0.18.3 - Withheld estimates are labelled

- When the estimate is too uncertain to call, the badge now shows `~?` next to the EV instead of leaving the verdict blank.

## 0.18.2 - Growth curve retuned on live evidence

- The strength estimate assumed an optimal trainer at a top gym, which put a 262-active-day account with 662 xanax at 680 million stats. Torn PDA's own estimate on the same screen said 2 to 25 million and the user's fights agreed. The growth rate is now about a quarter of the optimal figure, stats start near 50k and reach the 200M cap after roughly 550k gym energy; a live anchor is checked by the self-tests.
- Plausible ranges are wider for young accounts (about a factor of six on stats) and the self-calibration can correct down to 0.2 on score instead of 0.33.
- The AVOID reason no longer claims "you lost your latest fight" when no fight is recorded; it now says why the verdict is AVOID in each case.

## 0.18.1 - Fair Fight from wins only

- Fixed a live-war bug: Torn reports a Fair Fight of 1.00 on lost, stalemated, escaped and interrupted attacks because no respect was earned. The script treated that as a real observation, overwrote the genuine value from an earlier win, and concluded the opponent had zero strength (`score ratio 0.00`, EV collapsed). Only winning hits now teach an opponent's strength, and stored 1.00 values from earlier versions are ignored until the next win.

## 0.18.0 - Filters and early-exit labels

- Added a `FILT` button that opens a row of filter chips above the member list: match verdict (`EASY GOOD RISKY AVOID ?`), status (`OKAY HOSP AWAY`), activity (`ON IDLE OFF`) and a minimum `EV` (`ANY 2+ 4+ 6+`). Tap a chip to hide those rows; a lit chip is shown, a struck-through chip is hidden; `RESET` shows everything. Filters persist and apply in both `ALL` and `TARGETS` modes. A fact the script does not know never hides a row.
- Added `OUT EARLY`: when a member leaves hospital at least a minute before their timer (medical item, revive, Early Discharge), the hospital badge shows `OUT EARLY` for five minutes with the lead time in the tooltip. Detected from consecutive API snapshots and from the visible page, only while the page is active.

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
