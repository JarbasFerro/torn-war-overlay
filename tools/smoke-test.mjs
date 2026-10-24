// Node smoke harness for torn-war-overlay.user.js.
//
// Boots the script several times with a minimal browser stub:
//   1. faction page mode: verifies the built-in self-tests report no faults and the API key prompt is reached once;
//   2. attack page mode without a key: never prompts, emits no errors;
//   3. attack page mode with a key and a stubbed API: the panel mounts and shows the target's hospital countdown;
//   4. attack page mode with hunt mode on: a stale saved target is refreshed through its faction roster and offered
//      as the next target, then the scanner keeps a weak player and skips a strong one and a missing ID;
//   5. an unrelated page: the script does not run.
// Run: node tools/smoke-test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, '..', 'torn-war-overlay.user.js'), 'utf8');

function makeElement(tag = 'div') {
  const element = {
    tagName: String(tag).toUpperCase(),
    children: [],
    dataset: {},
    style: {},
    className: '',
    textContent: '',
    hidden: false,
    title: '',
    type: '',
    classList: {
      add() {}, remove() {}, toggle() { return false; }, contains() { return false; },
    },
    setAttribute() {}, getAttribute() { return null; },
    appendChild(child) { this.children.push(child); return child; },
    append(...nodes) { this.children.push(...nodes); },
    prepend(...nodes) { this.children.unshift(...nodes); },
    before() {}, replaceChildren(...nodes) { this.children = nodes; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {},
    closest() { return null; },
    cloneNode() { return makeElement(tag); },
    get isConnected() { return true; },
  };
  return element;
}

async function boot({ pathname, search, seed = {}, fetchImpl = null, waitMs = 150 }) {
  const errors = [];
  const warnings = [];
  const storage = new Map(Object.entries(seed));
  let promptCalls = 0;

  const head = makeElement('head');
  const body = makeElement('body');
  const document = {
    hidden: false,
    head,
    body,
    documentElement: makeElement('html'),
    hasFocus: () => true,
    getElementById: () => null,
    createElement: makeElement,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  };

  const sandbox = {
    console: {
      log: () => {},
      info: () => {},
      warn: (...args) => warnings.push(args.map(String).join(' ')),
      error: (...args) => errors.push(args.map(String).join(' ')),
    },
    location: { hostname: 'www.torn.com', pathname, search },
    document,
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
    performance: { now: () => Number(process.hrtime.bigint() / 1_000_000n) },
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: callback => setTimeout(callback, 0),
    cancelAnimationFrame: id => clearTimeout(id),
    MutationObserver: class { observe() {} disconnect() {} },
    AbortController,
    fetch: fetchImpl || (() => Promise.reject(new Error('network disabled in smoke test'))),
    history: { pushState() {}, replaceState() {} },
    URL, URLSearchParams,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.prompt = () => { promptCalls += 1; return null; };
  sandbox.alert = () => {};
  sandbox.confirm = () => true;
  sandbox.addEventListener = () => {};

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'torn-war-overlay.user.js' });
  await new Promise(resolve => setTimeout(resolve, waitMs));
  return { errors, warnings, promptCalls, storage, mounted: body.children.length, panel: body.children.find(node => node.__twoName) || null, dock: body.children.find(node => node.__twoHuntDock) || null };
}

let failed = false;

const faction = await boot({ pathname: '/factions.php', search: '?step=your' });
const selfTestErrors = faction.errors.filter(line => line.includes('Internal self-test failures'));
const initErrors = faction.errors.filter(line => line.includes('Initialization failed'));
if (selfTestErrors.length > 0) { failed = true; console.error('SELF-TEST FAULTS:', selfTestErrors.join('\n')); }
if (initErrors.length > 0) { failed = true; console.error('INIT ERRORS:', initErrors.join('\n')); }
if (faction.promptCalls !== 1) { failed = true; console.error(`Faction mode: expected exactly one API key prompt, saw ${faction.promptCalls}`); }
if (faction.errors.length > selfTestErrors.length + initErrors.length) { failed = true; console.error('OTHER ERRORS:', faction.errors.join('\n')); }

const attack = await boot({ pathname: '/loader.php', search: '?sid=attack&user2ID=123456' });
if (attack.promptCalls !== 0) { failed = true; console.error(`Attack mode: expected no API key prompt, saw ${attack.promptCalls}`); }
if (attack.errors.length > 0) { failed = true; console.error('ATTACK MODE ERRORS:', attack.errors.join('\n')); }

// Attack mode with a key and a stubbed API: the target is in hospital for 2 minutes; everything else 404s.
const nowSec = Math.floor(Date.now() / 1000);
const stubFetch = url => {
  const text = String(url).includes('/user/123456/basic')
    ? JSON.stringify({ profile: { id: 123456, name: 'Dummy', level: 42, status: { state: 'Hospital', description: 'In hospital', until: nowSec + 120 } } })
    : String(url).includes('/faction/timestamp')
      ? JSON.stringify({ timestamp: nowSec })
      : JSON.stringify({ error: { code: 6, error: 'Incorrect ID' } });
  return Promise.resolve({ status: 200, text: () => Promise.resolve(text) });
};
const attackWithKey = await boot({ pathname: '/page.php', search: '?sid=attack&user2ID=123456', seed: { 'two.apiKey.v1': 'ABCDEFGHIJKLMNOP' }, fetchImpl: stubFetch });
if (attackWithKey.errors.length > 0) { failed = true; console.error('ATTACK MODE (with key) ERRORS:', attackWithKey.errors.join('\n')); }
if (attackWithKey.mounted < 1 || !attackWithKey.panel) { failed = true; console.error('Attack mode (with key): panel was not mounted'); }
const panel = attackWithKey.panel;
const statusText = panel?.__twoStatus?.textContent || '';
if (!/^HOSP 1:5\d$|^HOSP 2:00$/.test(statusText)) { failed = true; console.error(`Attack mode: expected a hospital countdown, saw "${statusText}"`); }
if (!String(panel?.__twoStatus?.className || '').includes('two-attack-status-hospital')) { failed = true; console.error('Attack mode: hospital status class missing'); }
if (!/Dummy \[42\]/.test(panel?.__twoName?.textContent || '')) { failed = true; console.error(`Attack mode: expected target name and level, saw "${panel?.__twoName?.textContent}"`); }

// Hunt mode: IDs 1005 (weak, Okay), 1004 (missing) and 1003 (strong) are scanned at the paced gap, newest first.
const huntProfiles = {
  1005: { id: 1005, name: 'Pumpkin', level: 5, rank: 'Beginner', status: { state: 'Okay' }, last_action: { timestamp: nowSec } },
  1003: { id: 1003, name: 'Tank', level: 20, rank: 'Invincible', status: { state: 'Okay' }, last_action: { timestamp: nowSec } },
};
const huntUrls = [];
const huntFetch = url => {
  huntUrls.push(String(url));
  if (String(url).includes('/faction/50/members')) {
    const members = [{ id: 2001, name: 'Ghost', level: 3, status: { state: 'Okay' }, last_action: { timestamp: nowSec - 86400 } }];
    return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ members })) });
  }
  const match = String(url).match(/\/user\/(\d+)\/(profile|basic)/);
  const profile = match ? huntProfiles[match[1]] : null;
  if (profile) return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ profile })) });
  return stubFetch(url);
};
const hunt = await boot({
  pathname: '/loader.php',
  search: '?sid=attack&user2ID=123456',
  seed: {
    'two.apiKey.v1': 'ABCDEFGHIJKLMNOP',
    'two.selfIntel.v1': JSON.stringify({ bss: 20000 }),
    'two.hunt.v1': JSON.stringify({ enabled: true, cursor: 1005, pool: { 2001: { n: 'Ghost', l: 3, w: 'r', r: 0.01, s: 'o', t: 0, c: 0, f: 50 } } }),
  },
  fetchImpl: huntFetch,
  waitMs: 6_500, // Three scans 1.5 s apart, and the 2 s save throttle must land after the third.
});
if (hunt.errors.length > 0) { failed = true; console.error('HUNT MODE ERRORS:', hunt.errors.join('\n')); }
const huntSaved = JSON.parse(hunt.storage.get('two.hunt.v1') || '{}');
if (!huntSaved.pool?.['1005']) { failed = true; console.error('Hunt mode: weak player 1005 was not kept', huntSaved); }
if (huntSaved.pool?.['1003']) { failed = true; console.error('Hunt mode: strong player 1003 was kept'); }
if (!(huntSaved.cursor <= 1002)) { failed = true; console.error(`Hunt mode: expected the cursor past 1003, saw ${huntSaved.cursor}`); }
const ghost = huntSaved.pool?.['2001'];
if (!ghost || ghost.s !== 'o' || !(ghost.c > 0) || ghost.a !== nowSec - 86400) { failed = true; console.error('Hunt mode: stale target 2001 was not refreshed from its faction roster', ghost); }
if (huntUrls.filter(url => url.includes('/user/2001/')).length > 0) { failed = true; console.error('Hunt mode: target 2001 was refreshed per user instead of by faction roster'); }
const dock = hunt.dock;
if (!dock || dock.hidden) { failed = true; console.error('Hunt mode: bottom dock not shown'); }
if (hunt.panel && !hunt.panel.hidden) { failed = true; console.error('Hunt mode: the war panel should be hidden while hunting'); }
if (!dock?.__link || dock.__link.hidden || !String(dock.__link.href || '').includes('user2ID=2001') || !/^Skip ▸ Ghost · L3$/.test(dock.__linkMain.textContent)) {
  failed = true; console.error('Hunt mode: dock NEXT button for the refreshed target missing', dock?.__linkMain?.textContent, dock?.__link?.href);
}
if (!/^\d+$/.test(dock?.__pumpCount?.textContent || '')) { failed = true; console.error('Hunt mode: ready count missing on the hunt button'); }
if (!/^⚡/.test(dock?.__energy?.textContent || '') || !/Energy unavailable/.test(dock?.__energy?.title || '')) { failed = true; console.error('Hunt mode: energy chip should explain a missing energy read', dock?.__energy?.title); }

const other = await boot({ pathname: '/index.php', search: '' });
if (other.promptCalls !== 0 || other.errors.length > 0) { failed = true; console.error('Unrelated page: script should not run'); }

console.log(failed ? 'SMOKE TEST FAILED' : `SMOKE TEST OK (faction warnings: ${faction.warnings.length}, attack warnings: ${attack.warnings.length + attackWithKey.warnings.length}, hunt warnings: ${hunt.warnings.length})`);
for (const line of [...faction.warnings, ...attack.warnings, ...attackWithKey.warnings, ...hunt.warnings]) console.log(`  warn: ${line}`);
process.exit(failed ? 1 : 0);
