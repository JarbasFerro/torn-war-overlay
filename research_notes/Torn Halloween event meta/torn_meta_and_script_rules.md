# Torn City combat/war meta (2025-2026) and third-party script/API rules

Research date: 2026-10-25. Coverage caveat: torn.com forum threads, wiki.torn.com and rules.php returned HTTP 403 to the fetch tool, so forum/wiki claims below come only from search-result snippets or are listed as gaps. The Torn API page (torn.com/api.html) and the live v2 OpenAPI spec (torn.com/swagger/openapi.json, v6.13.8) were read directly and are primary.

## Ranked wars, chains, territory: scoring, bonuses, timeouts, recent changes

### Takeaway
Ranked-war scoring is respect-based: first side to lead by the target score wins, only "inside" (enemy-faction) hits score, and chain milestones (10, 25, 50, 100, ...) only help if the milestone hit lands on an enemy-faction member. Target decays 1% of original per hour after 24h, war max 123h. The only dated recent ranked-war change I could verify is May 2025 (point rewards removed, caches increased); nothing verified for 2026.

### Cited Findings
- Ranked war: both sides earn respect from attacks; first to reach the target (a lead, not a raw total) wins. Inside hits score and get war multipliers; outside hits score zero for the war. — [FFScouter War & Chaining guide](https://ffscouter.com/guides/war-and-chaining) (third-party, undated, page assets dated 2026-05-06)
- Target decay: after 24h without a winner the required lead shrinks by 1% of the original target per hour; max war length 123 hours (~5.125 days). — [FFScouter guide](https://ffscouter.com/guides/war-and-chaining)
- Chain timeout: first 10 hits must each land within 5 minutes of the previous; after that each hit resets a 5-minute window; timer turns red under 1 minute; cooldown after a chain ends before a new one can start. — [FFScouter guide](https://ffscouter.com/guides/war-and-chaining)
- Chain bonus ladder (hit # -> bonus respect -> cooldown after): 10 -> 10 -> 60s; 25 -> 20 -> 150s; 50 -> 40 -> 5m; 100 -> 80 -> 10m; 250 -> 160 -> 25m; 500 -> 320 -> 50m; 1,000 -> 640 -> 1h40m; 2,500 -> 1,280 -> 4h10m; 5,000 -> 2,560 -> 8h20m; 10,000 -> 5,120 -> 16h40m; 25,000 -> 10,240; 50,000 -> 20,480; 100,000 -> 40,960. — [FFScouter guide](https://ffscouter.com/guides/war-and-chaining)
- In ranked war the milestone bonus only counts if the milestone hit is on an enemy-faction member; an outside bonus hit wastes it. Teams assign one designated "bonus target" who must not be hospitalized early. — [FFScouter guide](https://ffscouter.com/guides/war-and-chaining)
- Respect multipliers: war inside hit x2, retaliation (hospitalize the attacker within ~5 min window) x1.5, overseas hit on enemy x1.25, group-attack finisher scaling, Warlord weapon bonus roughly 15-25%+. Aim for Fair Fight 3.0 for full base respect. — [FFScouter guide](https://ffscouter.com/guides/war-and-chaining)
- Typical war behaviour: many wars stall at a few hundred to ~500 hits; top-tier wars exceed 1,000. "Slow chaining" = letting the timer fall to ~1-2 min before the next hit to buy time. Factions may agree to stop and let decay decide. — [FFScouter guide](https://ffscouter.com/guides/war-and-chaining)
- War tactics: med out, land 1-2 hits, self-hospitalize unless ordered; keep revives off by default; do not travel during war (removes you from scoring); stay in your respect range so you do not steal teammates' targets. — [FFScouter guide](https://ffscouter.com/guides/war-and-chaining)
- Ranked war tiers: Metal (entry) up to Bronze, Silver, Gold, Platinum, Diamond with four divisions each. — [FFScouter search summary](https://ffscouter.com/war-and-chaining) (snippet-level)
- Patch #386 (20 May 2025): point rewards removed from ranked wars and caches increased. Patch #346 (9 Jul 2024): auto-enlistment disabled after a faction finishes a ranked war. Patches #272-273 (Jan 2023, older): inactive factions lose a division every 2 weeks after a 10-week rest. — [Torn wiki Ranked War/Patch History](https://wiki.torn.com/wiki/Ranked_War/Patch_History) (seen only via search snippet; page 403 on fetch)
- Third-party war tooling exists: Ranked War Calculator (target decay/timings) and War Payout Predictor (cache payout estimates fitted to ~9,700 wars). — [Greasy Fork 536885](https://greasyfork.org/scripts/536885), [Greasy Fork 580583](https://greasyfork.org/scripts/580583-war-payout-predictor)
- API reflects live ranked-war state: `/faction/rankedwars` and `/faction/{id}/rankedwars` return war_id, start, end, target, winner, and per-faction score and chain. `/faction/chain` (and `/faction/{id}/chain`) return current, max, timeout (seconds until chain breaks), modifier, cooldown (timestamp), start, end. — [Torn OpenAPI spec](https://www.torn.com/swagger/openapi.json)

### Inferences
- High-impact overlay features follow from the scoring rules: chain-timer countdown with red/urgent states, "next milestone" and bonus-target tracker, target-decay countdown (1%/h after 24h), enemy-only (inside) hit filtering, retaliation window timers (5 min), enemy hospital timers to find hittable targets.
- Features that nudge the user toward outside hits near a milestone would be harmful; showing "this hit is inside/outside" is valuable.

### Gaps
- Territory war scoring/rules for 2025-2026: not found (only API endpoints exist, see Q5).
- Any 2026 ranked war / chain rule change: not verified (wiki fetch blocked). The FFScouter figures are community-sourced; verify milestone/cooldown values against the Torn wiki in-game before hard-coding.
- Official Torn wiki ranked-war page and exact Torn base-respect formula: not retrieved.

## Attacking meta: energy economy, hit outcomes, FF/respect, stat estimation, target finding

### Takeaway
War players burn energy via stacked Xanax plus refills/cans/job points, prefer "leave" for respect and short timers, hospitalize for retaliation or locks, avoid mug in serious wars, and rely on FF Scouter / TornStats-style estimates because exact opponent stats are not visible.

### Cited Findings
- Hit outcomes: Leave gives more respect than mug and short timers (~16-40 min) allow repeat farming; Mug gives less respect and provokes retaliation (avoid in serious wars); Hospitalize gives ~2-6h timers, used for locks, medical pressure or retaliation setups; leaving does not qualify for retal bonus. — [FFScouter guide](https://ffscouter.com/guides/war-and-chaining)
- Energy: Xanax 250 energy each, stacked 4x = 1,000 energy with cooldown waits; overdose adds ~25h cooldown. Other sources: energy refill (to 150 with donator status), energy cans, FHC, quarterly newsletter (250 energy or 100 nerve), job points (up to 100/day into energy perks), Mc Smoogle stock (100 energy per 7 days, cap 1,000/7d). Vicodin ~+25% stats for 5-6h. Use refills only when bar is empty. — [FFScouter guide](https://ffscouter.com/guides/war-and-chaining)
- Medical: small kits for small heals, blood bags for long hospital stays (wrong blood type can self-hospitalize), morphine when cooldown under ~70 min. — [FFScouter guide](https://ffscouter.com/guides/war-and-chaining)
- Fair Fight: multiplier on base respect, floor 1.0 for a much weaker defender, cap 3.0; battle stat score = sum of square roots of the four stats. A plausible form 1 + (8/3) x defender/attacker score was consistent with that behaviour but NOT verified as Torn's exact formula. — [FFScouter Fair Fight Explained](https://ffscouter.com/guides/fair-fight-explained) (snippet-level via search)
- FF Scouter V2 userscript overlays FF or estimated battle stats on every Torn page; needs a Torn API key sent to ffscouter.com (Custom key recommended); flight estimates are a Premium feature; authors Weav3r and xentac, service run by Glasnost. — [Greasy Fork FF Scouter V2](https://greasyfork.org/scripts/535292-ff-scouter-v2)
- FFScouter offers a Target Finder (filters on stat estimate and activity) and War Room (target queue/tracking). Estimation method is deferred to its Fair Fight Explained page and was not retrieved. — [FFScouter guide](https://ffscouter.com/guides/war-and-chaining)
- In-game visibility of FF: viewable in the faction chain / recent attacks view. — [FFScouter guide](https://ffscouter.com/guides/war-and-chaining)
- Data available for attacks via API v2: `Attack` objects include respect_gain, respect_loss, chain, is_ranked_war, is_raid, is_territory_war, is_stealthed, is_interrupted, finishing_hit_effects, modifiers; result enum: None, Attacked, Mugged, Hospitalized, Arrested, Looted, Lost, Stalemate, Assist, Escape, Timeout, Special, Bounty, Interrupted. — [Torn OpenAPI spec](https://www.torn.com/swagger/openapi.json)
- `/user/battlestats` returns own battle stats (limited key); `/user/{id}/personalstats` gives public personal stats usable for estimation. — [Torn OpenAPI spec](https://www.torn.com/swagger/openapi.json)

### Inferences
- A war overlay can add most value with: per-target FF/respect estimate, status (hospital/travel/okay) plus timers, "in my range" filter, retaliation-window alerts, and energy-bar / xanax cooldown readouts (via `/user/bars`, `/user/cooldowns`).
- TornStats spy data and FF Scouter estimates are third-party services with their own API-key ToS; integrating them requires disclosure (see Q4).

### Gaps
- Exact FF formula and FFScouter/TornStats estimation methodology: not retrieved (FFScouter explainer and Torn wiki not fetched).
- Current xanax/FHC market prices, nerve/energy cap changes in 2025-2026, armour/weapon meta: no reliable source found.
- TornStats guide content (tornstats.com/guides): only appeared as a search result title, not read.

## Recent 2025-2026 game updates affecting combat/factions

### Takeaway
I could verify very little. Only the May 2025 ranked-war reward change and the evolving API v2 (including a 2027 breaking change) surfaced.

### Cited Findings
- 20 May 2025: ranked war point rewards removed, caches increased (patch #386). — [Torn wiki patch history](https://wiki.torn.com/wiki/Ranked_War/Patch_History) (snippet)
- API v2 spec states v2 development is ongoing; unaltered selections default to v1 behaviour; the `Attack.chain` field notes: "Starting January 1st, 2027, the value '0' will be replaced with 'null'." — [Torn OpenAPI spec](https://www.torn.com/swagger/openapi.json)
- Attack log: `/torn/attacklog` exists (public key) returning per-turn log entries with text, timestamp, action, icon, attacker (with item), defender; attacker/defender may be null in stealthed attacks. `/user/attacks`, `/faction/attacks` need limited key (faction one with faction API permission); `ErrorEndpointClosedUntilAttackingPeriod` (code 32) exists, implying some endpoints are closed during certain periods. — [Torn OpenAPI spec](https://www.torn.com/swagger/openapi.json)
- Torn PDA exposes PDA_httpGet / PDA_httpPost for cross-origin requests from scripts, GM_ shims (GM_setValue/GM_getValue/GM_xmlhttpRequest) but not GM_registerMenuCommand, and substitutes the placeholder `###PDA-APIKEY###` with the user's key. — [torn-pda PR 162](https://github.com/Manuito83/torn-pda/pull/162), [Compatibility Layer TornPDA](https://greasyfork.org/it/scripts/546008-compability-layer-tornpda/code) (snippet-level)

### Inferences
- Code should tolerate `chain` being 0 now and null from 2027-01-01.
- Scripts should feature-detect GM_* functions for PDA compatibility.

### Gaps
- Organized Crimes 2.0 details, new items/armour, attack-log UI changes, Torn PDA changelog 2025-2026, API v1 sunset timeline: searches returned nothing relevant; no sources.

## Official rules for scripts and API use

### Takeaway
API: 100 requests/min per user across all keys, key-access tiers, mandatory ToS disclosure if keys/data are stored or shared, minimal-data principle, no ads/charging without permission. Scripting (non-API): community-consensus reading is one manual input per non-API request with pages loaded manually; no autoclickers; script review staff exist for edge cases. The official rules page itself was not retrievable.

### Cited Findings
- Access levels: Public, Minimal, Limited, Full; a key reaches selections at or below its level. Custom keys pick exact selections and "should be treated as if they are full-access keys"; log selection can be limited to 10 categories. `key` endpoint with `selections=info` shows permissions. — [Torn API page](https://www.torn.com/api.html)
- Rate limit: 100 requests per minute per user across all keys; exceeding gives error 5. Service cache up to 30s (a `timestamp` parameter bypasses it; cache hits do not count). Global-cache selections (itemmarket, properties, rentals, companies, bazaar, bounties) cannot be bypassed. Limits may change without notice; error 14 = daily read limit. Repeated invalid-key requests can cause a temporary IP ban (error 8). — [Torn API page](https://www.torn.com/api.html)
- Acceptable use: only ask users for an API key (never name/ID/password); keep keys and data confidential unless the owner permits; request only the data you need; no advertising/donations/charging without contacting Torn; any service that stores or shares a key or its data must show a ToS table where the key is entered (a statement that nothing is stored/shared suffices otherwise); opt-in integrations must link the other service's ToS; keys must only be used for stated purposes (also applies to keys bought from players); all requests are logged and users can see usage in their key log; misuse can mean permanent bans; services must comply with Torn's scripting rules. — [Torn API page](https://www.torn.com/api.html)
- Unfair advantage: Torn says the API should enhance gameplay without giving some users an edge; global caches exist partly for this. — [Torn API page](https://www.torn.com/api.html)
- Scripting rule as summarized by players (2023 thread): "one manual input per non-api request, and all pages must be loaded manually"; autoclickers banned. — [Forum: Scripting rules](https://www.torn.com/forums.php?p=threads&f=67&t=16482084&b=0&a=0) (search snippet; community opinion)
- 2017 wording quoted in a thread: scripts may use API data or a page the user loaded manually; non-API requests not manually triggered are disallowed and trackable. — [Forum: Scripting Abuse](https://www.torn.com/forums.php?p=threads&f=2&t=16000718&b=0&a=0rh%3D68) (snippet, older)
- 2025 thread: a one-click script buying 100 items was argued by one poster to be allowed (single user-triggered action) while others disputed; consensus unresolved. — [Forum: AutoClicker rules](https://www.torn.com/forums.php?p=threads&f=3&t=16358155&b=0&a=0) (snippet; community, disputed)
- Dec 2025 guide on rule-compliant AI userscripts refers edge cases to script-review staff member Velthir. — [Forum guide](https://www.torn.com/forums.php?p=threads&f=61&t=16527769&b=0&a=0) (snippet)
- Torn has a Tools & Userscripts forum section where scripts are listed. — [Torn Script Finder](https://greasyfork.org/en/scripts/586472-torn-script-finder)

### Inferences
- Safe design: read-only overlays using API data and DOM already on the page; every game-affecting action (attack, buy, send) must be a single user click with no chained/timed/auto requests; never auto-refresh game pages with non-API requests.
- Throttle: budget well below 100 req/min (e.g. cache 30s, batch with timestamp-free calls, back off on error 5); use the minimum key level (public/limited custom key); keep the key local and state in the script description that nothing is stored or sent elsewhere; any third-party service (FFScouter, TornStats) needs a ToS disclosure.
- For borderline features, ask script-review staff before shipping.

### Gaps
- Official rules.php / wiki Scripting page text could not be fetched; verbatim official wording and the current one-action-per-click statement are unconfirmed. Treat forum snippets as community interpretation.
- Torn PDA's own script-compliance policy: not found.

## Torn API v2 endpoints relevant to war overlays (incl. Halloween/competition)

### Takeaway
v2 (spec v6.13.8) has everything for a war overlay at public/limited key level: faction chain, rankedwars, wars, members, attacks, and a `/user/competition` endpoint whose Halloween variant returns treats collected and basket.

### Cited Findings
(All from the [Torn OpenAPI spec](https://www.torn.com/swagger/openapi.json), read directly.)
- Faction (public key unless noted): `/faction/chain` and `/faction/{id}/chain` (live chain: current, max, timeout, modifier, cooldown); `/faction/chains`, `/faction/chainreport`, `/faction/{chainId}/chainreport`; `/faction/rankedwars` and `/faction/{id}/rankedwars` (params offset, limit, from, to, sort); `/faction/{rankedWarId}/rankedwarreport`; `/faction/wars` and `/faction/{id}/wars` (wars and pacts); `/faction/warfare` (cat param), `/faction/warfareranked`, `/faction/warfarechains`, `/faction/warfareterritory`, `/faction/warfareraids`; `/faction/territory`, `/faction/{id}/territory`, `/faction/territorywars`, `/faction/{territoryWarId}/territorywarreport`, `/faction/territoryownership`; `/faction/raids`, `/faction/{raidWarId}/raidreport`; `/faction/rackets`; `/faction/members` and `/faction/{id}/members` (revive_setting only populated with faction permissions); `/faction/basic`, `/faction/hof`, `/faction/search`, `/faction/crimes` (organized crimes), `/faction/news`, `/faction/revives`.
- Attacks: `/faction/attacks` (detailed) and `/faction/attacksfull` (simplified) need a limited key with faction API access permission; `/user/attacks`, `/user/attacksfull` (up to 1,000 rows) limited key; `/torn/attacklog` public.
- User: `/user/battlestats` (limited), `/user/bars`, `/user/cooldowns`, `/user/basic`, `/user/profile`, `/user/{id}/profile`, `/user/{id}/basic`, `/user/{id}/personalstats`, `/user/{id}/faction`, `/user/{id}/icons`, `/user/events`, `/user/newevents`, `/user/{id}/bounties`.
- Competition: `/user/competition` (own) and `/user/{id}/competition` (public key). Response `competition` is one of: Halloween {name:"Halloween", treats_collected:int, basket:{id,name}}; Easter Egg Hunt {score,total}; Rock-Paper-Scissors; Elimination. Error `NoCompetitionAvailable` exists when no competition is active.
- Elimination: `/torn/elimination` (standings for all teams), `/torn/{id}/eliminationteam` (players in a team).
- Torn static data: `/torn/items`, `/torn/{ids}/itemdetails`, `/torn/honors`, `/torn/factiontree`, `/torn/calendar` (possible source of event dates), `/torn/bounties`.
- v2 spec notes: v2 accepts selections and IDs as path and query params; unaltered selections default to v1; use a custom User-Agent when polling openapi.json because Cloudflare may block defaults.

### Inferences
- Minimal war-overlay call set: `/faction/chain` + `/faction/rankedwars` (or `/faction/wars`) every ~10-30s (cache is 30s), `/faction/{enemyId}/members` for enemy status, `/user/bars`+`/user/cooldowns` for energy/drugs; `/user/competition` for a Halloween treats counter; `/torn/calendar` for event timing.
- Since the Halloween competition only exposes treats_collected and basket, there is no API for treat locations or competitor ranking in the spec; any treat-finding feature would have to read the DOM (subject to the manual-input rule).

### Gaps
- Whether the 2026 Halloween event actually runs and its mechanics (and whether it affects combat): web search found nothing about Torn Halloween 2026.
- Field-level detail of `/faction/members` (status, last_action) and rate cost not enumerated here; read the schema if needed.
