// Shared test harness for torn-war-overlay.user.js: a minimal browser stand-in and a fake clock.
//
// boot() runs the script in a node vm sandbox. Time is virtual: Date, performance.now and every timer come from the
// fake clock, and boot() advances it by waitMs, letting promises settle after each timer, so a scenario that needs six
// seconds of script time runs in milliseconds. `at` schedules test actions on the same clock ({ 2500: () => ... }).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
export const source = readFileSync(path.join(here, '..', 'torn-war-overlay.user.js'), 'utf8');

const settle = async () => { for (let i = 0; i < 4; i += 1) await new Promise(resolve => setImmediate(resolve)); };

export function makeClock(startMs = Date.now(), onTimerError = () => {}) {
  let now = startMs;
  let seq = 0;
  const timers = new Map();
  const add = (fn, ms, args, repeat) => {
    const id = ++seq;
    const delay = Math.max(0, Number(ms) || 0);
    timers.set(id, { at: now + delay, fn, args, every: repeat ? Math.max(1, delay) : 0 });
    return id;
  };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) { if (args.length) super(...args); else super(now); }
    static now() { return now; }
  }
  return {
    get now() { return now; },
    Date: FakeDate,
    performance: { now: () => now - startMs + 1_000 },
    setTimeout: (fn, ms, ...args) => add(fn, ms, args, false),
    setInterval: (fn, ms, ...args) => add(fn, ms, args, true),
    clearTimeout: id => { timers.delete(id); },
    clearInterval: id => { timers.delete(id); },
    async advance(ms) {
      const target = now + ms;
      await settle();
      for (let guard = 0; guard < 200_000; guard += 1) {
        let nextId = null;
        let next = null;
        for (const [id, timer] of timers) {
          if (timer.at <= target && (!next || timer.at < next.at || (timer.at === next.at && id < nextId))) { nextId = id; next = timer; }
        }
        if (!next) break;
        now = Math.max(now, next.at);
        if (next.every) next.at = now + next.every; else timers.delete(nextId);
        try { next.fn(...next.args); } catch (err) { onTimerError(err); }
        await settle();
      }
      now = target;
      await settle();
    },
  };
}

export function makeElement(tag = 'div') {
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

export async function boot({ pathname, search, seed = {}, fetchImpl = null, waitMs = 150, globals = {}, at = {}, hook = null }) {
  const errors = [];
  const warnings = [];
  const clock = makeClock(Date.now(), err => errors.push(`Uncaught in timer: ${err?.stack || err}`));
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
    Date: clock.Date,
    performance: clock.performance,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, setInterval: clock.setInterval, clearInterval: clock.clearInterval,
    requestAnimationFrame: callback => clock.setTimeout(() => callback(clock.now), 0),
    cancelAnimationFrame: id => clock.clearTimeout(id),
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
  if (hook) sandbox.__TWO_TEST_HOOK__ = hook;
  for (const [ms, fn] of Object.entries(at)) clock.setTimeout(fn, Number(ms));

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'torn-war-overlay.user.js' });
  await clock.advance(waitMs);
  return { clock, errors, warnings, promptCalls, storage, menu, mounted: body.children.length, panel: body.children.find(node => node.__twoName) || null, dock: body.children.find(node => node.__twoHuntDock) || null, home: body.children.find(node => node.__twoHomeCard) || null, body };
}

