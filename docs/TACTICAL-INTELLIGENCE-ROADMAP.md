# Tactical Intelligence Roadmap

**Project:** Torn War Overlay  
**Research date:** 8 September 2026  
**Status:** Research / future development — not yet implemented  
**Current production baseline when this document was written:** v0.13.1

## Purpose

This document preserves the research and product direction developed after the first Torn War Overlay release on Greasy Fork.

The central conclusion is that the next competitive advantage should **not** come from adding more generic target visibility. The public Torn ecosystem already contains hospital trackers, Fair Fight / battle-stat scouting, war boards, dibs/calls, chain alerts, activity tracking, recommended-target lists and war analytics.

Torn War Overlay already covers much of the highest-value visibility layer itself:

- exact account age for relevant candidates;
- Online / Idle / Offline context;
- server-synchronised hospital countdowns;
- configurable green/yellow target highlighting;
- maximum-age, maximum-level and Idle rules;
- Early Discharge and revive-risk context;
- recent personal outgoing attack results;
- current-ranked-war scoping;
- adaptive API polling and caching;
- incremental attack-history updates;
- foreground-only processing;
- SPA/remount/watchdog resilience.

The proposed next step is therefore to evolve the script from a **war overlay** into a lightweight **personal war decision engine**.

The question it should increasingly answer is:

> Given my own combat history, this opponent, the current war situation and the cost of 25 energy, what is the highest-value action available to me right now?

The design principle throughout this roadmap is to obtain more intelligence from data Torn already exposes — especially data the script already fetches — rather than simply increasing API polling or depending on external battle-stat services.

---

# 1. Research conclusion: optimize the next 25 energy

Most target helpers implicitly optimize one of these variables:

- target is currently available;
- target appears weak;
- target has a favorable FF estimate;
- target has been called/dibbed;
- target has a favorable generic priority score.

Those are useful, but ranked-war efficiency is more directly related to the value produced by each attack opportunity.

A better optimization target is:

**Expected war value per 25 energy.**

At a conceptual level:

```text
Expected War Value = P(win) × Expected Ranked-War Score
```

Later versions can expand this to:

```text
Expected Obtainable War Value
    = P(win)
    × Expected Ranked-War Score
    × P(target still available when attacked)
    × Tactical Context Modifier
```

The objective is not to create a mysterious global score. The user should be able to understand why a target is recommended.

Example row explanations:

```text
BEST
6/6 wins · FF 2.71 · ~6.8 expected score · high confidence
```

```text
SAFE
5/5 wins · FF 1.22 · ~2.5 expected score
```

```text
RISK
1/3 wins · old evidence unstable
```

The script should continue to let Torn's native faction list remain the primary UI. Tactical intelligence should appear as compact annotations rather than a separate dashboard wherever possible.

---

# 2. Opportunity map

| Idea | Expected war leverage | Public novelty observed in research | Additional API cost | Recommended priority |
|---|---:|---:|---:|---|
| Expected Score / 25E | Very high | Very high | Very low if derived from existing attack history | P0 |
| Personal Fair-Fight Memory | Very high | High | Very low / existing data | P0 |
| Personal Win Confidence | Very high | High | Existing data | P0 |
| BEST target recommendation | Very high | High if transparent/personalized | Existing + derived data | P0 |
| Enemy Release Fingerprint | Very high | Very high | Low | P1 |
| Target Contention / Availability Half-Life | High | Very high | Low-medium | P1 |
| Target Regime-Change Detector | Medium-high | Very high | Existing data | P1 |
| Safe Chain-Bonus Target | High | High | Low | P2 |
| War Momentum / Score Velocity | High | High | Low | P2 |
| Target-Decay Engine | Medium-high | Medium-high | Low | P2 |
| Dynamic LEAVE vs HOSP recommendation | Very high | High when context-aware | Depends on preceding features | P2/P3 |
| Enemy Suppression Value | Very high | Very high as row-level guidance | Requires suitable faction attack access | P3 optional |
| Adaptive Personal Target Frontier | High | Very high | Mostly derived from existing data | P3 |

The novelty assessment is specifically about **publicly visible tools found during the September 2026 research**. It is not a claim that private faction tooling does not implement similar ideas.

---

# 3. Feature concept: Expected Score / 25E

## Problem

A weak opponent is not always the best opponent.

If two available targets are both beatable but one historically produces much more ranked-war respect, spending the same 25 energy on the higher-value target may be materially better.

The current overlay can identify candidates but does not yet distinguish between:

- a very safe low-value target;
- a moderately stronger but repeatedly beatable high-value target.

## Key observation

Detailed personal attack history contains much richer data than the current five result dots use. Relevant fields can include values such as:

- attack result;
- respect gained;
- Fair Fight multiplier;
- ranked-war status;
- retaliation modifier/context;
- group attack context;
- chain context;
- war-related multipliers;
- attack timestamps.

Before implementation, verify the exact current v2 API schema in Torn Swagger. The API is actively evolving and future code must not assume historical field nullability forever.

## Proposed derived metrics

For each opponent with personal observations:

```text
wins
losses
non_decisive
sample_count
observed_average_respect
observed_median_respect
observed_FF
recent_FF
win_rate
confidence
expected_score
expected_score_per_25E
```

Possible first implementation:

```text
P(win) = smoothed personal win rate
Expected Score = robust mean/median of comparable recent ranked-war wins
EV25 = P(win) × Expected Score
```

Do not use a raw 100% win rate from a single observation as high confidence. Apply Bayesian/Laplace smoothing or a confidence penalty for small samples.

Example:

```text
0 samples -> UNKNOWN
1/1       -> promising but LOW CONF
3/3       -> medium confidence
6/6       -> high confidence
```

The exact thresholds should be calibrated from real war use rather than chosen permanently up front.

## UI

Keep the main green/yellow logic intact initially.

Within currently green targets, optionally display:

```text
EV 6.4
```

or for the best candidate:

```text
★ BEST
```

Tap/hover explanation:

```text
6/6 wins
FF 2.71 observed
Expected score ~6.8
High confidence
```

## Why this should be first

This feature offers one of the best leverage-to-complexity ratios because Torn War Overlay already retrieves attack history for the result dots. Much of the required intelligence can therefore be produced by **retaining and interpreting more of data already downloaded**, with little incremental API pressure.

---

# 4. Feature concept: Personal Fair-Fight Memory

## Problem

The current age-based heuristic is intentionally simple and robust, but account age is only a proxy for actual combat difficulty.

External battle-stat/scouting integrations were intentionally deferred. A different approach is available: learn from the user's real attacks.

## Concept

After a player fights an opponent, save the exact/observed Fair Fight information returned in the personal attack record when available.

Possible row states:

```text
FF 2.83 · 5-0
FF 1.34 · 3-0
FF 2.12 · 1-2 RISK
```

The value is **personal**. It does not answer whether the target is globally weak. It answers whether that target has historically been favorable for the current user.

## Benefits

- no third-party scouting provider;
- no hidden battle stats;
- uses first-party Torn data;
- becomes more valuable with every war;
- naturally adapts to the player's own growth;
- can expose targets that simple account-age filtering would miss;
- can reduce wasted energy against deceptively strong young accounts.

## Persistence

Unlike the current attack dots, which are scoped to the current war for presentation, personal matchup intelligence may be useful across wars.

Suggested architecture:

```text
two.opponentIntel.v1
  opponentId
    lastSeen
    totalObservations
    rankedWarObservations
    wins
    losses
    ffSamples[] / robust aggregate
    respectSamples[] / robust aggregate
    lastResult
    lastFF
```

Storage needs strict pruning to avoid unbounded localStorage growth.

Potential policies:

- retain only N most recent observations per opponent;
- retain aggregate values plus a small recent window;
- expire inactive opponent records after a configurable number of months;
- keep current-war detail separately from long-term aggregate intelligence.

---

# 5. Feature concept: Personal Win Confidence

## Goal

Move from binary previous-result dots toward a probability-like assessment of whether **this user** can safely beat **this opponent**.

## Inputs

Start conservatively:

- recent personal wins/losses;
- number of observations;
- recency of observations;
- observed FF when available;
- account age;
- level;
- whether recent outcomes have changed materially.

Do not over-engineer a machine-learning model initially.

A transparent heuristic is preferable:

```text
PROVEN
LIKELY
UNKNOWN
RISK
CHANGED
```

These labels are easier to trust in real-time war use than an unexplained `83/100` score.

---

# 6. Feature concept: Enemy Release Fingerprint

## Core idea

The API exposes a hospital-until timestamp, but an opponent does not necessarily remain hospitalized until that timestamp. They may re-enter through medical items, Opium, a revive, Early Discharge or another permitted mechanism.

We do not need to infer which mechanism was used.

We can instead measure the behavior that matters tactically:

> Does this opponent normally stay down, or do they repeatedly come back early?

## Observation model

For each hospital cycle observed while the faction page is actively loaded:

```text
hospital_entered_at
nominal_release_at
actual_first_observed_available_at
early_return_seconds
```

Possible derived classifications:

```text
FULL
Usually remains hospitalized close to nominal release.

EARLY
Frequently returns materially before nominal release.

FAST RETURN
Returns early and repeatedly.

UNSTABLE
Behavior has insufficient or inconsistent evidence.
```

Possible row annotations:

```text
EARLY 5/6
FULL 4/4
FAST RETURN
```

or contextual hospital prediction:

```text
2:43:18 · likely early exit
```

## Tactical value

This helps answer whether hospitalizing a particular enemy creates durable suppression or merely consumes a short interruption before they re-enter the war.

It may also expose opponents who are repeatedly consuming medical resources/revives, which can itself be strategically relevant over a long war.

## Important limitation

Never label this as the enemy's medical cooldown. Torn does not provide that information directly. This is an empirical **release-behavior fingerprint**, not hidden cooldown intelligence.

---

# 7. Feature concept: Target Contention / Availability Half-Life

## Problem

An apparently perfect farm target can still be a poor practical target if every faction member is waiting for the same player.

Existing public solutions often address this with shared calls/dibs. Torn War Overlay can attack a different part of the problem without requiring a central coordination backend:

> Learn how quickly each enemy disappears after becoming available.

## Observation model

Observe transitions such as:

```text
Hospital -> Okay -> Hospital
```

and record the duration of the available window where evidence is sufficiently reliable.

Derived metrics could include:

```text
median_available_duration
recent_available_duration
number_of_observed_cycles
availability_half_life
contention_class
```

Possible UI:

```text
COLD
Usually remains available long enough.

WARM
Moderately contested.

HOT
Typically disappears quickly.
```

## Integration into Expected Value

Eventually:

```text
Expected Obtainable Value
  = Expected War Value
  × P(target remains available long enough)
```

This distinguishes a nominally excellent target from an attack opportunity the player is unlikely to actually capture.

## Technical caveat

Torn may cache identical API responses for a period of time. API polling alone therefore cannot measure second-level availability accurately in every case.

Because the userscript runs on the actively viewed faction page, it may be possible to supplement API evidence with status changes Torn itself renders in the loaded page, provided this remains within Torn's current scripting/API rules.

Do not add hidden-tab monitoring, automated refresh, automated clicks or attack initiation.

---

# 8. Feature concept: Enemy Suppression Value

## Purpose

Not every opponent should be treated as a farm target.

Some enemies are actively generating substantial score against the faction. Temporarily removing one of those players may be more important than taking the highest immediate personal-respect hit.

## Data requirement

This feature likely requires an appropriately scoped key with access to relevant faction attack data.

It should therefore be an optional enhanced capability rather than a requirement for the core overlay.

## Possible metrics

For each opponent:

```text
enemy_ranked_war_score_5m
enemy_ranked_war_score_15m
enemy_ranked_war_score_30m
enemy_attack_count_15m
enemy_score_velocity
recent_activity
```

Possible row annotation:

```text
🔥 38 pts / 15m
```

or:

```text
THREAT
```

## Suppression score concept

```text
Suppression Value
    = Recent Enemy Score Velocity
    × Probability They Continue Attacking
    × Expected Downtime if Hospitalized
```

The final term can eventually benefit from the Enemy Release Fingerprint.

This links multiple independently useful features into a more sophisticated tactical model.

## Novelty boundary

Public tools already provide war analytics and faction attack-log analysis. The differentiated product concept is not simply displaying those logs. It is translating **enemy offensive throughput into row-level attack/suppression guidance at the moment a player chooses a target**.

---

# 9. Feature concept: Dynamic LEAVE vs HOSP recommendation

## Background

A simple rule like "hospitalize online players and leave offline weak players" is already known and has public implementations.

The opportunity is therefore not to add a basic activity-based action hint.

The opportunity is to make the recommendation contextual.

## Possible rules

### Recommend LEAVE when

- target is a proven personal farm;
- target has low current enemy offensive output;
- opponent tends to return naturally/reliably;
- our faction currently has few available targets;
- the faction is in an offensive farming/push posture;
- preserving repeatable farm opportunities is more valuable than suppression.

### Recommend HOSP when

- target is currently a major enemy scorer;
- target is actively online;
- opponent is contributing to an enemy push;
- target repeatedly re-enters battle and is worth forcing back into hospital;
- faction is in a defensive/suppression posture;
- target represents a retaliation or other special opportunity where applicable.

Potential UI after/around a selected target:

```text
LEAVE · FARM
HOSP · THREAT
HOSP · RETAL
```

## Safety/product constraint

The script must only recommend. It must not automatically choose the attack outcome, click buttons or initiate attacks.

---

# 10. Feature concept: Safe Chain-Bonus Target

## Problem

Chain bonus warnings already exist publicly. Merely reproducing a warning has low differentiation.

The higher-value question is:

> When a valuable bonus hit is imminent, which available enemy gives this player the highest probability of securing it?

## Decision logic

During a bonus-hit window, temporarily change the optimization target from normal score EV toward **probability of successful completion**.

Candidate rank could prioritize:

1. proven personal win record;
2. low observed FF / known safe matchup;
3. currently Okay / reliably attackable;
4. recent evidence rather than stale evidence;
5. enough margin to avoid sacrificing a major chain bonus on an uncertain target.

Example:

```text
★ BONUS SAFE
6/6 · FF 1.42
```

This should be temporary and context-sensitive rather than permanently changing the normal target ranking.

---

# 11. Feature concept: War Momentum / Score Velocity

## Goal

Raw war score does not fully describe tactical state. The rate at which each side is currently scoring can identify an emerging push before the headline score makes it obvious.

## Sampling

At a conservative interval, save war score snapshots:

```text
timestamp
our_score
enemy_score
our_chain
enemy_chain / available relevant state
```

Derived metrics:

```text
our_pts_per_5m
enemy_pts_per_5m
our_pts_per_15m
enemy_pts_per_15m
net_velocity
velocity_acceleration
```

Possible states:

```text
CONTROL
PUSHING
UNDER PUSH
STABLE
LOW ACTIVITY
```

Example compact header:

```text
UNDER PUSH · enemy +96 / 5m
```

## Later integration

War momentum can alter tactical recommendations.

For example:

- offensive control -> favor score-efficient repeatable farming;
- enemy push -> increase suppression weight;
- quiet period -> prioritize high-EV attacks rather than urgent suppression.

This should be implemented only after the underlying measurements prove stable.

---

# 12. Feature concept: Ranked-War Target Decay Engine

Ranked-war score targets decay over time according to Torn's war mechanics. Instead of providing only the current target, the overlay can make the next decay event visible.

Possible UI:

```text
DECAY IN 18m
```

or:

```text
Next target reduction: 12m
```

Potential tactical benefit:

- helps decide whether an all-out push is necessary immediately;
- prevents spending resources to chase a target that is about to decrease naturally;
- can contextualize momentum/ETA calculations.

This should remain informational rather than prescriptive until validated during real wars.

---

# 13. Feature concept: Adaptive Personal Target Frontier

## Problem

The current maximum-age rule is intentionally simple. A fixed threshold such as 1.5 years will inevitably exclude some personally beatable targets and include some dangerous ones.

## Concept

Keep the configured hard rule as the default and create an optional learned layer that identifies candidates outside the normal frontier.

Examples:

```text
2.1y · Lv32 · PROVEN
```

because the user has repeatedly beaten them.

```text
1.0y · Lv61 · RISK
```

because the user's actual history contradicts the young-account heuristic.

## Important UX principle

Do not silently expand the user's green-target definition.

Use separate labels such as:

```text
PROVEN
LIKELY
UNKNOWN
RISK
```

The player remains in control of whether learned targets participate in filtering/highlighting.

## Possible future ranking

A transparent personal frontier can combine:

- account age;
- level;
- personal win rate;
- observed FF;
- recency;
- sample confidence;
- regime-change state.

Avoid a black-box model unless substantial real-world evidence later shows it materially outperforms a transparent heuristic.

---

# 14. Feature concept: Target Regime-Change Detector

## Problem

Historical success can become stale.

Example:

```text
✓ ✓ ✓ ✓ ✓ ✕ ✕
```

The meaningful signal is not simply "two losses". It is that recent outcomes are inconsistent with the older history.

Possible causes include equipment/loadout changes, temporary effects, player growth or other factors. The overlay does not need to infer the cause.

It only needs to communicate:

> Historical evidence may no longer be reliable.

## UI

```text
⚠ CHANGED
```

or temporarily:

```text
RISK · recent change
```

## Algorithm ideas

Start simple:

- compare recent-window win rate with historical win rate;
- compare recent FF with longer-run FF;
- detect consecutive unexpected losses;
- require enough historical evidence before declaring a change.

A formal change-point detector can be evaluated later if the simple heuristic generates too many false positives.

---

# 15. Product concept: Next 25E

The long-term product should not become a wall of badges.

A stronger UX is to let all the intelligence feed one concise recommendation layer.

Among currently viable targets, one opponent can be identified as:

```text
★ BEST
```

The explanation remains available on tap/hover:

```text
6/6 wins
FF 2.71 observed
~6.8 expected score
Usually available long enough
Low current threat
High confidence
```

Other rows can retain only minimal contextual labels where useful:

```text
SAFE
HOT
THREAT
CHANGED
BONUS SAFE
```

## Proposed ranking stack

Do not use a single unexplained 0-99 score.

Instead calculate a ranking from understandable layers:

1. **Eligibility** — current green/yellow/status/settings logic.
2. **Win confidence** — can this user reliably beat the opponent?
3. **Expected score** — what is the likely ranked-war return for 25E?
4. **Obtainability** — how contested / short-lived is the opportunity?
5. **War context** — offensive farming vs suppression need.
6. **Special context** — bonus, retaliation or similar tactical opportunity.

The UI should be able to explain the dominant reasons for a recommendation.

---

# 16. Capability tiers

To preserve the simplicity and privacy model of Torn War Overlay, future intelligence should be separated by permission requirements.

## Tier A — Public / Core Overlay

Keep the current low-permission experience fully functional.

Potential capabilities:

- current target rules;
- status and hospital timing;
- release fingerprints where observable;
- contention observations where reliable;
- war state / decay context available from permitted endpoints;
- existing UI/performance behavior.

## Tier B — Personal Intelligence

Uses the Limited or appropriately scoped Custom key already needed for personal attack history.

Potential capabilities:

- exact observed Fair Fight memory;
- personal win confidence;
- expected score / 25E;
- BEST target;
- regime-change detection;
- safe bonus target;
- long-term personal matchup memory.

This is the recommended next development area because it creates substantial value with data the script already largely consumes.

## Tier C — Faction Intelligence

Optional. Requires a suitable key/permission set for faction attack-level intelligence.

Potential capabilities:

- enemy score velocity by member;
- offensive threat identification;
- suppression value;
- contextual LEAVE/HOSP recommendation;
- retaliation/context signals where supported.

The core script must never require Tier C merely to preserve ordinary target highlighting.

---

# 17. Recommended release sequence

## v0.14 — Personal Tactical Intelligence

**Objective:** turn existing personal attack-history data into immediate target-decision leverage without materially increasing API load.

Recommended scope:

1. retain additional ranked-war attack fields already returned by the API;
2. Personal Fair-Fight Memory;
3. personal win/loss aggregates;
4. confidence classification;
5. observed/expected ranked-war score calculation;
6. Expected Score / 25E (`EV`);
7. `★ BEST` selection among currently green candidates;
8. tap/hover explanation for the recommendation;
9. local persistence and pruning;
10. diagnostics/self-tests for malformed/missing future API fields.

### v0.14 success criteria

- no regression to current green/yellow targeting;
- no meaningful increase in foreground API request rate;
- BEST recommendation is explainable;
- one-sample targets are never shown as high confidence;
- stale historical observations are discounted;
- current-war and long-term samples do not contaminate each other accidentally;
- UI remains compact on Torn PDA;
- feature degrades cleanly when attack-history permission is unavailable.

## v0.15 — Behavioral Opportunity Intelligence

**Objective:** learn which targets actually stay down and which attack opportunities are realistically obtainable.

Recommended scope:

1. Enemy Release Fingerprint;
2. availability-window observations;
3. Target Contention classification;
4. availability half-life / robust duration metric;
5. Regime-Change Detector;
6. integrate contention into BEST ranking only after enough observations exist;
7. ensure API-cache limitations are explicitly handled.

### v0.15 success criteria

- no false claim of knowing enemy medical cooldown;
- insufficient evidence remains `UNKNOWN` rather than forced into a category;
- DOM-derived evidence is used only from actively loaded Torn pages and in compliance with current rules;
- no hidden-tab monitoring or automated refresh.

## v0.16 — War Context Intelligence

**Objective:** make recommendations sensitive to the state of the war, not just the opponent.

Recommended scope:

1. war score snapshot history;
2. score velocity / momentum states;
3. target-decay countdown/context;
4. Safe Chain-Bonus Target;
5. early context-aware ranking adjustments;
6. extensive real-war validation before making stronger action recommendations.

## Later / optional — Faction Intelligence

Only after v0.14-v0.16 have proved useful:

1. enemy offensive throughput;
2. threat classification;
3. suppression value;
4. dynamic LEAVE vs HOSP guidance;
5. retaliation prioritization where supported;
6. optional Adaptive Personal Target Frontier.

---

# 18. Implementation principles

## 18.1 Prefer derived intelligence over extra polling

Torn documents API rate limits and may cache identical requests. More polling is therefore not automatically more information.

Prefer:

```text
existing payload -> richer local model -> better decision
```

over:

```text
more requests -> more UI noise
```

## 18.2 Preserve current fast path

v0.13.1's current status/highlighting path has already been tested in real ranked-war use.

New intelligence must not block or delay:

- row discovery;
- green/yellow rendering;
- hospital countdown updates;
- status refresh;
- UI mounting/remounting.

Derived intelligence should load progressively after the basic overlay is usable.

## 18.3 Local-first intelligence

No backend is required for the proposed personal-intelligence roadmap.

Prefer local storage for:

- personal matchup aggregates;
- release observations;
- contention observations;
- war score time series with aggressive pruning.

Do not collect analytics or transmit player histories to third parties.

## 18.4 Confidence must be explicit

Never turn weak evidence into authoritative recommendations.

Every learned signal should have:

- sample count;
- recency;
- confidence;
- sensible `UNKNOWN` behavior.

## 18.5 Robust statistics over naive averages

Use medians, trimmed means, recency weighting or other robust aggregation when outliers can distort expected respect/FF/availability duration.

## 18.6 Explainable recommendations

`BEST` must be explainable from observable factors.

Do not create a generic 0-99 priority number unless the underlying components remain inspectable.

## 18.7 No attack automation

Maintain current product boundary:

- no automated attacks;
- no automated clicks;
- no automatic choice of Leave/Mug/Hospitalize;
- no hidden-tab target alerting;
- no automation designed to play the war for the user.

Recommendations and visual prioritization are acceptable only insofar as they remain compliant with Torn's current rules. Re-check the rules before implementing material new automation-adjacent behavior.

---

# 19. Data-model sketch

This is intentionally conceptual, not a frozen schema.

```js
opponentIntel = {
  [opponentId]: {
    updatedAt,
    personalCombat: {
      wins,
      losses,
      nonDecisive,
      totalSamples,
      rankedWarSamples,
      recentResults: [],
      ff: {
        recentSamples: [],
        robustEstimate,
        lastObserved,
        lastObservedAt
      },
      respect: {
        recentSamples: [],
        robustEstimate
      },
      confidence,
      regimeState
    },
    releaseBehavior: {
      cyclesObserved,
      earlyReturns,
      recentCycles: [],
      classification,
      confidence
    },
    availability: {
      cyclesObserved,
      recentDurations: [],
      medianDuration,
      classification,
      confidence
    }
  }
};
```

War-scoped state:

```js
warIntelligence = {
  warId,
  startedAt,
  scoreSamples: [],
  momentum: {
    ours5m,
    enemy5m,
    ours15m,
    enemy15m,
    netVelocity,
    state
  },
  nextDecayAt,
  currentTarget
};
```

The final implementation should minimize storage, normalize numeric fields, tolerate `null`/missing API values and prune aggressively.

---

# 20. Ranking sketch

Do not treat this as a fixed formula. It is a framework for experimentation.

## Stage 1 — eligibility

Use existing target rules:

```text
age / learned override
activity
level
hospital status
configured thresholds
live-data trust state
```

If the current live snapshot is not trusted, never let learned intelligence turn a stale row into a green target.

## Stage 2 — personal combat value

```text
winProbability = confidence-adjusted personal win estimate
scoreEstimate = robust expected ranked-war score
personalEV = winProbability × scoreEstimate
```

## Stage 3 — obtainability

Once contention evidence exists:

```text
obtainableEV = personalEV × availabilityProbability
```

## Stage 4 — tactical context

Later:

```text
finalUtility = obtainableEV
             + retaliationValue
             + suppressionValue
             + bonusContextValue
             + warMomentumAdjustment
```

The UI does not need to expose the raw formula. It should expose the important reasons:

```text
BEST because:
- proven win
- high expected score
- normally obtainable
```

---

# 21. Experimentation and validation plan

Do not immediately trust theoretical ranking weights.

For each release, collect only **local diagnostics**, visible/exportable to the user if needed, not remote analytics.

Possible validation counters:

```text
BEST recommendations shown
BEST targets attacked
BEST target wins/losses
recommended EV vs realized score
non-BEST target realized score
contention prediction accuracy
release classification accuracy
regime warnings followed by loss/win
```

The user can manually export or inspect diagnostics after a war during development.

Questions to answer empirically:

1. Does EV25 identify materially better targets than simple age sorting?
2. How many personal samples are needed before FF/win confidence becomes useful?
3. Does old personal history remain predictive after several weeks/months?
4. Can release behavior be measured reliably given API caching?
5. Can DOM-observed status transitions improve contention timing enough to matter?
6. Does a BEST marker reduce decision time in actual wars?
7. Does adding tactical labels increase visual clutter or cognitive load?

---

# 22. API and compatibility watch items

The API must be re-validated against current Torn Swagger immediately before each implementation step.

Research performed in September 2026 identified several reasons for defensive coding:

- Torn API v2 continues to evolve;
- fields may become nullable or change semantics;
- attack `chain` behavior has a documented future nullability change around 1 January 2027;
- generic faction warfare selections/endpoints are being superseded by more specific API v2 endpoints;
- identical API calls may be service-side cached;
- API request limits apply across the user's keys.

Implementation requirements:

```text
never assume optional numeric fields are non-null
feature-detect required data
separate permission failure from API/network failure
gracefully disable enhanced intelligence when fields are unavailable
keep primary target highlighting functional
avoid duplicate API calls across features
reuse in-flight request de-duplication
```

---

# 23. Public ecosystem / differentiation notes

Public tooling observed during the research includes categories such as:

- Fair Fight / battle-stat scouting;
- hospital timers;
- war boards;
- target recommendations / generic priority scores;
- calls/dibs/rallies;
- chain warnings / bonus protection;
- activity tracking;
- faction attack-log analytics;
- respect-conceded / war-bleed analysis.

Representative tools/topics encountered included FF Scouter, War Stuff Enhanced, CAT, Warboard, Torn Dibs, Torn Intel, War Bleed and chain bonus guards.

This means Torn War Overlay should avoid competing primarily by copying those surfaces.

The most differentiated concepts identified were:

1. **personal Expected Score / 25E integrated directly into enemy rows;**
2. **personal observed FF and matchup confidence learned from real attacks;**
3. **empirical enemy release fingerprints;**
4. **target contention / availability half-life learned without a shared backend;**
5. **enemy offensive throughput translated into row-level suppression priority;**
6. **a transparent BEST target recommendation combining the above.**

Private faction tools may already implement some or all of these ideas. Novelty here means they were not found as common public Greasy Fork/forum implementations during the research pass.

---

# 24. Research references

These are starting points preserved for future implementation research. Re-check current content and Torn rules before relying on any specific behavior.

## Torn official / first-party

- Torn API / Swagger: https://www.torn.com/swagger.php
- Torn API information: https://www.torn.com/api.html
- Ranked War wiki: https://wiki.torn.com/wiki/Ranked_War
- Chain wiki: https://wiki.torn.com/wiki/Chain
- Hospital wiki: https://wiki.torn.com/wiki/Hospital
- Torn Scripts & UserScripts forum: https://www.torn.com/forums.php#/p=forums&f=67

## Public userscript ecosystem

- Greasy Fork Torn scripts: https://greasyfork.org/en/scripts/by-site/torn.com

When continuing research, explicitly compare against current versions/search results for:

- FF Scouter;
- War Stuff Enhanced;
- CAT;
- Warboard;
- Torn Dibs;
- Torn Intel;
- Torn War Bleed;
- chain/bonus guard scripts;
- actionable/recommended-target trackers.

## API schema/reference helpers

Third-party generated client/type documentation can be useful for quickly identifying fields, but the Torn Swagger definition must remain authoritative before implementation:

- https://neon0404.github.io/torn-client/

---

# 25. Immediate next implementation decision

When development resumes, start with **v0.14 — Personal Tactical Intelligence** unless a new API/rule change invalidates the plan.

The first engineering task should be:

> Inspect the exact current attack-history payload already consumed by v0.13.1, identify which ranked-war respect and Fair Fight fields are available without additional requests, and design a backward-compatible local opponent-intelligence cache.

Then implement in this order:

```text
1. richer attack-history normalization
2. persistent opponent matchup aggregates
3. observed FF memory
4. confidence model
5. expected ranked-war score
6. EV per 25E
7. BEST candidate ranking
8. compact explanation UI
9. diagnostics
10. real-war validation
```

Do **not** begin with faction-wide intelligence, an external strength provider, a new dashboard or more aggressive polling. The strongest next leverage is available from data already flowing through the script.

---

# 26. Definition of success for the broader roadmap

The future Torn War Overlay should make a user measurably better at allocating limited war energy while remaining fast, understandable and compliant.

A successful mature version should answer four questions almost instantly:

1. **Who can I attack right now?** — current overlay strength.
2. **Who am I most likely to beat?** — personal combat memory.
3. **Which beatable target gives the best return for my 25E?** — Expected War Value.
4. **Does the current war situation make another action strategically more valuable?** — contention, bonus, momentum and suppression context.

That progression is the core product direction documented here.
