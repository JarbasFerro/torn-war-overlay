# Torn War Overlay design system

Torn War Overlay shares the Market Edge design system (`torn-market-edge/docs/DESIGN.md`), so both scripts look like one product on Torn's pages, mostly on a phone in Torn PDA. The token values are identical; only the prefix differs (`--two-` here, `--me-` there). Keep the two token blocks in step.

The stylesheet is the template string in `injectStyles()` in `torn-war-overlay.user.js`. Every size and colour below is a token defined at its top; use the token, not a raw value.

## Principles

1. **The decision first.** Each row says who to hit and when: status, verdict, time to leave hospital. Supporting facts follow in muted text; details go behind the dock's detail toggle.
2. **Dense, not cramped.** Faction member rows are crowded, so in-row badges use the smallest type size. Panel buttons are 40 to 50 px, a deliberate exception: they are pressed mid-fight.
3. **Quiet unless it matters.** Neutral data sits in grey strips. Colour is reserved for a state that needs attention, and is never the only signal: a word or number always goes with it.
4. **Torn's layout is never pushed around.** In-row badges are absolutely positioned overlays; they do not change row height.

## Identity

- **The state edge.** A 3 px coloured left edge (`--two-edge`) marks the floating surfaces: the attack panel, hunt dock, tools sheet and the dock's guard lines. Neutral is `--two-strip-border`; guard lines use `--two-bad`, `--two-warn` or `--two-good`.
- **State colours:** green `--two-good` (good, best, win, ready), amber `--two-warn` (soon, worth considering, warning), red `--two-bad` (risk, hospital, loss), grey (neutral). The best target is green, as in Market Edge.
- **Primary action.** Solid `--two-good` with `--two-on-good` text (hot NEXT, pump, minimised pill). Secondary actions use `--two-btn`; a green border marks the primary one.
- **Theme.** Tokens follow Torn's `body.dark-mode`.
- **Toasts.** Alerts use Torn PDA's native toast (`showToast`), which cannot read CSS variables. Their RGB values live in `TOAST_COLORS` and should stay close to the dark-mode state colours.

## Tokens

| Group | Tokens |
|---|---|
| Type | `--two-fs-xxs` 8, `--two-fs-xs` 10, `--two-fs-sm` 11, `--two-fs-md` 12, `--two-fs-lg` 13, `--two-fs-xl` 15 px; `--two-font` Arial. Figures use tabular numerals. |
| Space | `--two-s1` 2, `--two-s2` 4, `--two-s3` 6, `--two-s4` 8, `--two-s5` 12 px |
| Controls | `--two-ctl-sm` 22 px (rows), `--two-ctl` 26 px (panels), `--two-hit` 4 px (7 px on touch screens) |
| Shape | `--two-r-sm` 3, `--two-r` 5, `--two-r-lg` 7 px; `--two-edge` 3 px |
| Colour | `--two-bg`, `--two-bg-2`, `--two-fg`, `--two-muted`, `--two-faint`, `--two-border`, `--two-strip`, `--two-strip-border`, `--two-good` / `--two-warn` / `--two-bad` with `-bg` tints, `--two-btn*`, `--two-on-good`, `--two-shadow` |

**Addition to the shared set:** `--two-fs-xxs` (8 px) exists only here. It is for the dense badges that sit inside Torn's faction member rows (intel, age, activity, hospital, context chips, sync indicator). Do not use it for anything outside those rows. Market Edge has no equivalent. Large display numbers (the 18 px pump count) stay as raw sizes.

Text roles: primary (12 to 13 px bold) for the name and the action, secondary (11 px muted) for supporting figures, kicker (10 px uppercase muted) for group labels, badge (8 px bold) for in-row facts.

## Components

| Component | Class | Use |
|---|---|---|
| Target toolbar | `.two-target-toolbar`, `.two-toolbar-row`, `.two-toolbar-right` | Strip above the faction list: mode buttons, sync state, counters. |
| Mode group | `.two-mode-group`, `.two-mode-btn` (`.two-active`, `.two-filter-live`) | Segmented control for All / Targets etc. |
| Filter bar | `.two-filter-bar`, `.two-filter-group`, `.two-filter-label`, `.two-filter-chip` (`.two-active`, `.two-filter-reset`) | Toggle chips; struck through when off. |
| Sync indicator | `.two-sync-indicator` (`.two-live`, `.two-syncing`, `.two-rate`, `.two-error`, `.two-key`) | API state; the word always goes with the colour. |
| Counter | `.two-target-counter`, `.two-counter-item`, `.two-counter-dot`, `.two-counter-number` | Green and amber target counts. |
| Intel badge | `.two-intel-badge` (`-proven`, `-likely`, `-risk`, `-changed`, `-easy`, `-good`, `-risky`, `-avoid`, `-estimated`, `-best`) | Verdict on a member row. `-best` is the only solid one (green, "BEST"). |
| Age / activity badge | `.two-age-badge`, `.two-activity-badge` | Account age and last-action facts on a row. |
| Hospital badge | `.two-hosp-badge` (`.two-soon`, `.two-watch-window`, `.two-now`, `.two-target-window`, `.two-out-early`, `.two-due`, `.two-volatile`) | Time to leave hospital, overlaid on the row. |
| Attack history | `.two-attack-history`, `.two-attack-dot` (`-win`, `-loss`, `-stalemate`) | Past results as dots. |
| Context chip | `.two-context-chip` (`.two-chip-positive`, `-negative`, `-urgent`, `-hosp`, `-leave`, `-bonus`) | Short context facts on a row. |
| Row highlights | `li.two-best-target`, `li.two-ideal-target`, `li.two-good-target`, `li.two-dom-ready`, `li.two-target-focus-flash` | Outline and left inset on a member row. Best and ideal are green; good is amber. |
| Attack panel | `.two-attack-panel`, `.two-attack-head`, `.two-attack-status-*`, `.two-attack-result-*`, `.two-attack-next*`, `.two-attack-hunt`, `.two-hunt-toggle`, `.two-attack-detail` | Floating panel on the attack page; state edge. |
| Intel sheet | `.two-sheet-backdrop`, `.two-sheet`, `.two-sheet-*` | Bottom sheet with facts about one target. |
| Hunt dock | `.two-hunt-dock` (`-min`), `.two-hd-top`, `.two-hd-name`, `.two-hd-verdict`, `.two-hd-v-*`, `.two-hd-status`, `.two-hd-s-*`, `.two-hd-energy`, `.two-hd-treats`, `.two-hd-hint`, `.two-hd-result`, `.two-hd-res-*`, `.two-hd-session`, `.two-hd-detail` | Bottom-docked hunt panel; state edge. |
| Guard line | `.two-hd-guard` (`-bad`, `-warn`, `-good`) | One-line warning in the dock; edge colour carries the state. |
| Dock actions | `.two-hd-actions`, `.two-hd-pump`, `.two-hd-next` (`-hot`, `-wait`), `.two-hd-pill`, `.two-hd-stop`, `.two-hd-tools`, `.two-hd-icon`, `.two-hd-buttons` | Pump and NEXT are primary (solid green when hot); Stop is destructive (red tint). |
| Tools sheet | `.two-tools-overlay`, `.two-tools-sheet`, `.two-tools-title`, `.two-tools-group`, `.two-tools-btn`, `.two-tools-close` | Full-width action list; state edge. |

## Copy

- Money and time: short form (`$13.7k`, `4m 20s`), exact only where the player compares them.
- Separator: a middle dot ` · `.
- Say why instead of showing nothing ("Out of energy", "In hospital").
- Write in words a player uses: "target", "hospital", "bonus", "next".
- No `title` tooltips: mobile webviews pop them up over the row.

## Rules for new UI

- Start from an existing component; add it here before using a new one.
- Use tokens only. No raw hex colours, no `rgba()` for state colours, no glow shadows; the one allowed raw colour is the black scrim behind a sheet.
- Rules on elements inside Torn's markup need `!important`; the panel, dock and sheets do not.
- Never set a fixed height on a Torn element; use an overlay.
- A new floating surface gets the state edge and `--two-shadow`.
- Check new UI at 390 px wide in dark mode before release.
