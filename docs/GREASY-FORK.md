# Greasy Fork publication guide

This file contains the copy, metadata recommendations and publication settings for the Torn War Overlay Greasy Fork listing.

## Listing name

**Torn War Overlay**

## Short description

Use this as the userscript `@description` and Greasy Fork summary:

> Ranked-war target overlay for Torn with server-synced hospital countdowns, configurable green/yellow highlighting, activity/age context, current-war attack history, and adaptive API polling.

## Recommended metadata block

Keep the existing namespace stable so userscript managers recognise updates correctly.

```javascript
// ==UserScript==
// @name         Torn War Overlay
// @namespace    jarbas.torn.waroverlay
// @version      0.13.0
// @description  Ranked-war target overlay for Torn with server-synced hospital countdowns, configurable green/yellow highlighting, activity/age context, current-war attack history, and adaptive API polling.
// @author       Jarbas Ferro
// @license      Copyright Jarbas Ferro
// @supportURL   https://github.com/JarbasFerro/torn-war-overlay/issues
// @match        https://www.torn.com/factions.php*
// @connect      api.torn.com
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==
```

Notes:

- Do **not** change `@namespace` after publication unless there is a compelling migration reason.
- Increment `@version` for every code change published to Greasy Fork.
- Greasy Fork manages its own update/download URLs for scripts installed there, so no custom `@updateURL`, `@downloadURL` or `@installURL` is required.
- `@license Copyright Jarbas Ferro` is deliberately conservative. It allows Greasy Fork users to install/use the script without granting broader modification/distribution rights. It can be replaced later with an SPDX open-source licence if desired.
- No `@antifeature` entry is needed while the script contains no advertising, tracking, mining, referral monetisation or similar author-benefit feature.

## Full Greasy Fork description

The following is ready to paste into the Greasy Fork description field.

```html
<h2>Torn War Overlay</h2>

<p><strong>Torn War Overlay</strong> adds tactical ranked-war information directly to Torn's enemy faction member list. It is designed to help you identify useful targets quickly while keeping every attack decision and click manual.</p>

<p>The script is designed primarily for <strong>Torn PDA</strong> and also supports normal userscript managers such as Tampermonkey where the required APIs are available.</p>

<h3>Main features</h3>

<ul>
  <li>Account age for relevant target candidates.</li>
  <li>Online / Idle / Offline activity context with recency.</li>
  <li>Server-synchronised hospital countdowns.</li>
  <li>Configurable green and yellow target highlighting.</li>
  <li><code>ALL | TARGETS | SET</code> controls directly above the faction member list.</li>
  <li>Optional maximum level.</li>
  <li>Option to include or exclude Idle players from target selection.</li>
  <li>Early Discharge and revive-risk context.</li>
  <li>Up to five recent outgoing attack-result dots per opponent, scoped to the current ranked war.</li>
  <li>Adaptive API polling, caching and incremental attack-history updates to reduce unnecessary API usage.</li>
</ul>

<h3>Target colours</h3>

<p>A <strong>green</strong> target satisfies the configured age, activity and optional level rules and is either ready now, mathematically due to leave hospital, or inside the configured green hospital-release threshold.</p>

<p>A <strong>yellow</strong> target satisfies the same rules but is still in hospital inside the wider watch threshold.</p>

<p>Default settings:</p>

<ul>
  <li>Maximum account age: <strong>1.5 years</strong></li>
  <li>Green hospital threshold: <strong>30 seconds</strong></li>
  <li>Yellow hospital threshold: <strong>300 seconds</strong></li>
  <li>Idle targets: <strong>enabled</strong></li>
  <li>Maximum level: <strong>disabled</strong></li>
</ul>

<p>Settings are saved locally.</p>

<h3>Recent attack dots</h3>

<p>The small dots beside a member show your latest outgoing attacks against that player during the current ranked war:</p>

<ul>
  <li><strong>Green</strong>: win</li>
  <li><strong>Red</strong>: loss</li>
  <li><strong>Grey</strong>: stalemate or another non-decisive result</li>
</ul>

<p>The main overlay works with a Public-capability Torn API key. Attack-history dots require a Limited key or an appropriately scoped Custom key with access to the user attack-history endpoint.</p>

<h3>Privacy and API usage</h3>

<ul>
  <li>Communicates only with Torn's official API at <code>api.torn.com</code>.</li>
  <li>No analytics or tracking.</li>
  <li>No advertising.</li>
  <li>No third-party scouting/strength service.</li>
  <li>No automated attacks, attack clicks or attack initiation.</li>
  <li>No hidden-tab target alerts.</li>
  <li>Manual API keys, when used, remain stored locally on the device/browser and are used by this script only for Torn API requests.</li>
</ul>

<p>The script suspends live page processing when Torn is not actively viewed and requires fresh faction status again after returning.</p>

<h3>Performance</h3>

<p>The overlay is intentionally conservative with Torn API traffic and mobile CPU use. It uses candidate prefiltering, adaptive faction polling, local server-synchronised countdowns, incremental war-scoped attack history, row-level render signatures and recovery logic for Torn's single-page navigation/remount behaviour.</p>

<h3>Support and source code</h3>

<p>Source code, release notes and bug reports:</p>

<p><a href="https://github.com/JarbasFerro/torn-war-overlay">https://github.com/JarbasFerro/torn-war-overlay</a></p>

<p>Please report bugs through GitHub Issues and never include an API key in a public issue.</p>

<h3>Disclaimer</h3>

<p>Torn War Overlay is an unofficial community userscript and is not affiliated with, endorsed by, or maintained by Torn or Chedburn Networks. Use it in accordance with Torn's current rules and API policies.</p>
```

## Greasy Fork source-sync setup

Once the canonical production file exists at the repository root as:

`/torn-war-overlay.user.js`

use this branch-based raw URL as Greasy Fork's source/sync URL:

`https://raw.githubusercontent.com/JarbasFerro/torn-war-overlay/main/torn-war-overlay.user.js`

Use the branch URL rather than a commit-specific URL so future updates can be detected.

Recommended workflow:

1. Publish/import the first script version into Greasy Fork from the canonical GitHub source.
2. Configure source sync against the raw `main` branch file above.
3. Enable Greasy Fork's GitHub webhook integration after the first import.
4. On each release, update the canonical `.user.js` file and increment `@version` in the same commit.
5. Verify the resulting Greasy Fork version after the webhook runs.

The production `.user.js` file should be modified on normal releases rather than generated only as an untracked/release-only asset, because webhook matching depends on GitHub reporting that file in the push.

## Suggested Greasy Fork tags / categorisation language

Keep discoverability relevant rather than keyword-heavy. Appropriate terms in the listing text are:

- Torn
- Torn ranked war
- faction war
- target overlay
- hospital timer
- Torn PDA

Do not add unrelated game/tool names merely for search placement.

## Publication checklist

Before the first public release:

- [ ] Canonical `torn-war-overlay.user.js` committed to `main`.
- [ ] `@name`, `@namespace`, `@version`, `@description` and `@match` verified.
- [ ] `@supportURL` points to GitHub Issues.
- [ ] Licence/copyright metadata confirmed.
- [ ] No secrets or API keys committed.
- [ ] No minified or obfuscated production code.
- [ ] Syntax check passes.
- [ ] Torn PDA real-device smoke test passes.
- [ ] Standard userscript-manager smoke test performed if claiming compatibility.
- [ ] Greasy Fork full description pasted and reviewed.
- [ ] GitHub raw source sync configured.
- [ ] GitHub webhook configured after first import.
- [ ] Greasy Fork installation tested from a clean userscript installation.

## First-release recommendation

Publish the current release-candidate line only after the canonical source and metadata are committed. If no functional code change is needed, a metadata/distribution cleanup can be released as `0.13.1`; otherwise the next functional hardening release should increment normally.
