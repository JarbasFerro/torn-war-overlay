# Changelog

All notable Torn War Overlay changes are documented here.

The project is currently in release-candidate status. Version numbering before v1.0 reflects rapid iterative development and real-war validation.

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
