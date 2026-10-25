// Unit tests for the pure logic in torn-war-overlay.user.js, through the script's test hook.
// Table-driven with real numbers from the game (basket page, Torn City Times ladder, attack log shapes).
// Run: node --test tools/unit-tests.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';

let fns = null;
await boot({ pathname: '/index.php', search: '', waitMs: 0, hook: exported => { fns = exported; } });
assert.ok(fns, 'the script should hand its pure functions to the test hook');

const T = iso => Date.parse(iso) / 1000; // TCT is UTC.

test('basket progress matches the basket page and the TCT ladder', () => {
  const cases = [
    // [lifetime treats, basket name from the API, expected line]
    [290, 'Halloween Basket : Shocking', '🎃 Shocking 100/250 → Terrifying'], // Basket page: "100 / 250 Treats Collected".
    [0, 'Spooky Basket', '🎃 Spooky 0/5 → Creepy'],
    [15, 'Freaky Basket', '🎃 Freaky 0/25 → Frightful'],
    [1940, '', '🎃 Petrifying 0/2,500 → Nightmarish'], // No name: the ladder decides.
    [4440, 'Nightmarish Basket', '🎃 Nightmarish · top basket · 🍬4,440'],
    [9999, 'Apocalyptic Basket', '🎃 Apocalyptic · top basket · 🍬9,999'],
  ];
  for (const [total, basket, line] of cases) assert.equal(fns.huntBasketLine({ total, basket }), line, `${total} ${basket}`);
  const shocking = fns.huntBasketProgress(290, 'Shocking');
  assert.equal(shocking.chance, 60);
  assert.equal(shocking.toGo, 150);
  assert.equal(fns.huntBasketProgress(4440, 'Nightmarish').chance, 80);
});

test('Halloweek runs 25 Oct 00:00 to 1 Nov 23:59:59 TCT', () => {
  const cases = [
    ['2026-10-24T23:59:59Z', false],
    ['2026-10-25T00:00:00Z', true],
    ['2026-11-01T23:59:59Z', true],
    ['2026-11-02T00:00:00Z', false],
  ];
  for (const [iso, active] of cases) assert.equal(fns.halloweekWindow(T(iso)).active, active, iso);
});

test('attack tally counts each fight once, wins only, inside the window', () => {
  const seen = {};
  const windowStart = T('2026-10-25T00:00:00Z');
  const page = [
    { id: 1, started: T('2026-10-26T10:00:00Z'), result: 'Attacked' },
    { id: 2, started: T('2026-10-26T10:01:00Z'), result: 'Hospitalized' },
    { id: 3, started: T('2026-10-26T10:02:00Z'), result: 'Lost' },
    { id: 4, started: T('2026-10-24T23:59:00Z'), result: 'Mugged' }, // Before Halloweek: ignored.
  ];
  const first = fns.tallyOutgoingAttacks(seen, page, windowStart); // Objects from the sandbox: compare fields.
  assert.equal(first.added, 3);
  assert.equal(first.newest, T('2026-10-26T10:02:00Z'));
  assert.equal(fns.tallyOutgoingAttacks(seen, page, windowStart).added, 0, 'the same page again adds nothing');
  assert.equal(Object.values(seen).filter(([, won]) => won).length, 2);
});

test('hit goals: TCT midnight rollover, pace and the per-day target', () => {
  const seen = {
    a: [T('2026-10-26T23:59:59Z'), 1], // Yesterday, one second before midnight.
    b: [T('2026-10-27T00:00:00Z'), 1], // Today.
    c: [T('2026-10-27T08:00:00Z'), 0], // A loss.
  };
  const goals = { day: 50, event: 400 };
  const sum = fns.hitGoalSummary(seen, goals, T('2026-10-27T12:00:00Z'));
  assert.equal(sum.today, 1);
  assert.equal(sum.event.hits, 2);
  assert.equal(sum.event.left, 398);
  assert.equal(sum.event.daysLeft, 6); // 27 Oct 12:00 to 2 Nov 00:00 is 5.5 days, rounded up.
  assert.equal(sum.event.perDay, 67);
  assert.equal(sum.event.onPace, false);
  assert.equal(fns.hitGoalSummary(seen, goals, T('2026-11-05T12:00:00Z')).event, null, 'no event outside Halloweek');
});

test('chain bonus hits', () => {
  for (const hit of [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]) assert.ok(fns.isChainBonusHit(hit), `${hit}`);
  for (const hit of [1, 11, 99, 101, 251, 4006]) assert.ok(!fns.isChainBonusHit(hit), `${hit}`);
});

test('finish hint: hospitalize the active, leave the offline', () => {
  assert.equal(fns.finishHintFor({ activityStatus: 'Online' }).action, 'HOSP');
  assert.equal(fns.finishHintFor({ activityStatus: 'Offline', inactivitySec: 3600 }).action, 'LEAVE');
  assert.equal(fns.finishHintFor({ activityStatus: 'Offline', inactivitySec: 600 }).action, 'HOSP', 'active in the last 15 minutes');
  assert.equal(fns.finishHintFor({ activityStatus: 'Offline', inactivitySec: 3600, verdict: 'AVOID' }).action, 'HOSP');
});

test('API error kinds: only 7 and 16 switch a feature off', () => {
  const { ApiError, apiErrorKind } = fns;
  const cases = [
    [{ code: 7 }, 'unsupported'], [{ code: 16 }, 'unsupported'],
    [{ code: 2 }, 'key'], [{ code: 13 }, 'key'],
    [{ code: 6 }, 'failed'],
    [{ code: 5, retryable: true }, 'transient'], [{ code: 9, retryable: true }, 'transient'],
    [{ retryable: true, backoff: true }, 'backoff'],
  ];
  for (const [opts, kind] of cases) assert.equal(apiErrorKind(new ApiError('x', opts)), kind, JSON.stringify(opts));
});

test('attack results', () => {
  for (const result of ['Attacked', 'Mugged', 'Hospitalized', 'Arrested', 'Looted', 'Special', 'Bounty']) assert.equal(fns.classifyAttackResult(result).kind, 'win', result);
  assert.equal(fns.classifyAttackResult('Lost').kind, 'loss');
  for (const result of ['Stalemate', 'Escape', 'Timeout', '']) assert.equal(fns.classifyAttackResult(result).kind, 'stalemate', result);
});

test('ranked war: ongoing vs finished', () => {
  const now = T('2026-10-27T12:00:00Z');
  const war = (extra = {}) => ({ war_id: 77, start: now - 3600, end: null, winner: null, target: 3000, factions: [{ id: 1, name: 'Us', score: 900, chain: 40 }, { id: 2, name: 'Them', score: 700, chain: 12 }], ...extra });
  const ongoing = fns.normalizeRankedWar(war(), 2, now);
  assert.equal(ongoing.enemyName, 'Them');
  assert.equal(ongoing.enemyScore, 700);
  assert.equal(fns.normalizeRankedWar(war({ winner: 1, end: now - 600 }), 2, now), null, 'a decided war is over');
  assert.equal(fns.normalizeRankedWar(war({ start: now + 3600 }), 2, now), null, 'not started yet');
});

test('hunt skips federal jail and fallen players', () => {
  const nowSec = T('2026-10-27T12:00:00Z');
  for (const state of ['Federal', 'Fallen']) {
    const verdict = fns.classifyHuntProfile({ id: 9, rank: 'Beginner', level: 5, status: { state } }, { ownScore: 1000, nowSec });
    assert.equal(verdict.action, 'skip', state);
  }
});

test('Torn markup health: flags real breakage, stays quiet on normal pages', () => {
  const ids = issues => Array.from(issues, issue => issue.id).sort().join(',');
  const scan = fns.tornDomIssuesFromScan;
  assert.equal(ids(scan({ lists: 2, rows: 100, rowsWithMember: 100, rowsWithStatus: 100 })), '', 'a healthy war page');
  assert.equal(ids(scan({ lists: 0, rows: 0, profileLinks: 3 })), '', 'a faction tab without member lists');
  assert.equal(ids(scan({ lists: 0, rows: 0, profileLinks: 80 })), 'members-list', 'players shown but no member list');
  assert.equal(ids(scan({ lists: 2, rows: 0, profileLinks: 80 })), 'member-rows');
  assert.equal(ids(scan({ lists: 2, rows: 100, rowsWithMember: 100, rowsWithStatus: 10 })), 'status-cell');
  assert.equal(ids(scan({ lists: 2, rows: 100, rowsWithMember: 20, rowsWithStatus: 100 })), 'member-cell');
  assert.equal(scan({ lists: 0, rows: 0, profileLinks: 80 })[0].critical, true);

  const log = fns.tornDomIssuesFromAttackLog;
  assert.equal(ids(log({ lines: 12, results: 1, foundAt: 1, pageOpenSec: 600 })), '', 'a normal fight');
  assert.equal(ids(log({ lines: 0, results: 0, foundAt: 0, pageOpenSec: 60 })), '', 'just opened, no fight yet');
  assert.equal(ids(log({ lines: 45, results: 0, foundAt: 1, pageOpenSec: 900 })), 'fight-wording');
  assert.equal(ids(log({ lines: 0, results: 0, foundAt: 0, pageOpenSec: 200 })), 'attack-log');
});

test('fight lines as Torn writes them', () => {
  const cases = [
    ['Jarbas left Giresse56 on the street (+1.67)', 'Giresse56', 'win', 'leave'],
    ['Jarbas hospitalized Pandz (+2.10)', 'Pandz', 'win', 'hospitalize'],
    ['Jarbas mugged Squrrl and stole $1,234 (+0.98)', 'Squrrl', 'win', 'mug'],
    ['Jarbas lost to Tank', 'Tank', 'loss', 'defeat'],
  ];
  for (const [line, target, kind, method] of cases) {
    const result = fns.classifyFightLine(line, target);
    assert.equal(result?.kind, kind, line);
    assert.equal(result?.method, method, line);
  }
  assert.equal(fns.classifyFightLine('Jarbas fired 3 rounds of their Rifle hitting Pandz in the chest', 'Pandz')?.kind ?? null, null, 'a hit line is not a result');
});
