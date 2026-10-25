# API / network layer audit (torn-war-overlay.user.js v0.30.2, 7530 lines)

Spec checked: live Torn OpenAPI v6.13.8 (fetched 2026-10-25). All line refs are torn-war-overlay.user.js.

## 1. Transport as built
- `apiGet` (1105) dedupes in-flight requests via `apiFlights` keyed by path+sorted query+cacheBust+key scope (1000-1006, 298). `apiGetRaw` (1008) does one attempt, no retry.
- Transport order: `PDA_httpGet` (key in query string, 1019-1031) > `GM_xmlhttpRequest` (Authorization header, 1034) > `fetch` (1052). 15 s timeout each (78). `comment` is appended to every URL (919) from `API_COMMENT = 'two-v0.26.0'` (51): stale, script is 0.30.2.
- Errors: Torn `error.code` or HTTP status becomes `ApiError{code,status,retryable}` (328, 1087-1101). `classifyApiError` (926): codes 1,2,10,13,18 permanent; 5/429 backoff 15 s x (failures+1) capped 90 s; 8 = 15 min; 9,12,15,17,24/5xx 10 s x n cap 120 s; 14 = 60 min but not retryable; code 7/16/6 are NOT classified.
- `registerApiFailure` (948) sets the single global `globalBackoffUntil` (196) and `apiPermanentlyDisabled` (195). `apiGetRaw` rejects instantly with message `'API backoff active.'` while backoff is on (1013). Success never clears an active backoff (980).
- **No global rate limiter.** Backoff only reacts AFTER error 5. There is no token bucket, no request counter, no queue in `apiGetRaw`. Each subsystem paces itself: profile worker gaps 900 ms hot (2 in flight, 70-73) / 4 s cold / 1.5 s fallback; strength worker 3 s (106); hunt 1.5 s per request (5720); attack backfill 5 pages/cycle then 1.5 s (84, 4325); hit-goals 6 pages/refresh, 5 s resume (6577, 6651). `huntRatePerMinute` (6008) counts hunt requests only, so the "requests/min" shown on the dock (6786) understates real load. Limits are per JS context; Torn counts per user across tabs, devices, and other scripts/tools.
- Backoff also fires for the second (attack-history) key even though Torn's limit is per user, which is correct, but only some call sites call `registerApiFailure` for override-key calls (4312 skips it when `attackApiKey`; 6654, 6914, 6980, 7339 never do), so a 429 on those paths sets no backoff.

## 2. Call sites
Key: P = primary `apiKey`, A = `attackApiKey || primary` (keyOverride). "cb" = timestamp cache-bust.

| Line | Path (+query) | Key | cb | Trigger / interval |
|---|---|---|---|---|
| 1127 | /key/info | P | no | once per load, memoised |
| 1142 | /key/info | A | no | once per load, memoised |
| 1732 | /user/battlestats | A | no | >=5 min guard (1725), cached hours; faction page + attack page |
| 1761 | /faction/chain | P | yes | TTL 29 s; after each faction snapshot, each attack-status poll, next-target |
| 2099 | /user/personalstats cat=popular | P | no | own; 6 h / 5 min guard |
| 2105 | /user/profile | P | no | own, with 2099 |
| 2232 | /user/{id}/personalstats cat=popular | P | no | strength worker 3 s gap; also attack page target (7364) |
| 2239 | /user/{id}/profile | P | no | with 2232 if no cached facts |
| 3824 | /user/{id}/profile | P | no | profile worker: hot 900 ms x2 in flight, cold 4 s, fallback 1.5 s; attack page (7357) |
| 3922 | /user/{id}/faction | P | no | once, enemy-faction fallback |
| 4095 | /faction/wars | P | yes | war context TTL 60 s |
| 4106 | /faction/warfareranked (sort DESC, limit 100, from) | P | maybe | only if 4095 fails |
| 4240 | /user/attacks filters=outgoing sort=DESC limit=100 from[,to] | A | yes | 30 s steady; 1.5 s while backfilling; up to 5 pages/cycle |
| 4477 | /faction selections=members,timestamp id | P | yes | faction page every 10/20/30 s (adaptive, 4411) |
| 4490 | /faction/{id}/members | P | yes | fallback mode, same cadence |
| 4491 | /faction/timestamp | P | yes | fallback mode, every snapshot |
| 4639 | /user/search filters offset | P | yes | once per faction, sequential pages (25 rows each) |
| 5968 | /faction/{id}/members | P | yes | hunt refresh |
| 5976 | /user/{id}/profile | P | yes | hunt refresh/revalidate |
| 6052 | /user/{id}/profile | P | no | hunt scan, 1 per 1.5 s |
| 6073 | /user/{id}/personalstats cat=popular | P | no | hunt "deep" verdict |
| 6022 | /user/basic | P | no | only if key/info lacks user id |
| 6629 | /user/attacks (same params, from=window start) | A | yes | hit goals: 2 min, up to 6 pages, resume 5 s while backfilling; home + attack |
| 6864/6870 | /user/{id}/profile, /faction/{id}/members | P | no/yes | next-target button |
| 6900 | /user/bars | A | yes | 60 s guard; attack + home |
| 6937 | /user/competition | P | yes | 5 min, +4 s and +15 s after each fight |
| 6975 | /faction/wars | P | yes | 5 min (hunt on) |
| 7034 | /user/{id}/basic | P | yes | attack page every 10 s (okay or hospital <=5 min), else 30 s |
| 7326 | /user/attacks limit=25 from=now-6h | A | yes | once per attack-page load |
| 7351 | /faction/timestamp | P | yes | once per attack-page load |

Duplicates: `/user/attacks` x3 (4240, 6629, 7326) with different params, so no flight sharing, three separate stores (`attackHistoryCache`, `opponentIntel.seen`, `hitGoals.seen`). `/faction/wars` x2 (4095 TTL 60 s into `currentWar`; 6975 TTL 5 min into `ownWar`, normalised twice). `/faction/{id}/members` x3 and `/faction/timestamp` x2. `personalstats cat=popular` x3 and `/user/{id}/profile` x7 (incl. own `/user/profile`). `/key/info` x2 (one per key, per page load, not persisted). Profile data fetched by hunt (cb=true) bypasses the cache the profile worker populated.

## 3. Cache behaviour
Torn caches ~30 s; a `timestamp` param bypasses it and the call always counts. Nearly every live call sets cb (above). Faction snapshots at 10 s and attack-status at 10 s are deliberately sub-30 s (fresh data wanted) but each costs a real request (6/min each). Waste candidates: `/faction/timestamp` every snapshot in fallback mode (4491) when the clock only needs re-anchoring every few minutes; cb on 5-min/60-s TTL endpoints (competition, wars, bars, chain) adds nothing because the local guard already limits them, but also forfeits free cache hits.

## 4. Spec findings (v6.13.8)
- Deprecated: only `/faction/warfare` (removed 2027-01-01). The script does NOT use it; `/faction/warfareranked` is Stable and response key `warfareranked` matches (4112). No used endpoint is deprecated.
- `Attack.chain` is `int|null`, 0 becomes null on 2027-01-01. Handled: `normalizeAttack` (2320-2337) maps null/0 to null; self-test covers both (5378, 5389). Lines 4071-4072 read ranked-war faction `chain`, a different field.
- v1-style: `/faction?selections=members,timestamp` (4477) is the generic selection form; spec says unaltered selections default to v1 behaviour and offers a `legacy` param. The code survives a shape change only via the `Array.isArray(members)` fallback (4482-4484, 4503). `/user/search` is marked Unstable (fallback exists, 4700). `/faction` is Stable.
- `sort=ASC` is never used (only DESC). Spec: `from` = "after this time" (exclusive), `to` = "up to and including" (inclusive), matching code comment (4256) and overlap handling. Sort description is vague ("Sorted by the greatest timestamps"), so the DESC-only design is safe.
- `comment` param exists (ApiComment) and is sent. Spec: `/user/search` returns max 25 rows, offset-paged; loop matches. `/user/bars` needs Minimal key (code handles 16).

## 5. Key handling vs README
Matches: keys only go to api.torn.com (`@connect`, 15); manual keys stored in `twoStorage` (PDA_storage or localStorage, 783-807, 7475); PDA key is the injected placeholder (52). Gaps: README ToS table says nothing about (a) the second "attack-history" key, (b) the PDA key travelling in the URL query string (1019), (c) keys stored in plain text. Judgement risk: hunt scans sequential user IDs at ~40/min (6038-6050), which is bulk enumeration of other players; README discloses purpose but Torn's "minimal data" principle is arguable.

## 6. Error-handling patterns
- "Unsupported key" (code 7/16): 9 ad-hoc checks at 1773, 2123, 2288, 4303, 6073, 6654, 6914, 6980, 7339, each with its own flag (`ownChainUnsupported`, `strengthUnsupported`, `ownBarsUnsupported`, `ownWarUnsupported`, `hitUnsupported`, `attackHistoryFeatureState`); 1773 and 6980 also treat ANY non-retryable error as unsupported (so a code 6/9 permanently disables the feature for the session).
- `'API backoff active.'` string comparison: 28 occurrences; `registerApiFailure` 10 call sites, `registerApiSuccess` 8, some features call neither.
- Retry: five different schemes (profile re-queue 3902, strength re-push 2295, attack refresh 4313, age search single retry 4692, hunt cursor reset 6053).

## Worst-case requests/min (no limiter; Torn limit 100)
- Faction page steady: ~6 (snapshot) + 1 (war) + 2 (chain) + 2 (attacks) + <=15 (cold profiles) = ~26. Fallback snapshot mode +6.
- Faction page burst: backfill of 5 sequential pages then 1.5 s gap = ~5 req per 2.3-3 s = 100-130/min for as long as backfill lasts (a long war = many cycles), plus hot profiles up to 66/min, plus 6+1+2 baseline. Worst ~175-200/min. Strength worker is gated off while hot profiles run, so it is not additive.
- Attack page steady: hunt 40 + status 6 + chain 2 + bars 1 + misc 1 = ~50. Bursts: hit-goals first-run backfill 6 pages every ~5 s = ~72/min (total ~120), pick revalidations +4 unpaced (6160), startup ~8 one-offs, +2 treats per fight.
- Home page steady ~5-10; hit-goals backfill up to ~72/min; revalidations 4 per 30 s.
- Two tabs (faction + attack) or PDA + desktop add linearly: hunt 40 + faction 26 + any backfill crosses 100.

## Top 5 refactors (impact / effort)
1. **Central limiter inside `apiGetRaw`** (high / low): sliding-window counter or token bucket (e.g. 70/min soft cap, priority lanes: user-visible snapshot > hunt > backfill), awaiting instead of throwing; persist the window in `twoStorage` timestamps to cover multi-tab. Removes the need for per-subsystem gaps and makes the dock rate honest.
2. **One error-policy helper** (high / low): `classifyFailure(err)` returning `{backoff, permanent, unsupported, silent}` plus `handleApiError(feature, err)`; replace 9 code-7/16 checks, 28 string compares (use a typed `ApiBackoffError` / `err.kind`), and make code 6/7/16 explicit in `classifyApiError`. Fixes the "any non-retryable = unsupported" bug at 1773/6980.
3. **Single attacks service** (high / medium): one paged `/user/attacks` fetcher with a shared cursor and one stored attack log feeding war history, opponent intel, and hit goals; kills the 3 duplicate paths/stores and the double backfill.
4. **Shared cached fetch layer for read-mostly data** (medium / low): memoise `/faction/wars` (one normaliser, one TTL), `/key/info` (persist), own personalstats/profile, and `/faction/{id}/members`; stop cache-busting endpoints guarded by long local TTLs; re-anchor the clock from `/faction/timestamp` only every few minutes.
5. **Spec hygiene** (medium / low): replace `/faction?selections=members,timestamp` with `/faction/{id}/members` (drop the generic-to-stable fallback and halve code), bump `API_COMMENT` from `SCRIPT_VERSION`, document the second key and URL-key behaviour in the README ToS table, and cap hit-goal backfill to one page per ~30 s.
