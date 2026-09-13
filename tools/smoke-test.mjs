// Node smoke harness for torn-war-overlay.user.js.
//
// Boots the script several times with a minimal browser stub:
//   1. faction page mode: verifies the built-in self-tests report no faults and the API key prompt is reached once;
//   2. attack page mode without a key: never prompts, emits no errors;
//   3. attack page mode with a key and a stubbed API: the panel mounts and shows the target's hospital countdown;
//   4. an unrelated page: the script does not run.
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

async function boot({ pathname, search, seed = {}, fetchImpl = null }) {
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
  await new Promise(resolve => setTimeout(resolve, 150));
  return { errors, warnings, promptCalls, mounted: body.children.length, panel: body.children[0] || null };
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

const other = await boot({ pathname: '/index.php', search: '' });
if (other.promptCalls !== 0 || other.errors.length > 0) { failed = true; console.error('Unrelated page: script should not run'); }

console.log(failed ? 'SMOKE TEST FAILED' : `SMOKE TEST OK (faction warnings: ${faction.warnings.length}, attack warnings: ${attack.warnings.length + attackWithKey.warnings.length})`);
for (const line of [...faction.warnings, ...attack.warnings, ...attackWithKey.warnings]) console.log(`  warn: ${line}`);
process.exit(failed ? 1 : 0);
