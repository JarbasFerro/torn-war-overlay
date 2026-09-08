// Node smoke harness for torn-war-overlay.user.js.
//
// Stubs just enough browser surface for the script's IIFE to boot, then verifies:
//   1. the built-in self-tests report no faults;
//   2. the manual API key prompt is reached (no key stored) and initialization stops cleanly;
//   3. no unexpected console errors were emitted.
// Run: node tools/smoke-test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, '..', 'torn-war-overlay.user.js'), 'utf8');

const errors = [];
const warnings = [];
const storage = new Map();

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
    classList: {
      add() {}, remove() {}, toggle() { return false; }, contains() { return false; },
    },
    setAttribute() {}, getAttribute() { return null; },
    appendChild(child) { this.children.push(child); return child; },
    append(...nodes) { this.children.push(...nodes); },
    prepend(...nodes) { this.children.unshift(...nodes); },
    before() {}, replaceChildren() { this.children = []; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {},
    closest() { return null; },
    cloneNode() { return makeElement(tag); },
    get isConnected() { return true; },
  };
  return element;
}

const head = makeElement('head');
const body = makeElement('body');
const document = {
  hidden: false,
  head,
  body,
  hasFocus: () => true,
  getElementById: () => null,
  createElement: makeElement,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
};

let promptCalls = 0;
const sandbox = {
  console: {
    log: () => {},
    info: () => {},
    warn: (...args) => warnings.push(args.map(String).join(' ')),
    error: (...args) => errors.push(args.map(String).join(' ')),
  },
  location: { hostname: 'www.torn.com', pathname: '/factions.php' },
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
  fetch: () => Promise.reject(new Error('network disabled in smoke test')),
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

await new Promise(resolve => setTimeout(resolve, 50));

const selfTestErrors = errors.filter(line => line.includes('Internal self-test failures'));
const initErrors = errors.filter(line => line.includes('Initialization failed'));

let failed = false;
if (selfTestErrors.length > 0) { failed = true; console.error('SELF-TEST FAULTS:', selfTestErrors.join('\n')); }
if (initErrors.length > 0) { failed = true; console.error('INIT ERRORS:', initErrors.join('\n')); }
if (promptCalls !== 1) { failed = true; console.error(`Expected exactly one API key prompt, saw ${promptCalls}`); }
if (errors.length > selfTestErrors.length + initErrors.length) { failed = true; console.error('OTHER ERRORS:', errors.join('\n')); }

console.log(failed ? 'SMOKE TEST FAILED' : `SMOKE TEST OK (warnings: ${warnings.length})`);
if (warnings.length) console.log(warnings.map(line => `  warn: ${line}`).join('\n'));
process.exit(failed ? 1 : 0);
