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

## API, privacy and safety

Torn War Overlay communicates only with Torn's official API at `api.torn.com`.

- No analytics.
- No advertising.
- No third-party strength/scouting service.
- No automated attacks, clicks or attack initiation.
- No hidden-tab target alerts.
- Manual API keys, when used, are stored locally on the device/browser and are used by this script only for Torn API requests.

The script pauses live page processing when the Torn page is not actively viewed and revalidates live faction status when returning.

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

The preferred public installation route will be **Greasy Fork** once the initial listing is published and configured to sync from this repository.

For Torn PDA, the canonical userscript can also be imported directly from this repository.

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

Current release candidate: **v0.13.1**.

v0.13.1 is the canonical GitHub/Greasy Fork distribution build. It contains metadata and distribution cleanup over v0.13.0 without changing the tactical targeting behaviour.

The project has already been tested during real ranked-war use. The v0.13 line is the release-candidate hardening line before the first stable v1.0 release.

## Disclaimer

Torn War Overlay is an unofficial community userscript and is not affiliated with, endorsed by, or maintained by Torn or Chedburn Networks.

Use it in accordance with Torn's current rules and API policies.
