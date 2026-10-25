// Node smoke harness for torn-war-overlay.user.js.
//
// Boots the script several times with a minimal browser stub:
//   1. faction page mode: verifies the built-in self-tests report no faults and the API key prompt is reached once;
//   2. attack page mode without a key: never prompts, emits no errors;
//   3. attack page mode with a key and a stubbed API: the panel mounts and shows the target's hospital countdown;
//   4. attack page mode with hunt mode on: a stale saved target is refreshed through its faction roster and offered
//      as the next target, then the scanner keeps a weak player and skips a strong one and a missing ID;
//   5. Torn PDA native storage: existing localStorage data moves into PDA_storage (verified, then removed locally), the
//      script runs from it and later writes land there; a failing or mismatching store keeps localStorage untouched;
//   6. Torn PDA app bridge: a background tab (PDA_getTabState says inactive) makes no hunt requests until the tab
//      becomes active, the storage move shows a native toast, and the userscript menu mirrors the tools list;
//   7. an unrelated page: the script does not run.
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

async function boot({ pathname, search, seed = {}, fetchImpl = null, waitMs = 150, globals = {} }) {
  const errors = [];
  const warnings = [];
  const storage = new Map(Object.entries(seed));
  let promptCalls = 0;
  const menu = [];

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
      get length() { return storage.size; },
      key: index => Array.from(storage.keys())[index] ?? null,
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
  sandbox.GM_registerMenuCommand = label => menu.push(label);
  Object.assign(sandbox, globals);
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.prompt = () => { promptCalls += 1; return null; };
  sandbox.alert = () => {};
  sandbox.confirm = () => true;
  sandbox.addEventListener = () => {};

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'torn-war-overlay.user.js' });
  await new Promise(resolve => setTimeout(resolve, waitMs));
  return { errors, warnings, promptCalls, storage, menu, mounted: body.children.length, panel: body.children.find(node => node.__twoName) || null, dock: body.children.find(node => node.__twoHuntDock) || null };
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
const huntFetch = (url, options) => {
  huntUrls.push(String(url));
  // Only the Limited key can read bars, like a Public Torn PDA key next to a Limited attack-history key.
  if (String(url).includes('/user/bars')) {
    const limited = String(options?.headers?.Authorization || '').includes('LIMITEDKEYLIMITE');
    return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify(limited ? { bars: { energy: { current: 100, maximum: 150, full_time: 0 } } } : { error: { code: 16, error: 'Access level of this key is not high enough' } })) });
  }
  if (String(url).includes('/user/competition')) {
    return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ competition: { name: 'Halloween', treats_collected: 1234, basket: { id: 1003, name: 'Creepy Basket' } } })) });
  }
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
    'two.attackApiKey.v1': 'LIMITEDKEYLIMITE',
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
if (dock?.__treats?.hidden || dock?.__treats?.textContent !== '🍬1,234') { failed = true; console.error('Hunt mode: treat counter from /user/competition missing', dock?.__treats?.textContent); }
if (!/^If you win: Leave, and land the last hit with a scary weapon$/.test(dock?.__hint?.textContent || '')) { failed = true; console.error('Hunt mode: Halloween finish hint missing', dock?.__hint?.textContent); }
if (huntSaved.session?.t0 !== 1234) { failed = true; console.error('Hunt mode: treat baseline not saved in the session', huntSaved.session); }
if (dock?.__energy?.textContent !== '⚡4') { failed = true; console.error('Hunt mode: energy should be read with the Limited key (100 energy = 4 hits)', dock?.__energy?.textContent, dock?.__energy?.title); }

// Torn PDA native storage, modelled on userscripts/TornPDA_Storage.md: async, JSON values, setMany/getMany batches.
function makePdaStorage({ failLoad = false, corruptReadBack = false } = {}) {
  const data = new Map();
  const later = value => new Promise(resolve => setTimeout(() => resolve(value), 5));
  return {
    data,
    loadAll: () => (failLoad ? Promise.reject(new Error('bridge down')) : later(Object.fromEntries(data))),
    getMany: keys => later(Object.fromEntries(keys.map(key => [key, data.has(key) ? (corruptReadBack ? 'x' : data.get(key)) : null]))),
    setMany: entries => { for (const [key, value] of Object.entries(entries)) data.set(key, value); return later(undefined); },
    set: (key, value) => { data.set(key, value); return later(undefined); },
    get: (key, fallback) => later(data.has(key) ? data.get(key) : fallback),
    list: () => later(Array.from(data.keys())),
    delete: key => { data.delete(key); return later(undefined); },
    usage: () => later({ used: 0, quota: 10 * 1024 * 1024 }),
  };
}
const pdaSeed = {
  'two.apiKey.v1': 'ABCDEFGHIJKLMNOP',
  'two.attackApiKey.v1': 'LIMITEDKEYLIMITE',
  'two.selfIntel.v1': JSON.stringify({ bss: 20000 }),
  'two.hunt.v1': JSON.stringify({ enabled: true, cursor: 1005, pool: {} }),
  'unrelated.key': 'kept',
};
const pdaStore = makePdaStorage();
const pda = await boot({ pathname: '/loader.php', search: '?sid=attack&user2ID=123456', seed: pdaSeed, fetchImpl: huntFetch, globals: { PDA_storage: pdaStore }, waitMs: 6_500 });
if (pda.errors.length > 0) { failed = true; console.error('PDA STORAGE ERRORS:', pda.errors.join('\n')); }
if (pdaStore.data.get('two.apiKey.v1') !== 'ABCDEFGHIJKLMNOP' || !pdaStore.data.has('two.__migratedFromLocalStorage')) { failed = true; console.error('PDA storage: data was not moved into PDA_storage', Array.from(pdaStore.data.keys())); }
if (Array.from(pda.storage.keys()).some(key => key.startsWith('two.')) || pda.storage.get('unrelated.key') !== 'kept') { failed = true; console.error('PDA storage: localStorage should keep only non-script keys after the move', Array.from(pda.storage.keys())); }
if (!pda.dock || pda.dock.hidden) { failed = true; console.error('PDA storage: hunt dock should run from the moved data'); }
const pdaHunt = JSON.parse(pdaStore.data.get('two.hunt.v1') || '{}');
if (!pdaHunt.pool?.['1005'] || !(pdaHunt.cursor <= 1002)) { failed = true; console.error('PDA storage: later writes should land in PDA_storage', pdaHunt); }

for (const [label, options] of [['failing store', { failLoad: true }], ['mismatching read-back', { corruptReadBack: true }]]) {
  const fallback = await boot({ pathname: '/loader.php', search: '?sid=attack&user2ID=123456', seed: pdaSeed, fetchImpl: huntFetch, globals: { PDA_storage: makePdaStorage(options) } });
  if (fallback.errors.length > 0) { failed = true; console.error(`PDA storage (${label}) ERRORS:`, fallback.errors.join('\n')); }
  if (fallback.storage.get('two.apiKey.v1') !== 'ABCDEFGHIJKLMNOP') { failed = true; console.error(`PDA storage (${label}): localStorage data must be kept`); }
  if (!fallback.dock) { failed = true; console.error(`PDA storage (${label}): script should still run on localStorage`); }
}

// Torn PDA runtime: PDA_httpGet carries the API, flutter_inappwebview.callHandler the app handlers.
const tabState = { uid: 't1', isActiveTab: false, isWebViewVisible: true };
const bridgeCalls = [];
const pdaUrls = [];
const pdaRuntime = {
  PDA_httpGet: async (url, headers) => {
    pdaUrls.push(String(url));
    const response = await huntFetch(url, { headers });
    return { status: response.status, responseText: await response.text() };
  },
  flutter_inappwebview: {
    callHandler: (name, ...args) => {
      bridgeCalls.push([name, ...args]);
      if (name === 'PDA_getTabState') return Promise.resolve({ ...tabState });
      if (name === 'showToast' || name === 'copyToClipboard') return Promise.resolve({ status: 'success' });
      return Promise.reject(new Error(`no handler ${name}`));
    },
  },
  PDA_storage: makePdaStorage(),
};
setTimeout(() => { tabState.isActiveTab = true; }, 2_500); // The user switches to this tab.
const pdaTab = await boot({ pathname: '/loader.php', search: '?sid=attack&user2ID=123456', seed: pdaSeed, globals: pdaRuntime, waitMs: 5_500 });
if (pdaTab.errors.length > 0) { failed = true; console.error('PDA TAB ERRORS:', pdaTab.errors.join('\n')); }
const firstScanAt = pdaUrls.findIndex(url => url.includes('/user/1005/profile'));
const tabAnswersBeforeScan = bridgeCalls.slice(0, Math.max(0, bridgeCalls.length)).filter(([name]) => name === 'PDA_getTabState').length;
if (firstScanAt < 0) { failed = true; console.error('PDA tab: hunting should start once the tab becomes active'); }
if (!bridgeCalls.some(([name]) => name === 'PDA_getTabState') || tabAnswersBeforeScan < 2) { failed = true; console.error('PDA tab: tab state should be polled'); }
if (!bridgeCalls.some(([name, arg]) => name === 'showToast' && /moved \d+ saved items/.test(arg?.text || ''))) { failed = true; console.error('PDA tab: storage move should show a native toast', bridgeCalls.filter(([name]) => name === 'showToast')); }

// Same runtime, tab never active: not a single hunt request in 3 s.
const hiddenUrls = [];
const hidden = await boot({
  pathname: '/loader.php', search: '?sid=attack&user2ID=123456', seed: pdaSeed, waitMs: 3_000,
  globals: { ...pdaRuntime, PDA_storage: makePdaStorage(), PDA_httpGet: async (url, headers) => { hiddenUrls.push(String(url)); const r = await huntFetch(url, { headers }); return { status: r.status, responseText: await r.text() }; },
    flutter_inappwebview: { callHandler: name => (name === 'PDA_getTabState' ? Promise.resolve({ isActiveTab: false, isWebViewVisible: true }) : Promise.resolve({ status: 'success' })) } },
});
if (hidden.errors.length > 0) { failed = true; console.error('PDA HIDDEN TAB ERRORS:', hidden.errors.join('\n')); }
// The page's one-time context reads (clock, key info, own stats, this target's profile) are allowed; hunting other IDs,
// the 10 s status poll and the energy poll are not.
const backgroundWork = hiddenUrls.filter(url => /\/user\/(?!123456\/)\d+\/|\/user\/123456\/basic|\/user\/bars|\/faction\/\d+\/members/.test(url));
if (backgroundWork.length > 0) { failed = true; console.error('PDA tab: a background tab must not hunt or poll', backgroundWork); }

if (faction.menu.length < 10 || !faction.menu.includes('Torn War Overlay: Clear hunt list') || !faction.menu.includes('Torn War Overlay: open tools')) { failed = true; console.error('Menu should mirror the tools list', faction.menu); }

const other = await boot({ pathname: '/index.php', search: '' });
if (other.promptCalls !== 0 || other.errors.length > 0) { failed = true; console.error('Unrelated page: script should not run'); }

console.log(failed ? 'SMOKE TEST FAILED' : `SMOKE TEST OK (faction warnings: ${faction.warnings.length}, attack warnings: ${attack.warnings.length + attackWithKey.warnings.length}, hunt warnings: ${hunt.warnings.length}, pda warnings: ${pda.warnings.length})`);
for (const line of [...faction.warnings, ...attack.warnings, ...attackWithKey.warnings, ...hunt.warnings]) console.log(`  warn: ${line}`);
process.exit(failed ? 1 : 0);
