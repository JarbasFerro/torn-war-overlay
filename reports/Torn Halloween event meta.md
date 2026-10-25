# Turn Halloween wins into a treat engine

Torn's Halloween event, "Trick or Treat", pays out per easy win. Each attack you start and win with the final hit can drop a **treat**, the base chance is **35%**, and a basket that upgrades as you collect treats raises that chance by 5% per step, up to **100%** with the best basket and both scary bonuses. Target strength does not matter, and neither does whether the target is active or inactive, or whether you leave, mug, hospitalize or arrest them ([Trick or Treat wiki](https://wiki.torn.com/wiki/Trick_or_Treat) (read 25 Oct 2026)). So the best strategy has nothing to do with war tactics. Spend as much energy as you can on the weakest players you are sure to beat, finish each fight with a "scary" weapon, and spend treats on basket upgrades rather than exchanging them early. The 2026 event is confirmed: the wiki cites the 23 October 2026 announcement ("Don't Be a Hallo-Weenie"), baskets went on sale at 12:00 TCT on 24 October, and each player gets a 7-day window starting at their own timeslot (an 11 AM slot runs from 25 October 11:00 to 1 November 10:00 TCT). The numbers below come from that wiki page, read on 25 October 2026; a few smaller items still need an in-game check. For torn-war-overlay this is good news. The v0.23 hunt mode (`torn-war-overlay.user.js:5677`) already does the hard part, which is finding a steady supply of near-certain wins. The best additions are cheap: a live treat counter and yield tracker from Torn's official `/user/competition` endpoint, a hunt-mode finishing hint written for Halloween instead of war, and a guard so event hunting doesn't waste a faction chain bonus or ranked-war energy.

## The war meta rewards precise respect, the event rewards raw win volume

The current faction-war meta is about respect. A ranked war is won by the first side to get **ahead of the other by a target score**. Only "inside" hits on enemy-faction members count, with a **x2** war multiplier. After 24 hours the target shrinks by **1% of the original per hour**, and a war lasts at most **123 hours** ([FFScouter war guide](https://ffscouter.com/guides/war-and-chaining)). Chains break if more than **5 minutes** pass between hits. Milestone hits pay a bonus (hit 10 gives 10 respect, hit 100 gives 80, hit 1,000 gives 640), but in a ranked war the bonus only counts if the milestone hit lands on an enemy. A milestone hit on an outsider wastes it, which is why teams assign a protected "bonus target" ([FFScouter war guide](https://ffscouter.com/guides/war-and-chaining)). Experienced players stack Xanax (**250 energy** each), use Fair Fight to aim for the **3.0 respect cap**, prefer "leave" over "mug", and use hospitalization to lock out active enemies or set up retaliation, which pays **x1.5** ([FFScouter war guide](https://ffscouter.com/guides/war-and-chaining)). The only verified recent rule change is patch #386 (20 May 2025), which removed point rewards from ranked wars and increased caches ([Ranked War patch history](https://wiki.torn.com/wiki/Ranked_War/Patch_History)). Nothing was verified for 2026. The overlay already covers most of this meta with verdicts, EV, `BEST`, the chain bonus chip and the decay readout.

Halloween flips the priorities. The wiki says "any attack on any player can reward a treat". Assists, defends and losses give nothing, and you must win and land the final hit ([Halloween guide 2025](https://www.torn.com/forums.php?p=threads&f=61&t=16504610&b=0&a=0)). Respect, Fair Fight and target quality stop mattering. What counts is **wins per unit of energy**, and a loss is the worst result: it costs 25 energy and pays nothing. That is exactly the trade-off hunt mode was built for. It only keeps targets whose worst-case strength is under 60% of yours, roughly a **93% win chance at worst** (`torn-war-overlay.user.js:5700`, `:5841`). The plain verdict: during the event, use hunt mode, not the war panel. Only switch back if your faction is actually fighting.

The event appears to be **individual**. No team scoring, leaderboard or faction component was found in any source, and nothing describes special rules for event hits during chains or wars. The faction angle therefore comes from how ordinary Torn rules interact with heavy event attacking (covered below), not from any event feature.

## Baskets compound across years, so the first treats matter most

You join by buying a **Spooky basket for $35** at Sally's Sweet Shop (level 5 or higher, one per player). Baskets go on sale for everyone at 12:00 TCT on 24 October, whatever your own start time is. The basket stays on your account forever, needs no re-buying and cannot be traded or sold, so "open or sell" is not a real choice. It upgrades itself for free, but **only treats earned from attacks move it up**. Treats you get from upgrades (for example Mortal Coil's free hourly treat) do not. Spending treats does not lower your tier ([Trick or Treat wiki](https://wiki.torn.com/wiki/Trick_or_Treat) (read 25 Oct 2026)). Three tiers carry an honor bar: Frightful ("Phantastic"), Terrifying ("Something Humerus") and Nightmarish ("Oh My Gourd!").

Your base chance is 35% and every basket upgrade adds 5%, so Spooky is 35% and Nightmarish (nine steps up) is 80%.

| Basket (item ID) | Treats needed | Treat chance | Honor bar |
|---|---|---|---|
| Spooky (#920) | 0 (bought at Sally's) | 35% | |
| Creepy (#1003) | 5 | 40% | |
| Freaky (ID unknown) | 10 | 45% | |
| Frightful (#1005) | 25 | 50% | Phantastic |
| Haunting (ID unknown) | 50 | 55% | |
| Shocking (ID unknown) | 100 | 60% | |
| Terrifying (ID unknown) | 250 | 65% | Something Humerus |
| Horrifying (#1009) | 500 | 70% | |
| Petrifying (#1010) | 1,000 | 75% | |
| Nightmarish (#1011) | 2,500 | 80% | Oh My Gourd! |
| Apocalyptic (#1448) | only by summoning M'aol (Summon Him upgrade) | not stated | |

Source: [Trick or Treat wiki](https://wiki.torn.com/wiki/Trick_or_Treat) (read 25 Oct 2026).

Two more bonuses sit on top of the basket. Wearing **one** scary clothing item gives +10% (extra pieces don't add more), and landing the **final hit with a scary weapon** gives another +10%. You can use other weapons earlier in the fight. Both bonuses are tier I upgrades you must buy first: **"I See Dead People" (3 treats)** and **"Here's Johnny" (5 treats)**. The total tops out at 100%: Nightmarish 80% plus both bonuses. Treats can never be lost, even if you are attacked ([Trick or Treat wiki](https://wiki.torn.com/wiki/Trick_or_Treat) (read 25 Oct 2026)).

Next come the multiplier upgrades, each a small chance to multiply the treats from a win: Doubler (25 treats, 20% chance of x2), Tripler (50, 10% of x3), Quadrupler (75, 5% of x4) and Quintupler (100, 1% of x5). They stack, so with Doubler and Tripler there is a 2% chance of 6 treats from one win. Community estimates for a fully upgraded basket land at about **1.5 to 1.7 treats per attack**, but that figure is anecdotal ([forum 16505689](https://www.torn.com/forums.php?p=threads&f=61&t=16505689&b=0&a=0rh%3D10), [forum 16420719](https://www.torn.com/forums.php?p=threads&f=61&t=16420719&b=0&a=0rh%3D53)).

All upgrades, with cost and (in brackets) the running total within each group. The wiki sorts them into four tiers: tier I from the start, tier II at Frightful, tier III at Shocking and tier IV at Horrifying. The tier II grouping is read from the table layout (its running total restarts at Candyman), so treat that one as most likely rather than certain.

| Tier | Upgrade | Cost (running) | Effect |
|---|---|---|---|
| I | I See Dead People | 3 (3) | +10% chance with any scary clothing |
| I | Here's Johnny | 5 (8) | +10% chance when the final hit uses a scary weapon |
| I | Doubler | 25 (33) | 20% chance to double a win's treats |
| I | Tripler | 50 (83) | 10% chance to triple |
| I | Quadrupler | 75 (158) | 5% chance to quadruple |
| I | Quintupler | 100 (258) | 1% chance to quintuple |
| II | Candyman | 5 (5) | Exchange can give medium candy (Bag of Bloody Eyeballs) |
| II | Sweet Release | 10 (15) | High candy (Bag of Chocolate Truffles) |
| II | Bloody Mary | 15 (30) | Medium alcohol (Bottle of Wicked Witch) |
| II | Nice Chianti | 30 (60) | High alcohol (Bottle of Stinky Swamp Punch) |
| II | Nightcrawler | 45 (105) | Medium energy drink (Can of Munster) |
| II | It's Alive | 90 (195) | High energy drink (Can of Red Cow) |
| III | Cat in Hell | 13 (13) | 1 in 500,000 chance per attack of instantly getting 1,000 treats |
| III | Save Your Tears | 95 (108) | +500 happiness per treat exchanged |
| III | Freebie | 120 (228) | One bonus item per 10 received on exchange |
| III | Cold Sweat | 170 (398) | +1 nerve per treat exchanged |
| III | Cashback | 230 (628) | 10% of exchanged treats come straight back |
| III | Dark Power | 285 (913) | +5 energy per treat exchanged |
| IV | Multipack | 180 (180) | 2% chance exchange rewards upgrade to multipacks (Six Pack of Alcohol or Energy Drink) |
| IV | Deal With The Devil | 320 (500) | 3% chance rewards upgrade to boosters (Erotic DVDs, Feathery Hotel Coupons) or special items (Business Class Ticket, Casino Pass) |
| IV | Mortal Coil | 500 (1,000) | 1 free treat every hour while the event runs (follows your timeslot) |
| IV | Inflation | 777 (1,777) | Treats you hold grow 0.1% per hour |
| IV | Shadow Of Doubt | 1,000 (2,777) | Gives exactly 1,100 treats ("Probably...?" says the wiki) |
| IV | Summon Him | 9,999 (about 12,7xx) | Summons M'aol and uses up the 9,999 treats |

Source: [Trick or Treat wiki](https://wiki.torn.com/wiki/Trick_or_Treat) (read 25 Oct 2026).

Here is the arithmetic in plain terms, at 25 energy per attack, before multipliers. The chance per win is 35% plus 5% for each basket step, plus 20% once you own both gear upgrades and wear and wield the scary items. A first-year player reaches Creepy almost at once (40%, so 60% with both bonuses), which is about **6 treats per Xanax** (10 attacks). At Frightful (three steps, 50%) the total is 70%, about **7 treats per Xanax**. At Nightmarish it is 80% plus 20%, so **100%, or 10 treats per Xanax**, plus whatever the multipliers add. A veteran with a fully upgraded basket reports about 15 to 17 from the same Xanax, which matches the 1.5 to 1.7 community figure. The first 8 treats you spend on the two gear upgrades raise your chance from 35% to 55%, the best return you will get on any treats, so buy those two first, then the multipliers.

Treats are exchanged all at once ("Exchange All") for cans, candy or alcohol, and the tier II upgrades unlock the better pools. Player guides are blunt: **"Never press Exchange all"** in your first or second year, because early exchange returns are poor and treats spent on upgrades keep paying ([Halloween guide 2025](https://www.torn.com/forums.php?p=threads&f=61&t=16504610&b=0&a=0)). The wiki gives a second reason to hold on: Inflation grows held treats 0.1% an hour and Mortal Coil adds one free treat every hour, and Inflation only pays if you keep treats through the event. Dark Power is the big reason to exchange later, at +5 energy for every treat exchanged. Upgrading and exchanging both use treats up for good. Dollar values of the exchange rewards are not on the wiki, so any claim about what a treat is worth in money is unsupported. The top of the ladder changed in 2025: summoning M'aol to reach Apocalyptic now takes away the summoner's 9,999 treats, whereas in 2024 the summoner kept them ([M'aol wiki](https://wiki.torn.com/wiki/M'aol)). Only players near the very top of the ladder need to care about this.

Getting the two +10% bonuses is cheap. Wear exactly **one** scary clothing item (a second adds nothing). The cheapest by recent market price are the Moustache Man Mask (about $12k), Kabuki Mask (about $24k), Scarred Man Mask (about $29k), Nun Mask (about $30k) and Ginger Kid Mask (about $31k). Then finish each fight with any of the 11 scary weapons: Axe, Blood Spattered Sickle, Bone Saw, Chainsaw, Cleaver, Crystalline Falcata, Devil's Pitchfork, Golden Broomstick, Meat Hook, Petrified Humerus and Wand of Destruction. Only the last hit needs the scary weapon ([Trick or Treat wiki](https://wiki.torn.com/wiki/Trick_or_Treat) (read 25 Oct 2026)).

Energy is what limits everyone. Guides list the usual sources: Xanax, Feathery Hotel Coupons, restaurant specials, the quarterly newsletter's +250 energy, and job points (capped at 100 a day). They give three pacing warnings. Don't spend energy before the event starts (mind TCT versus local time). Skip gym training while the event runs. Skip revives ([Halloween Energy Guide](https://www.torn.com/forums.php?p=threads&f=61&t=16394073&b=0&a=0), [forum 16511724](https://www.torn.com/forums.php?p=threads&f=61&t=16511724&b=0&a=0)). For finding targets, guides point to Donator Advanced Search for inactive players and FF Scouter for difficulty ([forum 16505689](https://www.torn.com/forums.php?p=threads&f=61&t=16505689&b=0&a=0rh%3D10)). Hunt mode already does both jobs in-house, without a third-party service.

## Faction returns come from avoiding costly overlaps, not from event scoring

With no team component, a faction gets the most from Halloween by letting members farm hard while protecting war and chain results. Two ordinary rules decide this. First, outside hits during a ranked war score zero for the war, so every Xanax a member spends hunting is energy not spent on enemies ([FFScouter war guide](https://ffscouter.com/guides/war-and-chaining)). Second, chain milestones count only on enemy hits, so a hunter who lands faction hit #100 on a random weak player throws away the 80-respect bonus ([FFScouter war guide](https://ffscouter.com/guides/war-and-chaining)). The plain verdict for leaders: if a war overlaps the event, schedule farming windows away from scoring pushes, and tell members to check the chain counter before each hunt hit near a milestone. Outside a war there is a likely upside: a group of members farming at the same time could keep a non-war chain alive cheaply, because they are attacking anyway. This is an inference. No source confirms that event hits count toward chains, so test it before planning around it.

Hitting weak, inactive players also has a timing side. Guides say "leave" gives short hospital stays (about **16 to 40 minutes**) and hospitalizing gives **2 to 6 hours** ([FFScouter war guide](https://ffscouter.com/guides/war-and-chaining)). In war, hospitalizing an active enemy keeps them off your faction. In a treat hunt it just removes a reusable easy win from your own pool for hours. The wiki confirms that leave, mug, hospitalize and arrest all give the same treat chance, so the finishing option does not matter for treats. **Leave** is still the right choice for hunting, purely because it gets the target back in your pool sooner ([Trick or Treat wiki](https://wiki.torn.com/wiki/Trick_or_Treat) (read 25 Oct 2026)).

## Eight overlay features, ranked by impact against effort

Status: features 1 to 3 (treat counter, Leave plus scary-weapon hint, chain and war guard) have shipped in v0.27.0. The descriptions below are the original design. Feature 5 can now be built on the verified thresholds and the 5%-per-step chance.

Every recommendation follows Torn's rules as far as they could be confirmed. API use is capped at **100 requests a minute per user across all keys**. Responses are cached for up to 30 seconds. Any service that stores or shares key data must show a ToS disclosure table ([Torn API page](https://www.torn.com/api.html)). The community reading of the scripting rules is "one manual input per non-API request, and all pages must be loaded manually", and autoclickers are banned ([Scripting rules thread](https://www.torn.com/forums.php?p=threads&f=67&t=16482084&b=0&a=0)). The official rules page could not be fetched, so that wording is still community interpretation. All the features below are read-only API or DOM work, and the user still opens every attack. The key enabling fact comes from the live v2 OpenAPI spec (v6.13.8), which was read directly. **`/user/competition`** (and `/user/{id}/competition`, public key) returns `{name: "Halloween", treats_collected, basket: {id, name}}`, and returns `NoCompetitionAvailable` when no event is running. **`/torn/calendar`** exposes the event schedule ([Torn OpenAPI spec](https://www.torn.com/swagger/openapi.json)). The repo uses neither yet: a grep for "competition", "treat" and "basket" finds no event code.

| Rank | Feature | Impact | Effort | Builds on |
|---|---|---|---|---|
| 1 | Treat counter and measured yield in the hunt dock | High | Low | `onAttackFightFinished` `:6479`, `huntSession`/`huntRecordResult` `:6216`-`:6227`, `renderHuntDock` `:6367`, `renderHuntDetail` `:6452` |
| 2 | Halloween finishing hint in hunt mode | High | Very low | dock hint `:6410`-`:6416`, `finishHintFor` `:2202` |
| 3 | Chain and war guard on the hunt dock | High for factions | Low | `getChainSnapshot` `:1782`, `refreshOwnChain` `:1753`, `refreshWarContext` `:4079`, `loadNextTarget` bonus check `:6540`-`:6541` |
| 4 | Event window and countdown from the API | Medium | Low | hunt toggle `:6135`-`:6147`, `serverNowSec` `:1183` |
| 5 | Basket ladder progress and "buy these first" card | Medium | Low | `renderHuntDetail` `:6452`, tools sheet `:4842` |
| 6 | Outcome-versus-treat log to settle unknown rules | Medium | Low | `classifyFightLine` `:5593` (already captures leave/hosp/mug method) |
| 7 | Energy-to-treats projection until event end | Medium | Medium | `ownBars` / `refreshOwnBars` `:6565`, `huntAvailableGoal` `:5898` |
| 8 | Faction treat board | Low to medium | Medium | faction roster fetch `/faction/{id}/members` `:4488` |

**1. Treat counter and measured yield.** Call `/user/competition` once when the hunt dock opens and once a few seconds after each finished fight. The 4-second and 15-second follow-up timers in `onAttackFightFinished` (`:6484`-`:6485`) are the natural hook. Show `🍬 1,234 (+2)` next to the energy chip, and put **treats per attack** and **treats per 100 energy** for the current session in the details sheet. That is about one extra request per fight, far below the hunt worker's ~40 a minute (`:5694`). The win and loss counts per day already live in `huntSession` (`:6216`), so the yield is just the treat change divided by wins. This is the most valuable feature because it turns the uncertain community figures (35%, 1.5 to 1.7 per attack) into the user's own measured numbers. It also covers both the "how am I doing" and "is this working" questions in one chip. Store only the counter locally, and add a line to the README ToS table, which already covers the hunt pool (`README.md`, "API, privacy and safety").

**2. Halloween finishing hint.** The hunt dock reuses the war rule from `finishHintFor` (`:2202`). An online target currently produces "If you win: Hospitalize, they are active right now" (`:6414`), and that rule exists to keep enemies off your faction. In hunt mode it pushes a reusable easy target out of the pool for hours. While hunting, the hint should default to "Leave" and add "Finish with your scary weapon (+10%)". Attack type does not affect treats, so the "Leave" part is only about getting the target back sooner. Treat it as a few lines of text with a tooltip carrying the reasoning. It fixes advice that is currently wrong for this context, at almost no cost.

**3. Chain and war guard.** The hunt dock never checks the faction's chain or war state. Its only chain-aware path is the war-panel `loadNextTarget` (`:6540`-`:6541`), which hunt mode bypasses (`:6495`). If `getChainSnapshot().bonusNext` is true, the dock should say plainly: "Your faction's next hit is chain bonus #100: land it on an enemy, not a hunt target". If an active ranked war is cached, it should note: "Your faction is at war: hunt hits score nothing for the war". This blocks nothing and makes no extra clicks. The chain call is already paced at 30 seconds (`:88`). For factions this is the single most expensive mistake the event invites.

**4. Event window.** The window is per player: baskets go on sale at 12:00 TCT on 24 October, and each player's 7 days run from their own timeslot (an 11 AM slot ends 1 November 10:00 TCT) ([Trick or Treat wiki](https://wiki.torn.com/wiki/Trick_or_Treat) (read 25 Oct 2026)). Read `/torn/calendar` once a day instead of hardcoding dates. Use it to show "Halloween: 6d 4h left" on the `HUNT` toggle (`:6141`, whose title already mentions Halloween), to warn "event not started: save your energy", and to stop suggesting hunt mode once the event ends. The `NoCompetitionAvailable` error from `/user/competition` works as a second signal. The calendar's response schema was not read in detail, so check it before building on it.

**5. Basket ladder card.** With `basket.id` and `treats_collected` from feature 1, the details sheet can show "Frightful → Haunting in 37 treats" and a short checklist for new players: buy I See Dead People and Here's Johnny first, then Doubler, and don't Exchange All in your first years. Use the verified thresholds (5, 10, 25, 50, 100, 250, 500, 1,000, 2,500) and the chance of 35% plus 5% per step. Item IDs for Freaky, Haunting, Shocking and Terrifying stay unknown, so key the card on treat counts, not IDs. Keep the table in one constant.

**6. Outcome log.** `classifyFightLine` (`:5593`) already records whether a win was a leave, mug or hospitalize. Pair each outcome with the treat change from feature 1 and show the user a running split in the details sheet, such as "Leave: 40 wins, 26 treats; Hosp: 12 wins, 8 treats". The wiki already says the outcome does not change the treat chance, so this log is now only a sanity check of that claim and of the real yield. It needs no new requests.

**7. Energy projection.** Combine current energy (already read on the attack page) with the measured yield and the time left, and show "Energy on hand: about 14 more hits, about 9 treats". Xanax cooldown would need `/user/cooldowns`, which the repo doesn't call yet, and natural regen rates were not part of this research. Start with energy on hand only.

**8. Faction treat board.** `/user/{id}/competition` takes a public key. Reading it for every member of the user's own faction, spread out over minutes and refreshed every half hour or so, would give leaders a simple standings list without any backend. It is read-only and shares no data, which fits the current ToS table. It ranks last because the event has no faction reward, so the value is purely motivational.

Two ideas are deliberately left off. A **shared faction hunt pool** would need a backend or a third-party service, which breaks the repo's "no data sharing" disclosure and would need a new ToS table. A **basket restock watcher** that reloads Sally's Sweet Shop would break the manual page-load rule, and the basket is a one-time $35 purchase anyway. Baskets restock 1,000 every 5 minutes according to the latest patch note ([Trick or Treat wiki](https://wiki.torn.com/wiki/Trick_or_Treat) (read 25 Oct 2026); the page's intro text still says every 15 minutes).

## What to check in-game before coding against it

The event rules, basket thresholds, upgrade list and dates now come from the [Trick or Treat wiki](https://wiki.torn.com/wiki/Trick_or_Treat) (read 25 Oct 2026). The forum guides cited earlier are anecdotal, and the API facts come from Torn's OpenAPI spec. The table lists what is still open.

| Open item | Why it matters | Quick check |
|---|---|---|
| Whether `treats_collected` is lifetime treats or spendable treats, and how fast it updates after a fight | Feature 1's per-fight change, feature 5's progress | Call `/user/competition` before and after one win, and again after an upgrade purchase |
| Exact tier II grouping (Candyman group assumed to be the Frightful tier) | Upgrade table wording | Upgrade screen on the basket page |
| Item IDs for Freaky, Haunting, Shocking, Terrifying | Only if a feature wants IDs | Basket items in the inventory |
| Event hits count toward faction chains | Feature 3 wording, chain-while-farming idea | Faction chain counter after one hunt hit |
| Exchange rates and reward market prices | Any treat-to-money advice | Exchange screen and item market |
| Current official wording of the scripting rules | All features | Torn rules page, or ask script-review staff (a Dec 2025 guide names Velthir) ([forum guide](https://www.torn.com/forums.php?p=threads&f=61&t=16527769&b=0&a=0)) |

## Conclusion

The main finding is that Torn's Halloween meta and torn-war-overlay's hunt mode were already lined up before anyone checked. Hunt mode was built on the intuition that volume beats quality, and the event's rules ("any attack on any player", win plus final hit, losses pay nothing) confirm it. The gap is not finding targets. It is feedback: right now the user has no idea whether a hunt session is producing treats, and the dock still gives war advice ("Hospitalize, they are active") that works against farming. Because the official `/user/competition` endpoint exposes treat totals with a public key, the overlay can be the one tool that measures the event's actual payoff for its user, using about one request per fight.

That measurement still matters. The wiki gives the chance per win, but the real yield with multipliers is only known through community estimates, and the script can measure it from the user's own fights. Features 1, 2 and 3 have shipped in v0.27.0. They fix advice that was wrong for hunting, protect faction results, and will settle the remaining open questions above within the first day or two of play. Feature 5 (basket progress) is the next sensible build.
