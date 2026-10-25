# Torn Trick or Treat: farming mechanics, upgrades, exchange, tools

Method caveat: every direct fetch (torn.com, wiki.torn.com, web.archive.org, old.reddit.com, tornstats.com, tornindex.com) failed (403, blocked, or empty). The sandbox also had no outbound network for curl or gh. All findings below come from WebSearch result summaries of those pages, not from reading the pages. Treat figures as second-hand and verify in-game. Torn forum guides are player-written (anecdotal/community). The wiki is the closest to official. Searches never surfaced reddit, github or greasyfork Halloween content for Torn.

## 1. Base treat chance, attack outcome, targets, cooldowns, energy-optimal loop

### Takeaway
Base chance is 35% per qualifying win, and the cap is 100% with a Nightmarish basket plus scary clothing and a scary finishing weapon. Per-target rules, outcome (leave/mug/hosp) effects, cooldowns and diminishing returns were not found. Community estimates are about 1.5 to 1.7 treats per attack at high basket level.

### Cited Findings
- Base treat chance per attack, before basket/weapon/clothing bonuses, is 35% (community guide, 2021-2025 range) — [Torn forum guide, via search summary](https://www.torn.com/forums.php?p=threads&f=2&t=16424442&b=0&a=0)
- Wiki table: treat chance rises from 35% (base basket) to 80% (Nightmarish basket); only treats earned through an attack trigger basket evolution; "any attack on any player can reward a treat" (official wiki, year not stated) — [Torn wiki Trick or Treat](https://wiki.torn.com/wiki/Trick_or_Treat)
- Maximum is 100%: 35% base + 45% Nightmarish basket + 10% clothing + 10% weapon; cannot exceed 100% (community guide) — [Torn forum](https://www.torn.com/forums.php?p=threads&f=2&t=16424442&b=0&a=0)
- Average yield estimates: about 1.5 treats per attack (one guide) and about 1.7 at max basket (another); includes multiplier upgrades (community, 2024-2025) — [forum 16505689](https://www.torn.com/forums.php?p=threads&f=61&t=16505689&b=0&a=0rh%3D10), [forum 16420719](https://www.torn.com/forums.php?p=threads&f=61&t=16420719&b=0&a=0rh%3D53)
- Some guides suggest a Revitalize SMG for more attacks at a slightly lower treat rate (community, 2024) — [2024 One Stop Reference](https://www.torn.com/forums.php?p=threads&f=2&t=16424442&b=0&a=0)
- Target finding: use Donator Advanced Search for inactive/offline players, FF Scouter to estimate difficulty, claim bounties (community) — [forum 16505689](https://www.torn.com/forums.php?p=threads&f=61&t=16505689&b=0&a=0rh%3D10), [Halloween Prep](https://www.torn.com/forums.php?p=threads&f=61&t=16353057&b=0&a=0)
- Energy sources discussed: restaurant energy specials, Feathery Hotel Coupons (FHC, 150E each in 2024 table), Xanax (250E each in that table), quarterly newsletter +250E, job-point exchange capped 100/day, MCS stock purchase a week before for up to 2,000E (community, 2023-2025) — [Halloween Energy Guide](https://www.torn.com/forums.php?p=threads&f=61&t=16394073&b=0&a=0), [forum 16420719](https://www.torn.com/forums.php?p=threads&f=61&t=16420719&b=0&a=0rh%3D53)
- Pacing warnings: don't spend energy before the event starts (TCT vs local time), skip gym training and revives during event (community) — [forum 16511724](https://www.torn.com/forums.php?p=threads&f=61&t=16511724&b=0&a=0)
- Basket sale: wiki says baskets go on sale the day before the event (24 Oct 12:00 TCT in the version seen); starter Spooky basket needs level 5; one guide says $35 from Sally's Sweet Shop; restock figures conflict (wiki 1,000 per 15 min vs Torn Stats guide 100 per 15 min) — [wiki](https://wiki.torn.com/wiki/Trick_or_Treat), [Torn Stats guide](https://www.tornstats.com/guides/show/48)

### Inferences
- If a quick fight counts the same as a long one (unconfirmed), the cheapest loop is the fewest-turn win with a scary weapon landing the final hit. Energy per attack is the fixed cost (25 per your brief), so expected treats per 100 energy is roughly 4 attacks x 1.5 to 1.7 = 6 to 7 treats at a max basket.
- Date conflicts (end 1 Nov vs 3 Nov in different sources) mean the end time should come from the API or in-game text, not hardcoded.

### Gaps
- Whether outcome (leave/mug/hospitalize) changes chance: not found.
- Whether target level, stats, or activity changes chance: not found. The wiki wording ("any attack on any player") suggests no, but this is unverified.
- Per-target cooldowns or diminishing returns: not found.
- Whether a quick (fewer-turn) fight counts the same: not found.
- Exact wiki 25-energy figure and refill math were not verified here.

## 2. Scary clothing and weapons

### Takeaway
Each gives +10%: one scary clothing item (extra pieces do not stack) and a scary weapon that lands the final hit. The wiki lists 11 scary weapons. Per the guide summary, the upgrades "I See Dead People" (clothing) and "Here's Johnny" (weapon) are what activate these bonuses.

### Cited Findings
- Clothing +10%, only one piece counts; weapon +10% only on the finishing blow; other weapons and temporary items may be used earlier (community guides, wiki agrees on 10% each) — [Torn forum 16424442](https://www.torn.com/forums.php?p=threads&f=2&t=16424442&b=0&a=0), [wiki](https://wiki.torn.com/wiki/Trick_or_Treat)
- "I See Dead People" (3 treats) and "Here's Johnny" (5 treats) are tier I upgrades; one guide says they grant the +10% clothing/weapon bonuses (wiki costs; guide effect) — [wiki](https://wiki.torn.com/wiki/Trick_or_Treat)
- Wiki says there are currently 11 scary weapons; lists differ slightly between guides (Bone Saw added in a later year). Examples named: Axe, Chainsaw, Sickle; clothing examples: Kabuki Mask and other horror masks (community) — [Scary Weapon wiki](https://wiki.torn.com/wiki/Scary_Weapon)

### Inferences
- The 10% bonuses probably need the matching upgrade bought first; buy those two early (8 treats total).

### Gaps
- Full current list of qualifying clothing items: not retrieved.
- Whether weapon bonus requires the weapon be equipped in a specific slot: not found.

## 3. Upgrade perks, costs, recommended order

### Takeaway
Tier I costs are known from the wiki. Costs for later perks conflict between guide years. Cashback and Dark Power have some detail; Sweet Release, Mortal Coil, Inflation and Bloody Mary remain thin.

### Cited Findings
- Basket levels and boosts: Creepy +5%, Frightful +15%, Horrifying +35%, Petrifying +40%, Nightmarish +45% (the last from the guide above; an older Torn Stats guide said Nightmarish +45%, while the wiki table tops at 80% total, consistent with 35+45); Petrifying auto-upgrades to Nightmarish after 2,500 additional treats (4,400 total); Frightful to Haunting at 90 total; Horrifying to Petrifying at 1,940 total. Baskets are not tradable and one per player. Torn Stats lists Creepy at 5 treats up to Nightmarish at 2,500. Leveling the basket does not consume treats. Upgrades carry over each year — [Horrifying](https://wiki.torn.com/wiki/Halloween_Basket_:_Horrifying), [Petrifying](https://wiki.torn.com/wiki/Halloween_Basket_:_Petrifying), [Frightful](https://wiki.torn.com/wiki/Halloween_Basket_:_Frightful), [Torn Stats guide](https://www.tornstats.com/guides/show/48)
- Tier I upgrades (wiki): I See Dead People 3, Here's Johnny 5, Doubler 25, Tripler 50, Quadrupler 75, Quintupler 100 treats. Doubler/Tripler/Quintupler are chance-based multipliers on treats from an attack — [wiki](https://wiki.torn.com/wiki/Trick_or_Treat)
- One community guide: Doubler 20% chance to double; Tripler 10% chance to triple (cumulative cost 33 and 83 treats) — [forum 16505689](https://www.torn.com/forums.php?p=threads&f=61&t=16505689&b=0&a=0rh%3D10)
- Tier II: Candyman (5 treats in one guide) unlocks mid-tier candy (e.g. Bag of Bloody Eyeballs); Sweet Release unlocks high-tier candy; Bloody Mary unlocks better alcohol (wiki, via summary) — [wiki](https://wiki.torn.com/wiki/Trick_or_Treat)
- Freebie: 120 treats in an older guide, gives a free treat per 10 exchanged. Dark Power: 285 treats, gives 5 energy per treat exchanged. Cashback: 10% of exchanged treats returned. Inflation: described by one guide as +0.1% basket per hour (single-source, unclear) — older community posts, [forum 16505689](https://www.torn.com/forums.php?p=threads&f=61&t=16505689&b=0&a=0rh%3D10), [Halloween thread](https://www.torn.com/forums.php?p=threads&f=61&t=16420719&b=0&a=0rh%3D6)
- Advice: "Never press Exchange all" in year 1 or 2, spend on upgrades first (community) — [Halloween guide 2025](https://www.torn.com/forums.php?p=threads&f=61&t=16504610&b=0&a=0)
- A guide series exists organized by year: "Trick or Treat Upgrades Guide 1-4 Years" and "Halloween guide 2025 - 1st, 2nd and 3rd year" — [Upgrades Guide](https://www.torn.com/forums.php?p=threads&f=61&t=16301904&b=0&a=0)

### Inferences
- Recommended order implied by the guide titles: scary-gear perks, multipliers, then Freebie/Cashback/Dark Power only after the core chance perks.

### Gaps
- Costs for Sweet Release, Bloody Mary, Cashback, Mortal Coil: not found. Mortal Coil effect: not found at all.
- No consensus recommended order was actually read; only fragments.

## 4. Exchange values and timing

### Takeaway
Treats exchange all at once into cans, candy, or alcohol, with higher tiers unlocked by upgrades. No per-treat conversion rates or market-value rankings were found.

### Cited Findings
- Basic unlocked exchange items: Bag of Candy Kisses, Bag of Tootsie Rolls, Bottle of Beer, Bottle of Pumpkin Brew, Can of Goose Juice, Can of Damp Valley, Can of Crocozade (wiki) — [wiki](https://wiki.torn.com/wiki/Trick_or_Treat)
- Upgrades and exchanging both permanently consume treats (wiki) — [wiki](https://wiki.torn.com/wiki/Trick_or_Treat)
- Exchange all at once is the mechanic; guides say hold treats for upgrades early in the multi-year path (community) — [Halloween guide 2025](https://www.torn.com/forums.php?p=threads&f=61&t=16504610&b=0&a=0)

### Gaps
- Treat-to-item rates, current market prices, and best-value item: not found. Timing of exchange (end of event vs mid-event) beyond the "don't exchange everything early" advice: not found.

## 5. Existing userscripts and tools

### Takeaway
No Torn Halloween userscript was found. Searches for "treats_collected" on GitHub and Halloween scripts on Greasy Fork returned nothing relevant.

### Cited Findings
- Tools named in forum guides as useful for farming: Donator Advanced Search, FF Scouter (target difficulty) (community) — [forum 16505689](https://www.torn.com/forums.php?p=threads&f=61&t=16505689&b=0&a=0rh%3D10)
- A Torn Easter egg spawner userscript exists on Greasy Fork (ID 40367), showing seasonal scripts exist, but no Halloween equivalent was found — [Greasy Fork](https://greasyfork.org/ar/scripts/40367-torn-easter-egg-spawner/versions)
- Torn Script Hub (Greasy Fork 590550) is a general script dashboard, not Halloween-specific — [Greasy Fork](https://greasyfork.org/ja/scripts/590550-torn-script-hub)

### Gaps
- TornTools / Torn PDA Halloween features: nothing found. Feature gaps players mention: not found.

## 6. Faction wars and chains

### Gaps
- Nothing found on whether chain hits give treats or whether factions schedule farming around wars. The "initiate and win with the final hit" rule you already have implies chain hits count if you start the attack and land the final hit, but this is inference, not sourced.

## 7. 2026-specific announcements

### Gaps
- No 2026 announcement or change found. The searchable guides are from 2025 or earlier. Torn Index quick-start says the event runs Oct 25 to Nov 1; a separate event PDF says it ends Nov 3 (conflict, unresolved) — [Torn Index quick start](https://tornindex.com/guide/16512766/)
