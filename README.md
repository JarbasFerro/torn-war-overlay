# Torn War Overlay

Torn War Overlay is a lightweight userscript for Torn ranked wars. It adds tactical information directly to the enemy faction member list so targets can be assessed quickly without automating attacks.

The script is designed primarily for **Torn PDA** and also supports standard userscript managers such as Tampermonkey where the required APIs are available.

## What it adds

- Exact account age for relevant target candidates, with low-API prefiltering for older accounts.
- Activity context such as Online, Idle and Offline with recency.
- Server-synchronised hospital countdowns.
- Configurable green/yellow target highlighting.
- `ALL | TARGETS | SET` controls directly above the faction member list.
- Optional maximum level and Idle-target rules.
- Early Discharge and revive-risk context.
- Up to five recent outgoing attack-result dots per opponent, scoped to the current ranked war.
- Personal intel per opponent: observed Fair Fight, expected score per hit, expected value per 25 energy (`EV`) and a `PROVEN | LIKELY | UNKNOWN | RISK | CHANGED` confidence label.
- A single `★ BEST` recommendation among current green targets, with a tap/hover explanation.
- `WAR +lead / target` and `CHAIN n m:ss` context chips, including next target-decay time and a `BONUS #n` warning when your next chain hit is a bonus hit.
- Adaptive API polling, caching, incremental attack-history updates and foreground-only live processing.

## Default target rules

A **green** target must satisfy the configured age/activity/level rules and be:

- Okay/ready,
- mathematically due to leave hospital, or
- leaving hospital within the green threshold.

A **yellow** target satisfies the same age/activity/level rules but is still in hospital inside the wider watch threshold.

Default configuration:

- Maximum account age: **1.5 years**
- Green hospital threshold: **30 seconds**
- Yellow hospital threshold: **300 seconds**
- Idle targets: **enabled**
- Maximum level: **disabled**

All settings persist locally.

## Attack history

The five small result dots show your latest outgoing attacks against that opponent during the current ranked war:

- Green: win
- Red: loss
- Grey: stalemate or another non-decisive result

The main overlay works with a Public-capability Torn API key. Attack-history data requires a Limited key or an appropriately scoped Custom key that can access the user attack-history endpoint.

## Personal intel

Personal intel is learned only from your own outgoing attack records. Nothing is fetched from third-party scouting services and nothing leaves your device except requests to Torn's API.

- **Fair Fight memory.** Every outgoing attack record includes the Fair Fight multiplier Torn applied. Fair Fight is a pure function of both players' battle-stat scores (`1 + 8/3 × their score / your score`, capped at 3), so one fight against an opponent yields their score, and the script re-projects the expected Fair Fight as your own stats grow. A capped `FF3.0+` value only proves the opponent is at least 75% of your score and is shown as risk until you have wins against them.
- **Expected score.** For a Leave or Hospitalize hit in a ranked war the expected score is `base(level) × 2 × Fair Fight × chain scale`, using Torn's post-April-2024 base respect (`1 + level/200`) and the chain scale for your next hit. If Fair Fight is unknown the median of your ranked-war wins against that player is used instead.
- **Win confidence.** A smoothed win probability from your decisive results in the last 180 days, with a prior informed by Fair Fight. Labels are transparent: `PROVEN` (3+ wins, no losses), `LIKELY`, `UNKNOWN`, `RISK` (recent loss or capped Fair Fight) and `CHANGED` (two latest fights lost after a reliably won history).
- **EV and BEST.** `EV` is win probability times expected score. `★ BEST` marks the green target with the highest EV among `PROVEN` and `LIKELY` opponents. When your next chain hit is a bonus hit the ranking switches to the safest proven target so the bonus lands.
- **Storage.** Opponent memory lives in local storage, capped at 600 opponents and 240 days, and can be cleared from the userscript menu. The `SET` dialog can hide intel entirely.

Personal intel requires a Limited key, or a Custom key granting `user -> attacks` and `user -> battlestats`. War and chain chips work with a Public key.

## API, privacy and safety

Torn War Overlay communicates only with Torn's official API at `api.torn.com`.

- No analytics.
- No advertising.
- No third-party strength/scouting service.
- No automated attacks, clicks or attack initiation.
- No hidden-tab target alerts.
- Manual API keys, when used, are stored locally on the device/browser and are used by this script only for Torn API requests.

The script pauses live page processing when the Torn page is not actively viewed and revalidates live faction status when returning. It never generates alerts or draws attention from an unfocused page.

Torn API ToS disclosure:

| Item | Statement |
|---|---|
| Data storage | Faction statuses, account ages, your own attack results and derived opponent intel are stored locally on the device/browser only. |
| Data sharing | None. No backend, no analytics, no third-party service. |
| Purpose of use | Ranked-war target overlay on the faction page. |
| Key storage and sharing | Manual keys are stored in local browser storage and sent only to `api.torn.com`. Torn PDA supplies its own key. Keys are never shared. |
| Key access level | Public for the core overlay. Limited (or Custom with `user -> attacks` and `user -> battlestats`) for personal intel. |

## Performance design

The overlay is intentionally conservative with both API usage and DOM work:

- Candidate prefiltering avoids unnecessary exact-age profile calls.
- Faction status polling adapts to how urgent the current target situation is.
- Hospital countdowns run locally against a Torn-server time anchor between API refreshes.
- Attack history is war-scoped and updated incrementally rather than repeatedly downloading the full history.
- Unchanged rows are not unnecessarily re-rendered.
- Watchdog and SPA/remount recovery protect against Torn page lifecycle edge cases.

## Installation

The canonical production source is [`torn-war-overlay.user.js`](./torn-war-overlay.user.js) in the repository root.

The preferred public installation route is **Greasy Fork**, with this repository retained as the canonical source and development record.

For Torn PDA, the canonical userscript can also be imported directly from this repository.

## Future development research

The post-release research into higher-leverage war features is documented in [`docs/TACTICAL-INTELLIGENCE-ROADMAP.md`](./docs/TACTICAL-INTELLIGENCE-ROADMAP.md).

v0.14 implements the first stage of that roadmap: observed Fair Fight memory, personal win confidence, expected ranked-war score per 25 energy, a transparent `BEST` target recommendation, and war/chain context. Later research covers enemy release behavior, target contention, war momentum and optional faction-level suppression intelligence.

## Development

There is no build step. `tools/smoke-test.mjs` boots the userscript in Node with a minimal browser stub and fails if the script's built-in self-tests report a fault:

```
node --check torn-war-overlay.user.js && node tools/smoke-test.mjs
```

## Support

Bug reports, compatibility problems and feature requests should be opened in the repository Issues section:

https://github.com/JarbasFerro/torn-war-overlay/issues

When reporting a bug, include:

- Torn PDA / browser + userscript manager
- script version
- whether it happens after navigation/resume or immediately on page load
- screenshot if the issue is visual
- the visible `LIVE`, `SYNC`, `STALE`, `KEY`, `API ERR`, or other overlay status if relevant

Do **not** post API keys in an issue.

## Development status

Current release candidate: **v0.14.0**.

v0.14.0 adds personal tactical intelligence on top of the v0.13.1 distribution build. The green/yellow targeting path is unchanged apart from the null-timer fix and API-sourced levels.

The v0.13 line was validated in real ranked-war use. v0.14 needs the same real-war validation before it is promoted; the roadmap lists the questions to answer.

## Disclaimer

Torn War Overlay is an unofficial community userscript and is not affiliated with, endorsed by, or maintained by Torn or Chedburn Networks.

Use it in accordance with Torn's current rules and API policies.
