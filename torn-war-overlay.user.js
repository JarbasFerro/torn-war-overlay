// ==UserScript==
// @name         Torn War Overlay
// @namespace    jarbas.torn.waroverlay
// @version      0.14.0
// @description  Ranked-war target overlay for Torn with server-synced hospital countdowns, configurable target highlighting, activity/age context, personal Fair Fight memory, expected score per hit, BEST target, war/chain context, and adaptive API polling.
// @author       Jarbas Ferro
// @license      Copyright Jarbas Ferro
// @homepageURL  https://github.com/JarbasFerro/torn-war-overlay
// @supportURL   https://github.com/JarbasFerro/torn-war-overlay/issues
// @match        https://www.torn.com/factions.php*
// @connect      api.torn.com
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

  // Safety guard: even if a userscript manager ignores metadata, never run outside the Torn faction page.
  if (!/(^|\.)torn\.com$/i.test(location.hostname) || location.pathname !== '/factions.php') return;

  const SCRIPT = 'Torn War Overlay';
  const INSTANCE_KEY = '__TORN_WAR_OVERLAY_V0140__';
  if (window[INSTANCE_KEY]) {
    console.warn(`[${SCRIPT}] v0.14.0 is already running; duplicate injection ignored.`);
    return;
  }
  window[INSTANCE_KEY] = true;

  const API_BASE = 'https://api.torn.com/v2';
  const API_COMMENT = 'two-v0.14.0';
  const PDA_API_KEY = '###PDA-APIKEY###';

  const KEY_STORAGE = 'two.apiKey.v1';
  const SIGNUP_CACHE_STORAGE = 'two.signupCache.v2';
  const LEGACY_PROFILE_CACHE_STORAGE = 'two.profileCache.v1';
  const FACTION_STATUS_CACHE_STORAGE = 'two.factionStatusCache.v2';
  const LEGACY_ATTACK_HISTORY_CACHE_STORAGE = 'two.attackHistoryCache.v2';
  const ATTACK_HISTORY_CACHE_STORAGE = 'two.attackHistoryCache.v3';
  const ATTACK_API_KEY_STORAGE = 'two.attackApiKey.v1';
  const SETTINGS_STORAGE = 'two.settings.v1';
  const OPPONENT_INTEL_STORAGE = 'two.opponentIntel.v1';
  const SELF_INTEL_STORAGE = 'two.selfIntel.v1';

  const STATUS_REFRESH_ACTIVE_MS = 10_000;
  const STATUS_REFRESH_WATCH_MS = 20_000;
  const STATUS_REFRESH_IDLE_MS = 30_000;
  const HOT_PROFILE_START_GAP_MS = 900;
  const COLD_PROFILE_START_GAP_MS = 4_000;
  const FALLBACK_PROFILE_START_GAP_MS = 1_500;
  const PROFILE_MAX_IN_FLIGHT = 2;
  const STATUS_CACHE_MAX_AGE_MS = 2 * 60_000;
  const STATUS_TRUST_MAX_AGE_MS = 45_000;
  const STATUS_CACHE_PERSIST_MS = 60_000;
  const SIGNUP_CACHE_SAVE_DEBOUNCE_MS = 1_500;
  const REQUEST_TIMEOUT_MS = 15_000;
  const LOAD_OLD_EXACT_AGES_SLOWLY = false;
  const DOM_OKAY_OVERRIDE_TTL_MS = 15_000;
  const ATTACK_RESULTS_LIMIT = 5;
  const ATTACKS_REFRESH_MS = 30_000;
  const ATTACKS_PAGE_LIMIT = 100; // /user/attacks hard page cap (needed for Fair Fight modifiers).
  const ATTACKS_PAGES_PER_CYCLE = 5; // Backfill is spread across 30 s cycles so startup stays well under Torn's 100 req/min.
  const ATTACK_CURSOR_OVERLAP_SEC = 330; // An attack lasts at most 5 minutes; overlap so cursor-by-start never skips one.
  const ATTACKS_CACHE_MAX_AGE_MS = 30 * 60_000;
  const ATTACK_HISTORY_FALLBACK_WINDOW_SEC = 24 * 60 * 60;
  const WAR_CONTEXT_REFRESH_MS = 60_000;
  const WAR_CONTEXT_FALLBACK_REFRESH_MS = 60_000;
  const CHAIN_REFRESH_MS = 30_000;
  const SELF_STATS_REFRESH_MS = 6 * 60 * 60_000;
  const INTEL_RECENT_SAMPLES = 12;
  const INTEL_MAX_OPPONENTS = 600;
  const INTEL_RETENTION_MS = 240 * 24 * 60 * 60_000;
  const INTEL_SAMPLE_MAX_AGE_MS = 180 * 24 * 60 * 60_000;
  const INTEL_FF_MAX_AGE_MS = 120 * 24 * 60 * 60_000;
  const INTEL_SEEN_IDS_MAX = 3000;
  const INTEL_SAVE_DEBOUNCE_MS = 2_000;
  const FAIR_FIGHT_CAP = 3;
  const WAR_RESPECT_MULTIPLIER = 2;
  const CHAIN_BONUS_HITS = Object.freeze([10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]);
  const RESUME_DEBOUNCE_MS = 300;
  const RESUME_SNAPSHOT_REUSE_MS = 3_000;
  const TARGET_FLASH_MS = 1_400;
  const EMPTY_ROWS_GRACE_MS = 2_000;
  const MAX_PERSISTED_FACTION_CACHES = 20;
  const PERSISTED_CACHE_RETENTION_MS = 7 * 24 * 60 * 60_000;
  const WATCHDOG_INTERVAL_MS = 5_000;
  const WATCHDOG_STALE_GRACE_MS = 10_000;

  const DEFAULT_SETTINGS = Object.freeze({
    maxAgeYears: 1.5,
    greenHospitalSec: 30,
    yellowHospitalSec: 5 * 60,
    maxLevel: null,
    allowIdle: true,
    showIntel: true,
    diagnosticMode: false,
  });

  let apiKey = null;
  let attackApiKey = null;
  let apiPermanentlyDisabled = false;
  let globalBackoffUntil = 0;
  let consecutiveApiFailures = 0;

  let serverAnchorUnixMs = null;
  let serverAnchorPerfMs = null;
  let activeFactionId = null;
  let factionRefreshTimer = null;
  let factionRefreshDueAt = 0;
  let factionRefreshInFlight = null;
  let countdownTimer = null;
  let scanTimer = null;
  let resolvingFaction = false;
  let filterMode = 'all';

  // Cached status may be displayed immediately, but it is never trusted for green/yellow targeting.
  let factionLiveReady = false;
  let lastFreshSnapshotAt = 0;
  let lastFreshSnapshotPerfAt = 0;
  let apiHealth = 'syncing'; // syncing | live | rate | down | blocked | error | key
  let apiHealthDetail = '';
  let lastRenderedTrustState = false;

  let ageSearchFactionId = null;
  let ageSearchComplete = false;
  let ageSearchUnavailable = false;
  let fallbackProfileMode = false;
  let ageSearchGeneration = 0;
  let factionSnapshotMode = 'generic'; // generic | stable-fallback
  let lastNonEmptyRowsAt = Date.now();
  let selfTestFaults = [];
  let ownFactionId = null;
  let primaryKeyInfo = null;
  let attackKeyInfo = null;
  let primaryKeyInfoPromise = null;
  let attackKeyInfoPromise = null;
  let currentWar = null;
  let warContextState = 'unknown'; // unknown | ready | fallback | unavailable
  let warContextLastCheckedAt = 0;
  let warContextInFlight = null;
  let attackHistoryScope = null;
  let attackHistoryCursor = 0; // Highest attack `started` timestamp merged for the current scope.
  let attackHistoryBackfillTo = null; // Oldest `started` reached while paging backwards; null when nothing older remains.
  let attackHistoryBackfillDone = false;
  let ownChain = null; // { current, timeout, cooldown, fetchedAtPerf }
  let ownChainLastFetchedAt = 0;
  let ownChainUnsupported = false;
  let selfStatsLastFetchedAt = 0;
  let selfStatsInFlight = null;
  let intelSaveTimer = null;
  let bestTargetUserId = null;
  let bestTargetReason = '';
  let resumeTimer = null;
  let renderFrame = null;
  let fullRenderQueued = false;
  let watchdogTimer = null;
  let lastWatchdogRecoveryAt = 0;
  let lifecycleGeneration = 0;

  const runtimeStats = {
    startedAt: Date.now(),
    apiAttempts: 0,
    apiErrors: 0,
    factionSnapshots: 0,
    attackHistoryRefreshes: 0,
    profileFetches: 0,
    scans: 0,
    remounts: 0,
    renderCalls: 0,
    renderSkips: 0,
    pauseCount: 0,
    resumeCount: 0,
    watchdogRecoveries: 0,
    transportTimeouts: 0,
    intelAttacksProcessed: 0,
    intelAttacksSkipped: 0,
    chainRefreshes: 0,
    selfStatsRefreshes: 0,
    bestRecommendations: 0,
  };

  const rowsByUser = new Map();
  const statusByUser = new Map();
  const lastActionByUser = new Map();
  const memberMetaByUser = new Map();
  const ageHintByUser = new Map(); // candidate | old. Exact signup cache always wins.
  const lastHospitalDisplayByUser = new Map();
  const lastActivityDisplayByUser = new Map();
  const domStatusOverrideByUser = new Map(); // Focused-page status evidence; never persisted.
  const attackHistoryByUser = new Map(); // defenderId -> newest-first recent outgoing attack results.
  const lastRenderedSignatureByUser = new Map();

  const apiFlights = new Map();
  const queuedProfiles = new Map(); // userId -> hot | cold
  const hotProfileQueue = [];
  const coldProfileQueue = [];
  const profileIdsInFlight = new Set();
  let profileWorkerRunning = false;
  let profileRequestsInFlight = 0;
  let lastProfileRequestStart = 0;

  const listObservers = new Map();
  let bodyObserver = null;
  let attackRefreshTimer = null;
  let attackRefreshInFlight = null;
  let attackHistoryFeatureState = 'unknown'; // unknown | ready | unavailable | unsupported
  let signupSaveTimer = null;
  let statusCacheSaveTimer = null;
  let statusCacheDirty = false;
  let lastStatusCacheSaveAt = 0;

  const signupCache = loadSignupCache();
  const factionStatusCache = loadObjectJson(FACTION_STATUS_CACHE_STORAGE, {});
  const attackHistoryCache = loadObjectJson(ATTACK_HISTORY_CACHE_STORAGE, {});
  const opponentIntel = loadOpponentIntel();
  const selfIntel = loadObjectJson(SELF_INTEL_STORAGE, {});
  const processedAttackIds = new Set(Array.isArray(opponentIntel.seen) ? opponentIntel.seen.map(Number).filter(Number.isFinite) : []);
  let settings = null;

  class ApiError extends Error {
    constructor(message, { code = null, status = null, retryable = false } = {}) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = status;
      this.retryable = retryable;
    }
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }


  function loadObjectJson(key, fallback = {}) {
    const value = loadJson(key, fallback);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[${SCRIPT}] Could not save ${key}`, err);
    }
  }

  function incStat(name, amount = 1) {
    if (!Object.prototype.hasOwnProperty.call(runtimeStats, name)) return;
    runtimeStats[name] = Number(runtimeStats[name] || 0) + Number(amount || 0);
  }

  function withTimeout(promise, timeoutMs, message = 'Operation timed out.') {
    let timer = null;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          incStat('transportTimeouts');
          reject(new ApiError(message, { retryable: true }));
        }, Math.max(250, Number(timeoutMs) || REQUEST_TIMEOUT_MS));
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }


  function pruneTimestampedObjectCache(cache) {
    if (!cache || typeof cache !== 'object') return;
    const now = Date.now();
    const entries = Object.entries(cache)
      .filter(([, value]) => value && Number.isFinite(Number(value.savedAt)))
      .sort((a, b) => Number(b[1].savedAt) - Number(a[1].savedAt));
    const keep = new Set(entries
      .filter(([, value]) => now - Number(value.savedAt) <= PERSISTED_CACHE_RETENTION_MS)
      .slice(0, MAX_PERSISTED_FACTION_CACHES)
      .map(([key]) => key));
    for (const key of Object.keys(cache)) {
      if (!keep.has(key)) delete cache[key];
    }
  }

  function prunePersistentCaches() {
    pruneTimestampedObjectCache(factionStatusCache);
    pruneTimestampedObjectCache(attackHistoryCache);
    saveJson(FACTION_STATUS_CACHE_STORAGE, factionStatusCache);
    saveJson(ATTACK_HISTORY_CACHE_STORAGE, attackHistoryCache);
  }

  function sanitizeSettings(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const maxAgeYearsRaw = Number(source.maxAgeYears);
    const greenHospitalSecRaw = Number(source.greenHospitalSec);
    const yellowHospitalSecRaw = Number(source.yellowHospitalSec);
    const maxLevelRaw = source.maxLevel === '' || source.maxLevel === null || source.maxLevel === undefined ? null : Number(source.maxLevel);
    const maxAgeYears = Number.isFinite(maxAgeYearsRaw) ? Math.min(20, Math.max(0.1, maxAgeYearsRaw)) : DEFAULT_SETTINGS.maxAgeYears;
    const greenHospitalSec = Number.isFinite(greenHospitalSecRaw) ? Math.min(3600, Math.max(0, Math.round(greenHospitalSecRaw))) : DEFAULT_SETTINGS.greenHospitalSec;
    let yellowHospitalSec = Number.isFinite(yellowHospitalSecRaw) ? Math.min(7200, Math.max(greenHospitalSec, Math.round(yellowHospitalSecRaw))) : DEFAULT_SETTINGS.yellowHospitalSec;
    if (yellowHospitalSec < greenHospitalSec) yellowHospitalSec = greenHospitalSec;
    const maxLevel = Number.isFinite(maxLevelRaw) ? Math.min(100, Math.max(1, Math.round(maxLevelRaw))) : null;
    return {
      maxAgeYears,
      greenHospitalSec,
      yellowHospitalSec,
      maxLevel,
      allowIdle: source.allowIdle !== undefined ? Boolean(source.allowIdle) : DEFAULT_SETTINGS.allowIdle,
      showIntel: source.showIntel !== undefined ? Boolean(source.showIntel) : DEFAULT_SETTINGS.showIntel,
      diagnosticMode: false,
    };
  }

  function intelEnabled() {
    return settings?.showIntel !== false;
  }

  function loadSettings() {
    return sanitizeSettings(loadJson(SETTINGS_STORAGE, DEFAULT_SETTINGS));
  }

  function saveSettings() {
    saveJson(SETTINGS_STORAGE, settings);
  }

  function searchAgeDaysThreshold() {
    return Math.max(1, Math.ceil((Number(settings?.maxAgeYears) || DEFAULT_SETTINGS.maxAgeYears) * 365.2425));
  }

  function configuredMaxAgeYears() {
    return Number(settings?.maxAgeYears) || DEFAULT_SETTINGS.maxAgeYears;
  }

  function configuredGreenHospitalSec() {
    return Number.isFinite(Number(settings?.greenHospitalSec)) ? Number(settings.greenHospitalSec) : DEFAULT_SETTINGS.greenHospitalSec;
  }

  function configuredYellowHospitalSec() {
    return Number.isFinite(Number(settings?.yellowHospitalSec)) ? Number(settings.yellowHospitalSec) : DEFAULT_SETTINGS.yellowHospitalSec;
  }

  function configuredMaxLevel() {
    // Important: Number(null) === 0, so test the nullable setting before numeric conversion.
    const value = settings?.maxLevel;
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 1 ? numeric : null;
  }

  function allowIdleTargets() {
    return settings?.allowIdle !== false;
  }

  function openSettingsDialog() {
    const current = { ...settings };
    const ageRaw = window.prompt(`${SCRIPT}: maximum account age in years`, String(current.maxAgeYears));
    if (ageRaw === null) return false;
    const greenRaw = window.prompt(`${SCRIPT}: green hospital threshold in seconds`, String(current.greenHospitalSec));
    if (greenRaw === null) return false;
    const yellowRaw = window.prompt(`${SCRIPT}: yellow hospital threshold in seconds`, String(current.yellowHospitalSec));
    if (yellowRaw === null) return false;
    const levelRaw = window.prompt(`${SCRIPT}: optional maximum level (leave blank for no limit)`, current.maxLevel == null ? '' : String(current.maxLevel));
    if (levelRaw === null) return false;
    const allowIdle = window.confirm(`${SCRIPT}: should Idle players count as targets?\n\nOK = yes\nCancel = no`);
    const showIntel = window.confirm(`${SCRIPT}: show personal intel (observed Fair Fight, expected score, BEST target)?\n\nOK = yes\nCancel = no`);
    const next = sanitizeSettings({
      maxAgeYears: Number(ageRaw),
      greenHospitalSec: Number(greenRaw),
      yellowHospitalSec: Number(yellowRaw),
      maxLevel: String(levelRaw).trim() === '' ? null : Number(levelRaw),
      allowIdle,
      showIntel,
      diagnosticMode: false,
    });

    const ageThresholdChanged = Math.abs(next.maxAgeYears - current.maxAgeYears) > 1e-9;
    const maxLevelChanged = next.maxLevel !== current.maxLevel;
    settings = next;
    saveSettings();

    if (ageThresholdChanged || maxLevelChanged) {
      ageHintByUser.clear();
      ageSearchFactionId = null;
      ageSearchComplete = false;
      ageSearchUnavailable = false;
      fallbackProfileMode = false;
      if (activeFactionId) startAgePrefilter(activeFactionId);
    }

    renderAll();
    return true;
  }

  function loadSignupCache() {
    const current = loadObjectJson(SIGNUP_CACHE_STORAGE, {});
    if (Object.keys(current).length > 0) return current;

    // One-time migration from v0.5. Only permanent signup timestamps are retained.
    const legacy = loadObjectJson(LEGACY_PROFILE_CACHE_STORAGE, {});
    const migrated = {};
    for (const [id, entry] of Object.entries(legacy || {})) {
      const signedUp = Number(entry?.signedUp);
      if (Number.isFinite(signedUp) && signedUp > 0) migrated[id] = signedUp;
    }
    if (Object.keys(migrated).length > 0) saveJson(SIGNUP_CACHE_STORAGE, migrated);
    return migrated;
  }

  settings = loadSettings();
  try {
    localStorage.removeItem('two.pins.v1');
    localStorage.removeItem('two.attackHistoryCache.v1');
    localStorage.removeItem(LEGACY_ATTACK_HISTORY_CACHE_STORAGE);
  } catch { /* legacy cleanup */ }
  settings.diagnosticMode = false;
  saveSettings();

  function scheduleSignupCacheSave() {
    clearTimeout(signupSaveTimer);
    signupSaveTimer = setTimeout(() => saveJson(SIGNUP_CACHE_STORAGE, signupCache), SIGNUP_CACHE_SAVE_DEBOUNCE_MS);
  }

  function flushFactionStatusCache() {
    clearTimeout(statusCacheSaveTimer);
    statusCacheSaveTimer = null;
    if (!statusCacheDirty) return;
    saveJson(FACTION_STATUS_CACHE_STORAGE, factionStatusCache);
    statusCacheDirty = false;
    lastStatusCacheSaveAt = Date.now();
  }

  function scheduleFactionStatusCacheSave() {
    statusCacheDirty = true;
    const elapsed = Date.now() - lastStatusCacheSaveAt;
    if (elapsed >= STATUS_CACHE_PERSIST_MS) {
      flushFactionStatusCache();
      return;
    }
    if (statusCacheSaveTimer) return;
    statusCacheSaveTimer = setTimeout(flushFactionStatusCache, Math.max(250, STATUS_CACHE_PERSIST_MS - elapsed));
  }

  function isPdaKey(value) {
    return typeof value === 'string' && value.length > 0 && !value.includes('###PDA-APIKEY###');
  }

  function isLikelyApiKey(value) {
    return typeof value === 'string' && /^[A-Za-z0-9]{16}$/.test(value.trim());
  }

  function getStoredApiKey() {
    if (isPdaKey(PDA_API_KEY)) return PDA_API_KEY.trim();
    const stored = localStorage.getItem(KEY_STORAGE);
    return isLikelyApiKey(stored) ? stored.trim() : null;
  }

  function setManualApiKey() {
    const entered = window.prompt(`${SCRIPT}: paste a Torn API key.\n\nPublic access is enough for the main overlay. A Limited key unlocks personal intel (attack results, observed Fair Fight, expected score).\n\nData storage: on this device only. Data sharing: none. Purpose: ranked-war target overlay. Key storage: local browser storage, sent only to api.torn.com.`);
    if (entered === null) return false;
    if (!isLikelyApiKey(entered)) {
      window.alert(`${SCRIPT}: that does not look like a 16-character Torn API key.`);
      return false;
    }
    localStorage.setItem(KEY_STORAGE, entered.trim());
    apiKey = entered.trim();
    apiPermanentlyDisabled = false;
    window.location.reload();
    return true;
  }

  function getStoredAttackApiKey() {
    const stored = localStorage.getItem(ATTACK_API_KEY_STORAGE);
    return isLikelyApiKey(stored) ? stored.trim() : null;
  }

  function setAttackApiKey() {
    const entered = window.prompt(`${SCRIPT}: personal intel (attack results, observed Fair Fight, expected score) requires a Limited key or a Custom key that grants user -> attacks and user -> battlestats. This key is stored only in your browser and sent only to api.torn.com. Paste it here:`);
    if (entered === null) return false;
    if (!isLikelyApiKey(entered)) {
      window.alert(`${SCRIPT}: that does not look like a 16-character Torn API key.`);
      return false;
    }
    localStorage.setItem(ATTACK_API_KEY_STORAGE, entered.trim());
    attackApiKey = entered.trim();
    attackKeyInfo = null;
    attackKeyInfoPromise = null;
    attackHistoryFeatureState = 'unknown';
    clearAttackRefreshTimer();
    refreshRecentAttacks();
    updateTargetToolbars();
    return true;
  }

  function clearAttackApiKey() {
    localStorage.removeItem(ATTACK_API_KEY_STORAGE);
    attackApiKey = null;
    attackKeyInfo = null;
    attackKeyInfoPromise = null;
    attackHistoryFeatureState = 'unknown';
    attackHistoryByUser.clear();
    updateTargetToolbars();
    if (activeFactionId && isActiveView()) refreshRecentAttacks();
  }


  function getDiagnosticSnapshot() {
    const snapshotAgeSec = lastFreshSnapshotPerfAt > 0
      ? Math.max(0, Math.floor((monotonicNowMs() - lastFreshSnapshotPerfAt) / 1000))
      : null;
    return {
      script: SCRIPT,
      version: '0.14.0',
      generatedAt: new Date().toISOString(),
      active: isActiveView(),
      factionId: Number.isFinite(Number(activeFactionId)) ? Number(activeFactionId) : null,
      ownFactionId: Number.isFinite(Number(ownFactionId)) ? Number(ownFactionId) : null,
      warId: Number.isFinite(Number(currentWar?.id)) ? Number(currentWar.id) : null,
      warContextState,
      factionSnapshotMode,
      rowCount: rowsByUser.size,
      statusCount: statusByUser.size,
      ageHints: ageHintByUser.size,
      attackHistoryPlayers: attackHistoryByUser.size,
      snapshotAgeSec,
      statusTrusted: isLiveStatusTrusted(),
      apiHealth,
      apiHealthDetail,
      backoffRemainingSec: Math.max(0, Math.ceil((globalBackoffUntil - Date.now()) / 1000)),
      attackHistoryFeatureState,
      ageSearchComplete,
      ageSearchUnavailable,
      filterMode,
      intel: {
        enabled: intelEnabled(),
        opponents: Object.keys(opponentIntel.opponents || {}).length,
        processedAttackIds: processedAttackIds.size,
        ownBssKnown: Number.isFinite(Number(selfIntel?.bss)) && Number(selfIntel.bss) > 0,
        ownBssAgeSec: Number.isFinite(Number(selfIntel?.updatedAt)) ? Math.max(0, Math.floor((Date.now() - Number(selfIntel.updatedAt)) / 1000)) : null,
        chain: ownChain ? { current: ownChain.current, timeout: ownChain.timeout, cooldown: ownChain.cooldown } : null,
        war: currentWar ? { id: currentWar.id, target: currentWar.target, ownScore: currentWar.ownScore, enemyScore: currentWar.enemyScore } : null,
        attackCursor: attackHistoryCursor,
        backfillTo: attackHistoryBackfillTo,
        backfillDone: attackHistoryBackfillDone,
        bestTargetUserId,
        bestTargetReason,
      },
      settings: { ...settings },
      timers: {
        faction: Boolean(factionRefreshTimer),
        attack: Boolean(attackRefreshTimer),
        countdown: Boolean(countdownTimer),
        watchdog: Boolean(watchdogTimer),
      },
      inFlight: {
        faction: Boolean(factionRefreshInFlight),
        attack: Boolean(attackRefreshInFlight),
        war: Boolean(warContextInFlight),
        profiles: profileRequestsInFlight,
        apiFlights: apiFlights.size,
      },
      caches: {
        signups: Object.keys(signupCache).length,
        factionStatuses: Object.keys(factionStatusCache).length,
        attackScopes: Object.keys(attackHistoryCache).length,
      },
      selfTestFaults: [...selfTestFaults],
      stats: { ...runtimeStats },
      lifecycleGeneration,
      lastWatchdogRecoveryAt: lastWatchdogRecoveryAt || null,
    };
  }

  function showDiagnosticSnapshot() {
    const payload = JSON.stringify(getDiagnosticSnapshot(), null, 2);
    window.prompt(`${SCRIPT} v0.14.0 diagnostics - copy this text if troubleshooting is needed:`, payload);
    return payload;
  }


  if (typeof GM_registerMenuCommand === 'function') {
    try {
      GM_registerMenuCommand('Torn War Overlay: set API key', setManualApiKey);
      GM_registerMenuCommand('Torn War Overlay: open settings', openSettingsDialog);
      GM_registerMenuCommand('Torn War Overlay: show RC diagnostics', showDiagnosticSnapshot);
      GM_registerMenuCommand('Torn War Overlay: reset settings', () => { localStorage.removeItem(SETTINGS_STORAGE); window.location.reload(); });
      GM_registerMenuCommand('Torn War Overlay: clear cached ages', () => {
        localStorage.removeItem(SIGNUP_CACHE_STORAGE);
        localStorage.removeItem(LEGACY_PROFILE_CACHE_STORAGE);
        window.location.reload();
      });
      GM_registerMenuCommand('Torn War Overlay: clear cached statuses', () => {
        localStorage.removeItem(FACTION_STATUS_CACHE_STORAGE);
        window.location.reload();
      });
      GM_registerMenuCommand('Torn War Overlay: set attack-history key', setAttackApiKey);
      GM_registerMenuCommand('Torn War Overlay: clear attack-history key', clearAttackApiKey);
      GM_registerMenuCommand('Torn War Overlay: clear cached attack dots', () => {
        localStorage.removeItem(ATTACK_HISTORY_CACHE_STORAGE);
        window.location.reload();
      });
      GM_registerMenuCommand('Torn War Overlay: clear personal intel memory', () => {
        localStorage.removeItem(OPPONENT_INTEL_STORAGE);
        localStorage.removeItem(SELF_INTEL_STORAGE);
        // The attack cursor must go too, otherwise only the newest page would be re-read after the reload.
        localStorage.removeItem(ATTACK_HISTORY_CACHE_STORAGE);
        window.location.reload();
      });
    } catch {
      // Torn PDA does not necessarily implement menu commands.
    }
  }

  function appendQuery(url, key, value) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }

  function buildApiUrl(path, query = {}, { cacheBust = false, includeKey = false, keyValue = apiKey } = {}) {
    let url = `${API_BASE}${path}`;
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url = appendQuery(url, key, value);
    }
    if (cacheBust) url = appendQuery(url, 'timestamp', Math.floor(Date.now() / 1000));
    url = appendQuery(url, 'comment', API_COMMENT);
    if (includeKey && keyValue) url = appendQuery(url, 'key', keyValue);
    return url;
  }

  function classifyApiError(code, status, message) {
    const numericCode = Number.isFinite(Number(code)) ? Number(code) : null;
    const numericStatus = Number.isFinite(Number(status)) ? Number(status) : null;

    // Key/account failures are permanent for the key used by that request.
    // Keep classification pure: an auxiliary attack-history key must never disable the main overlay.
    if ([1, 2, 10, 13, 18].includes(numericCode)) {
      return { retryable: false, backoffMs: 0, permanentKeyError: true };
    }

    if (numericCode === 5 || numericStatus === 429) {
      return { retryable: true, backoffMs: Math.min(90_000, 15_000 * Math.max(1, consecutiveApiFailures + 1)) };
    }
    if (numericCode === 8) {
      // Torn documents this as an IP-level temporary block. Back off aggressively.
      return { retryable: true, backoffMs: 15 * 60_000 };
    }
    if ([9, 12, 15, 17, 24].includes(numericCode) || (numericStatus && numericStatus >= 500)) {
      return { retryable: true, backoffMs: Math.min(120_000, 10_000 * Math.max(1, consecutiveApiFailures + 1)) };
    }
    if (numericCode === 14) return { retryable: false, backoffMs: 60 * 60_000 };
    return { retryable: false, backoffMs: 0 };
  }

  function registerApiFailure(err) {
    incStat('apiErrors');
    consecutiveApiFailures += 1;
    const classification = classifyApiError(err?.code, err?.status, err?.message);
    if (classification.permanentKeyError) {
      apiPermanentlyDisabled = true;
      apiHealth = 'key';
      apiHealthDetail = err?.message || 'API key unavailable';
    }
    if (classification.backoffMs > 0) {
      globalBackoffUntil = Math.max(globalBackoffUntil, Date.now() + classification.backoffMs);
    }

    if (apiPermanentlyDisabled) {
      apiHealth = 'key';
    } else if (Number(err?.code) === 8) {
      apiHealth = 'blocked';
      apiHealthDetail = 'Torn API IP block';
    } else if (Number(err?.code) === 5 || Number(err?.status) === 429) {
      apiHealth = 'rate';
      apiHealthDetail = 'Rate limited';
    } else if ([9, 12, 15, 17, 24].includes(Number(err?.code)) || Number(err?.status) >= 500) {
      apiHealth = 'down';
      apiHealthDetail = 'Torn API unavailable';
    } else {
      apiHealth = 'error';
      apiHealthDetail = err?.message || 'API error';
    }
    updateTargetToolbars();
  }

  function registerApiSuccess({ snapshot = false } = {}) {
    consecutiveApiFailures = 0;
    // Never let an unrelated successful concurrent request cancel a still-active backoff.
    const backoffActive = globalBackoffUntil > Date.now();
    if (!backoffActive) globalBackoffUntil = 0;

    if (snapshot) {
      factionLiveReady = true;
      lastFreshSnapshotAt = Date.now();
      lastFreshSnapshotPerfAt = monotonicNowMs();
      if (!backoffActive) {
        apiHealth = 'live';
        apiHealthDetail = '';
      }
    } else if (apiHealth !== 'live' && factionLiveReady && !backoffActive) {
      apiHealth = 'live';
      apiHealthDetail = '';
    }
  }

  function apiFlightKey(path, query, cacheBust, keyOverride = null) {
    const entries = Object.entries(query || {})
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([a], [b]) => a.localeCompare(b));
    const keyScope = keyOverride ? `override:${String(keyOverride).slice(-4)}` : 'primary';
    return `${path}|${JSON.stringify(entries)}|${cacheBust ? 'fresh' : 'cached'}|${keyScope}`;
  }

  async function apiGetRaw(path, { query = {}, cacheBust = false, keyOverride = null } = {}) {
    incStat('apiAttempts');
    const requestKey = keyOverride || apiKey;
    if (apiPermanentlyDisabled && !keyOverride) throw new ApiError('API disabled after a permanent key error.');
    if (!requestKey) throw new ApiError('No Torn API key available.');
    if (Date.now() < globalBackoffUntil) {
      throw new ApiError('API backoff active.', { retryable: true });
    }

    // Torn PDA has historically been most reliable with the key in the query string.
    // GM/fetch use Torn API v2's preferred Authorization header instead.
    const useQueryKey = typeof PDA_httpGet === 'function';
    const url = buildApiUrl(path, query, { cacheBust, includeKey: useQueryKey, keyValue: requestKey });
    const headers = {
      Accept: 'application/json',
      ...(useQueryKey ? {} : { Authorization: `ApiKey ${requestKey}` }),
    };

    let responseText = '';
    let status = 0;

    try {
      if (typeof PDA_httpGet === 'function') {
        const response = await withTimeout(PDA_httpGet(url, headers), REQUEST_TIMEOUT_MS, 'Torn PDA API request timed out.');
        status = Number(response?.status ?? 0);
        responseText = response?.responseText ?? '';
      } else if (typeof GM_xmlhttpRequest === 'function') {
        const response = await new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: 'GET',
            url,
            headers,
            timeout: REQUEST_TIMEOUT_MS,
            onload: resolve,
            onerror: () => reject(new ApiError('Torn API network error.', { retryable: true })),
            ontimeout: () => reject(new ApiError('Torn API request timed out.', { retryable: true })),
          });
        });
        status = Number(response?.status ?? 0);
        responseText = response?.responseText ?? '';
      } else {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const abortTimer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
        try {
          const response = await fetch(url, {
            credentials: 'omit',
            cache: 'no-store',
            headers,
            ...(controller ? { signal: controller.signal } : {}),
          });
          status = response.status;
          responseText = await withTimeout(response.text(), REQUEST_TIMEOUT_MS, 'Torn API response body timed out.');
        } catch (err) {
          if (err?.name === 'AbortError') {
            incStat('transportTimeouts');
            throw new ApiError('Torn API fetch timed out.', { retryable: true });
          }
          throw err;
        } finally {
          if (abortTimer) clearTimeout(abortTimer);
        }
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Torn API network error.', { retryable: true });
    }

    let data = null;
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        if (status < 200 || status >= 300) {
          throw new ApiError(`Torn API HTTP ${status}`, { status, retryable: status >= 500 || status === 429 });
        }
        throw new ApiError('Torn API returned invalid JSON.', { status, retryable: true });
      }
    }

    if (data?.error) {
      const code = Number(data.error.code ?? -1);
      const message = data.error.error ?? data.error.message ?? 'Unknown Torn API error';
      const classification = classifyApiError(code, status, message);
      throw new ApiError(`Torn API ${code}: ${message}`, {
        code,
        status,
        retryable: classification.retryable,
      });
    }

    if (status && (status < 200 || status >= 300)) {
      throw new ApiError(`Torn API HTTP ${status}`, { status, retryable: status >= 500 || status === 429 });
    }

    return data ?? {};
  }

  async function apiGet(path, options = {}) {
    const { query = {}, cacheBust = false, keyOverride = null } = options;
    const key = apiFlightKey(path, query, cacheBust, keyOverride);
    if (apiFlights.has(key)) return apiFlights.get(key);

    const flight = apiGetRaw(path, { query, cacheBust, keyOverride })
      .finally(() => {
        if (apiFlights.get(key) === flight) apiFlights.delete(key);
      });
    apiFlights.set(key, flight);
    return flight;
  }


  function keyInfoAllowsUserSelection(infoResponse, selection) {
    const available = infoResponse?.info?.selections?.user;
    return Array.isArray(available) && available.includes(selection);
  }

  async function ensurePrimaryKeyInfo() {
    if (primaryKeyInfo) return primaryKeyInfo;
    if (primaryKeyInfoPromise) return primaryKeyInfoPromise;
    primaryKeyInfoPromise = apiGet('/key/info')
      .then(data => {
        primaryKeyInfo = data;
        const factionId = Number(data?.info?.user?.faction_id);
        ownFactionId = Number.isFinite(factionId) && factionId > 0 ? factionId : null;
        return data;
      })
      .finally(() => { primaryKeyInfoPromise = null; });
    return primaryKeyInfoPromise;
  }

  async function ensureAttackKeyInfo() {
    if (!attackApiKey) return ensurePrimaryKeyInfo();
    if (attackKeyInfo) return attackKeyInfo;
    if (attackKeyInfoPromise) return attackKeyInfoPromise;
    attackKeyInfoPromise = apiGet('/key/info', { keyOverride: attackApiKey })
      .then(data => {
        attackKeyInfo = data;
        return data;
      })
      .finally(() => { attackKeyInfoPromise = null; });
    return attackKeyInfoPromise;
  }

  async function ensureAttackHistoryCapability() {
    try {
      const info = await ensureAttackKeyInfo();
      const allowed = keyInfoAllowsUserSelection(info, 'attacks');
      if (!allowed) {
        attackHistoryFeatureState = 'unsupported';
        return false;
      }
      if (attackHistoryFeatureState === 'unsupported') attackHistoryFeatureState = 'unknown';
      return true;
    } catch (err) {
      // Capability discovery is advisory. Do not let an auxiliary key affect the main overlay.
      if (attackApiKey) {
        attackHistoryFeatureState = 'unsupported';
        console.warn(`[${SCRIPT}] Could not inspect attack-history key permissions.`, err);
        return false;
      }
      throw err;
    }
  }

  function monotonicNowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  function serverNowMs() {
    if (Number.isFinite(serverAnchorUnixMs) && Number.isFinite(serverAnchorPerfMs)) {
      return serverAnchorUnixMs + (monotonicNowMs() - serverAnchorPerfMs);
    }
    return Date.now();
  }

  function serverNowSec() {
    return serverNowMs() / 1000;
  }

  function syncClockFromTimestamp(timestamp, beforePerfMs, afterPerfMs) {
    if (!Number.isFinite(Number(timestamp))) return;
    const midpointPerf = (Number(beforePerfMs) + Number(afterPerfMs)) / 2;
    serverAnchorUnixMs = Number(timestamp) * 1000;
    serverAnchorPerfMs = midpointPerf;
  }

  function getParamFromAnchor(anchor, name) {
    try {
      return new URL(anchor.href, location.href).searchParams.get(name);
    } catch {
      return null;
    }
  }

  function getUserIdFromProfileLink(anchor) {
    const xid = getParamFromAnchor(anchor, 'XID');
    return xid && /^\d+$/.test(xid) ? Number(xid) : null;
  }

  function getFactionIdFromList(list) {
    if (!list) return null;
    const factionAnchor = list.querySelector('a[href*="factions.php"][href*="ID="]');
    const raw = factionAnchor ? getParamFromAnchor(factionAnchor, 'ID') : null;
    return raw && /^\d+$/.test(raw) ? Number(raw) : null;
  }

  function getLevelFromRow(li) {
    if (!li) return Number.POSITIVE_INFINITY;
    const levelDiv = li.querySelector('div.level, [class*="level"]');
    const candidates = [levelDiv?.textContent, li.getAttribute?.('data-level')].filter(Boolean);
    for (const value of candidates) {
      const match = String(value).match(/\b(\d{1,3})\b/);
      if (match) return Number(match[1]);
    }
    return Number.POSITIVE_INFINITY;
  }

  function getSignedUp(userId) {
    const value = Number(signupCache[String(userId)]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function setSignedUp(userId, signedUp) {
    if (!Number.isFinite(Number(signedUp)) || Number(signedUp) <= 0) return;
    signupCache[String(userId)] = Number(signedUp);
    scheduleSignupCacheSave();
  }

  function ageYearsFromSignedUp(signedUp) {
    if (!Number.isFinite(Number(signedUp))) return null;
    const seconds = Math.max(0, serverNowSec() - Number(signedUp));
    return seconds / 31_556_952;
  }

  function getAgeInfo(userId) {
    const exact = ageYearsFromSignedUp(getSignedUp(userId));
    if (Number.isFinite(exact)) {
      const maxAgeYears = configuredMaxAgeYears();
      const eligible = exact < maxAgeYears;
      const decimals = Math.abs(exact - maxAgeYears) < 0.1 ? 2 : 1;
      return {
        exactYears: exact,
        confirmed: true,
        candidate: eligible,
        eligible,
        hint: eligible ? 'young' : 'old',
        label: `${exact.toFixed(decimals)}y`,
      };
    }

    const hint = ageHintByUser.get(userId) ?? null;
    if (hint === 'candidate') {
      return {
        exactYears: null,
        confirmed: false,
        candidate: true,
        eligible: false,
        hint,
        label: `<${configuredMaxAgeYears().toFixed(1)}y?`,
      };
    }
    if (hint === 'old') {
      return {
        exactYears: null,
        confirmed: false,
        candidate: false,
        eligible: false,
        hint,
        label: `>=${configuredMaxAgeYears().toFixed(1)}y`,
      };
    }
    if (hint === 'level-excluded') {
      return {
        exactYears: null,
        confirmed: false,
        candidate: false,
        eligible: false,
        hint,
        label: '--y',
      };
    }
    return {
      exactYears: null,
      confirmed: false,
      candidate: false,
      eligible: false,
      hint: null,
      label: '...y',
    };
  }

  function formatDurationCompact(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '?';
    if (seconds < 60) return '<1m';
    if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`;
    return `${Math.floor(seconds / 86_400)}d`;
  }

  function getActivityInfo(userId) {
    const lastAction = lastActionByUser.get(userId);
    const status = String(lastAction?.status ?? '').toLowerCase();
    const timestamp = Number(lastAction?.timestamp);
    const inactivitySec = Number.isFinite(timestamp) && timestamp > 0
      ? Math.max(0, Math.floor(serverNowSec() - timestamp))
      : null;

    if (status === 'online') {
      return { status, inactivitySec: 0, label: 'ON', longLabel: 'Online now', rank: 2 };
    }
    if (status === 'idle') {
      const duration = formatDurationCompact(inactivitySec);
      return { status, inactivitySec, label: `IDLE ${duration}`, longLabel: `Idle | last action ${duration} ago`, rank: 1 };
    }
    if (status === 'offline') {
      const duration = formatDurationCompact(inactivitySec);
      return { status, inactivitySec, label: `OFF ${duration}`, longLabel: `Offline | last action ${duration} ago`, rank: 0 };
    }
    return { status: '', inactivitySec: null, label: 'ACT ?', longLabel: 'Activity unavailable', rank: 3 };
  }

  function getMemberRiskInfo(userId) {
    const meta = memberMetaByUser.get(userId) || {};
    const reviveSetting = String(meta.reviveSetting || 'Unknown');
    const effectiveRevivable = Boolean(meta.isRevivable) && reviveSetting.toLowerCase() !== 'no one';
    const flags = [];
    if (meta.hasEarlyDischarge) flags.push('ED');
    if (effectiveRevivable) flags.push('RV');
    return {
      hasEarlyDischarge: Boolean(meta.hasEarlyDischarge),
      isRevivable: effectiveRevivable,
      reviveSetting,
      flags,
      label: flags.join('/'),
      volatile: flags.length > 0,
    };
  }

  function ensureMemberMetaContainer(memberDiv, userId) {
    if (!memberDiv) return null;
    const marker = String(userId);
    let container = memberDiv.querySelector(`:scope > span[data-two-member-meta="${marker}"]`);
    if (container) return container;

    container = document.createElement('span');
    container.dataset.twoMemberMeta = marker;
    container.className = 'two-member-meta';
    container.setAttribute('aria-hidden', 'true');
    memberDiv.appendChild(container);
    return container;
  }

  function ensureAgeBadge(memberDiv, userId) {
    if (!memberDiv) return null;
    const marker = String(userId);
    const container = ensureMemberMetaContainer(memberDiv, userId);
    let badge = container?.querySelector(`span[data-two-age="${marker}"]`)
      || memberDiv.querySelector(`:scope > span[data-two-age="${marker}"]`);
    if (badge) {
      if (container && badge.parentElement !== container) container.appendChild(badge);
      return badge;
    }

    badge = document.createElement('span');
    badge.dataset.twoAge = marker;
    badge.className = 'two-age-badge two-loading';
    badge.textContent = '...y';
    badge.title = 'Torn account age';
    container?.appendChild(badge);
    return badge;
  }

  function ensureActivityBadge(memberDiv, userId) {
    if (!memberDiv) return null;
    const marker = String(userId);
    const container = ensureMemberMetaContainer(memberDiv, userId);
    let badge = container?.querySelector(`span[data-two-activity="${marker}"]`);
    if (badge) return badge;

    badge = document.createElement('span');
    badge.dataset.twoActivity = marker;
    badge.className = 'two-activity-badge';
    badge.textContent = 'ACT ?';
    badge.title = 'Last activity';
    container?.prepend(badge);
    return badge;
  }

  function ensureHospitalBadge(statusDiv, userId) {
    if (!statusDiv) return null;
    const marker = String(userId);
    statusDiv.dataset.twoUserId = marker;
    let badge = statusDiv.querySelector(`:scope > span[data-two-hosp="${marker}"]`);
    if (badge) return badge;

    badge = document.createElement('span');
    badge.dataset.twoHosp = marker;
    badge.className = 'two-hosp-badge';
    badge.hidden = true;
    badge.title = 'Hospital time remaining';
    statusDiv.appendChild(badge);
    return badge;
  }

  function ensureAttackHistoryBadge(memberDiv, userId) {
    if (!memberDiv) return null;
    const marker = String(userId);
    const container = ensureMemberMetaContainer(memberDiv, userId);
    let badge = container?.querySelector(`span[data-two-attack-history="${marker}"]`);
    if (badge) return badge;

    badge = document.createElement('span');
    badge.dataset.twoAttackHistory = marker;
    badge.className = 'two-attack-history';
    badge.hidden = true;
    badge.title = 'Recent outgoing attack results against this player';
    container?.appendChild(badge);
    return badge;
  }




  function classifyAttackResult(result) {
    const normalized = String(result || '').trim();
    if (['Attacked', 'Mugged', 'Hospitalized', 'Arrested', 'Looted', 'Special', 'Bounty'].includes(normalized)) {
      return { kind: 'win', short: 'W', title: 'Won' };
    }
    if (normalized === 'Lost') return { kind: 'loss', short: 'L', title: 'Lost' };
    return { kind: 'stalemate', short: 'S', title: normalized || 'Stalemate' };
  }

  function formatRelativeAgeFromNow(timestampSec) {
    const value = Number(timestampSec);
    if (!Number.isFinite(value) || value <= 0) return null;
    const delta = Math.max(0, Math.floor(serverNowSec() - value));
    if (delta < 60) return `${delta}s ago`;
    if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
    if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
    return `${Math.floor(delta / 86400)}d ago`;
  }

  function getAttackHistory(userId) {
    return attackHistoryByUser.get(userId) || [];
  }

  function renderAttackHistoryBadge(badge, userId) {
    if (!badge) return;
    const history = getAttackHistory(userId).slice(0, ATTACK_RESULTS_LIMIT);
    const scopeLabel = attackHistoryScope?.mode === 'war' ? 'this ranked war' : 'the recent fallback window';
    const signature = `${attackHistoryScope?.key || 'none'}|${history.map(item => `${item.kind}:${item.result}:${item.ended}`).join('|')}`;
    if (badge.dataset.twoSignature === signature) return;
    badge.dataset.twoSignature = signature;
    badge.replaceChildren();
    badge.hidden = history.length === 0;
    if (history.length === 0) {
      badge.title = attackHistoryFeatureState === 'unsupported'
        ? 'Recent attack-result dots require a Limited Torn API key. The main overlay still works with a Public key.'
        : 'No recent outgoing attack results stored for this player.';
      return;
    }

    const titleParts = [];
    history.forEach((item, index) => {
      const dot = document.createElement('span');
      dot.className = `two-attack-dot two-attack-${item.kind}`;
      dot.setAttribute('aria-hidden', 'true');
      badge.appendChild(dot);
      const when = formatRelativeAgeFromNow(item.ended) || 'time unknown';
      titleParts.push(`#${index + 1} ${item.title} (${item.result}) ${when}`);
    });
    badge.title = `Last ${history.length} outgoing attack result${history.length === 1 ? '' : 's'} vs this player in ${scopeLabel}: ${titleParts.join(' | ')}`;
  }

  // ---------------------------------------------------------------------------
  // Personal tactical intelligence (v0.14)
  //
  // Everything here is derived from the user's own outgoing attack records plus two cheap
  // context calls (own battle stats, own chain). Nothing is sent anywhere except api.torn.com.
  // Torn's respect model (Chain wiki, post April 2024):
  //   respect = base(level) x war(2) x fairFight(1..3) x chainScale x type(leave/hosp 1, mug 0.75) x ...
  //   base(level) = floor((1 + level/200) * 100) / 100
  //   chainScale(hit) = hit <= 10 ? 1 : 0.25*log10(hit) + 0.75
  //   fairFight = min(3, 1 + 8/3 * defenderScore / attackerScore), score = sum(round(sqrt(stat)))
  // Fair Fight is a pure function of both players' battle-stat scores, so an observed value can
  // be inverted into an opponent score and re-projected after the user's own stats change.
  // ---------------------------------------------------------------------------

  function loadOpponentIntel() {
    const stored = loadObjectJson(OPPONENT_INTEL_STORAGE, {});
    const opponents = stored.opponents && typeof stored.opponents === 'object' && !Array.isArray(stored.opponents) ? stored.opponents : {};
    return { v: 1, updatedAt: Number(stored.updatedAt) || 0, opponents, seen: Array.isArray(stored.seen) ? stored.seen : [] };
  }

  function pruneOpponentIntel() {
    const now = Date.now();
    const entries = Object.entries(opponentIntel.opponents || {})
      .filter(([, record]) => record && Number.isFinite(Number(record.u)) && now - Number(record.u) <= INTEL_RETENTION_MS)
      .sort((a, b) => Number(b[1].u) - Number(a[1].u))
      .slice(0, INTEL_MAX_OPPONENTS);
    opponentIntel.opponents = Object.fromEntries(entries);
    if (processedAttackIds.size > INTEL_SEEN_IDS_MAX) {
      // Pages are processed newest-first, so insertion order is not chronological. Keep the highest ids: those are
      // the ones the cursor overlap window will re-fetch and must recognise.
      const keep = Array.from(processedAttackIds).sort((a, b) => a - b).slice(-INTEL_SEEN_IDS_MAX);
      processedAttackIds.clear();
      for (const id of keep) processedAttackIds.add(id);
    }
    opponentIntel.seen = Array.from(processedAttackIds);
  }

  function flushOpponentIntel() {
    if (intelSaveTimer) clearTimeout(intelSaveTimer);
    intelSaveTimer = null;
    pruneOpponentIntel();
    opponentIntel.updatedAt = Date.now();
    saveJson(OPPONENT_INTEL_STORAGE, opponentIntel);
  }

  function scheduleOpponentIntelSave() {
    if (intelSaveTimer) return;
    intelSaveTimer = setTimeout(() => {
      intelSaveTimer = null;
      flushOpponentIntel();
    }, INTEL_SAVE_DEBOUNCE_MS);
  }

  function baseRespectForLevel(level) {
    const value = Number(level);
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.floor((1 + value / 200) * 100 + 1e-9) / 100;
  }

  function chainScaleForHit(hitNumber) {
    const hit = Number(hitNumber);
    if (!Number.isFinite(hit) || hit <= 10) return 1;
    return 0.25 * Math.log10(hit) + 0.75;
  }

  function isChainBonusHit(hitNumber) {
    return CHAIN_BONUS_HITS.includes(Number(hitNumber));
  }

  function battleStatScore(strength, defense, speed, dexterity) {
    const parts = [strength, defense, speed, dexterity].map(Number);
    if (parts.some(value => !Number.isFinite(value) || value < 0)) return null;
    return parts.reduce((sum, value) => sum + Math.round(Math.sqrt(value)), 0);
  }

  function fairFightFromScores(defenderScore, attackerScore) {
    const defender = Number(defenderScore);
    const attacker = Number(attackerScore);
    if (!Number.isFinite(defender) || !Number.isFinite(attacker) || attacker <= 0 || defender < 0) return null;
    return Math.min(FAIR_FIGHT_CAP, Math.round((1 + (8 / 3) * (defender / attacker)) * 100) / 100);
  }

  function defenderScoreFromFairFight(fairFight, attackerScore) {
    const ff = Number(fairFight);
    const attacker = Number(attackerScore);
    if (!Number.isFinite(ff) || !Number.isFinite(attacker) || attacker <= 0 || ff < 1) return null;
    return (3 / 8) * (ff - 1) * attacker;
  }

  function getOwnBss() {
    const bss = Number(selfIntel?.bss);
    return Number.isFinite(bss) && bss > 0 ? bss : null;
  }

  async function refreshSelfStats({ force = false } = {}) {
    if (!intelEnabled() || !apiKey) return getOwnBss();
    if (selfStatsInFlight) return selfStatsInFlight;
    const cachedAt = Number(selfIntel?.updatedAt) || 0;
    if (!force && Date.now() - cachedAt < SELF_STATS_REFRESH_MS) return getOwnBss();
    if (!force && Date.now() - selfStatsLastFetchedAt < 5 * 60_000) return getOwnBss();
    selfStatsLastFetchedAt = Date.now();

    const flight = (async () => {
      try {
        const info = await ensureAttackKeyInfo();
        if (!keyInfoAllowsUserSelection(info, 'battlestats')) return getOwnBss();
        const data = await apiGet('/user/battlestats', { keyOverride: attackApiKey || null });
        const stats = data?.battlestats;
        const bss = battleStatScore(stats?.strength?.value, stats?.defense?.value, stats?.speed?.value, stats?.dexterity?.value);
        if (bss === null) return getOwnBss();
        selfIntel.bss = bss;
        selfIntel.updatedAt = Date.now();
        saveJson(SELF_INTEL_STORAGE, selfIntel);
        incStat('selfStatsRefreshes');
        return bss;
      } catch (err) {
        if (err?.message !== 'API backoff active.') {
          console.warn(`[${SCRIPT}] Could not refresh own battle stats; Fair Fight memory will use observed values only.`, err);
        }
        return getOwnBss();
      }
    })().finally(() => {
      if (selfStatsInFlight === flight) selfStatsInFlight = null;
    });

    selfStatsInFlight = flight;
    return flight;
  }

  async function refreshOwnChain({ force = false } = {}) {
    if (!intelEnabled() || !apiKey || apiPermanentlyDisabled || ownChainUnsupported) return ownChain;
    if (!force && Date.now() - ownChainLastFetchedAt < CHAIN_REFRESH_MS - 1_000) return ownChain;
    if (Date.now() < globalBackoffUntil) return ownChain;
    ownChainLastFetchedAt = Date.now();
    try {
      const data = await apiGet('/faction/chain', { cacheBust: true });
      const chain = data?.chain;
      const current = Number(chain?.current);
      ownChain = {
        current: Number.isFinite(current) && current > 0 ? current : 0,
        timeout: Math.max(0, Number(chain?.timeout) || 0),
        cooldown: Math.max(0, Number(chain?.cooldown) || 0),
        max: Math.max(0, Number(chain?.max) || 0),
        fetchedAtPerf: monotonicNowMs(),
      };
      incStat('chainRefreshes');
    } catch (err) {
      if (Number(err?.code) === 7 || Number(err?.code) === 16 || (err && !err.retryable && err.message !== 'API backoff active.')) {
        ownChainUnsupported = true;
        ownChain = null;
        console.warn(`[${SCRIPT}] Own chain unavailable for this key; chain scale defaults to 1.0.`, err);
      } else if (err?.message !== 'API backoff active.') {
        console.warn(`[${SCRIPT}] Could not refresh own chain; chain scale defaults to 1.0.`, err);
      }
    }
    return ownChain;
  }

  function getChainSnapshot() {
    if (!ownChain) return null;
    const elapsed = Math.max(0, Math.floor((monotonicNowMs() - ownChain.fetchedAtPerf) / 1000));
    const timeoutLeft = ownChain.timeout > 0 ? Math.max(0, ownChain.timeout - elapsed) : 0;
    const active = ownChain.current > 0 && timeoutLeft > 0;
    const nextHit = active ? ownChain.current + 1 : 1;
    return {
      active,
      current: active ? ownChain.current : 0,
      timeoutLeft,
      nextHit,
      bonusNext: active && isChainBonusHit(nextHit),
      staleSec: elapsed,
    };
  }

  function normalizeAttack(attack) {
    const id = Number(attack?.id);
    const started = Number(attack?.started);
    const endedRaw = Number(attack?.ended);
    const defenderId = Number(attack?.defender?.id);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(defenderId) || defenderId <= 0) return null;
    const ff = Number(attack?.modifiers?.fair_fight);
    const warMod = Number(attack?.modifiers?.war);
    const chainRaw = attack?.chain;
    const chain = chainRaw === null || chainRaw === undefined ? null : Number(chainRaw);
    const respect = Number(attack?.respect_gain);
    const defenderLevel = Number(attack?.defender?.level);
    const defenderFactionId = Number(attack?.defender?.faction?.id);
    return {
      id,
      started: Number.isFinite(started) && started > 0 ? started : 0,
      ended: Number.isFinite(endedRaw) && endedRaw > 0 ? endedRaw : (Number.isFinite(started) ? started : 0),
      defenderId,
      defenderFactionId: Number.isFinite(defenderFactionId) && defenderFactionId > 0 ? defenderFactionId : null,
      defenderLevel: Number.isFinite(defenderLevel) && defenderLevel > 0 ? defenderLevel : null,
      result: String(attack?.result || ''),
      outcome: classifyAttackResult(attack?.result),
      respect: Number.isFinite(respect) && respect >= 0 ? respect : null,
      ff: Number.isFinite(ff) && ff > 0 ? ff : null,
      warMod: Number.isFinite(warMod) && warMod > 0 ? warMod : null,
      chain: Number.isFinite(chain) && chain > 0 ? chain : null,
      isRankedWar: Boolean(attack?.is_ranked_war),
      isInterrupted: Boolean(attack?.is_interrupted),
    };
  }

  function recordAttackIntel(attack) {
    if (!attack || processedAttackIds.has(attack.id)) {
      incStat('intelAttacksSkipped');
      return false;
    }
    processedAttackIds.add(attack.id);

    const key = String(attack.defenderId);
    const existing = opponentIntel.opponents[key];
    const record = existing && typeof existing === 'object'
      ? existing
      : { u: 0, w: 0, l: 0, n: 0, rw: 0, r: [], ff: null, ffAt: 0, bss: null, bssAt: 0, bssCap: false, lvl: null };
    if (!Array.isArray(record.r)) record.r = [];

    const nowMs = Date.now();
    const kind = attack.outcome.kind;
    if (kind === 'win') record.w = (Number(record.w) || 0) + 1;
    else if (kind === 'loss') record.l = (Number(record.l) || 0) + 1;
    else record.n = (Number(record.n) || 0) + 1;
    if (attack.isRankedWar) record.rw = (Number(record.rw) || 0) + 1;
    record.u = nowMs;
    if (attack.defenderLevel) record.lvl = attack.defenderLevel;

    if (attack.ff !== null && attack.ended > 0) {
      if (!record.ffAt || attack.ended >= Number(record.ffAt)) {
        record.ff = attack.ff;
        record.ffAt = attack.ended;
      }
      const ownBss = getOwnBss();
      const ageMs = nowMs - attack.ended * 1000;
      if (ownBss && ageMs <= INTEL_FF_MAX_AGE_MS && (!record.bssAt || attack.ended >= Number(record.bssAt))) {
        const estimate = defenderScoreFromFairFight(attack.ff, ownBss);
        if (estimate !== null) {
          record.bss = estimate;
          record.bssAt = attack.ended;
          record.bssCap = attack.ff >= FAIR_FIGHT_CAP - 1e-9;
        }
      }
    }

    record.r.push({ t: attack.ended, k: kind, s: attack.respect, f: attack.ff, c: attack.chain, w: attack.warMod, rw: attack.isRankedWar ? 1 : 0 });
    record.r.sort((a, b) => Number(b?.t || 0) - Number(a?.t || 0));
    if (record.r.length > INTEL_RECENT_SAMPLES) record.r.length = INTEL_RECENT_SAMPLES;

    opponentIntel.opponents[key] = record;
    incStat('intelAttacksProcessed');
    scheduleOpponentIntelSave();
    return true;
  }

  function getOpponentIntel(userId) {
    const record = opponentIntel.opponents?.[String(userId)] || null;
    const level = getBestLevelForUser(userId);
    return deriveOpponentIntel(record, {
      level: Number.isFinite(level) ? level : null,
      ownBss: getOwnBss(),
      chainSnapshot: getChainSnapshot(),
      nowMs: Date.now(),
    });
  }

  // Pure derivation so the model can be self-tested without touching the persistent store.
  function deriveOpponentIntel(record, { level = null, ownBss = null, chainSnapshot = null, nowMs = Date.now() } = {}) {
    const samples = (Array.isArray(record?.r) ? record.r : [])
      .filter(sample => sample && Number.isFinite(Number(sample.t)) && nowMs - Number(sample.t) * 1000 <= INTEL_SAMPLE_MAX_AGE_MS);
    const decisive = samples.filter(sample => sample.k === 'win' || sample.k === 'loss');
    const wins = decisive.filter(sample => sample.k === 'win').length;
    const losses = decisive.length - wins;
    const lifetimeWins = Number(record?.w) || 0;
    const lifetimeLosses = Number(record?.l) || 0;

    // Expected Fair Fight today: prefer the re-projected score model, fall back to the last raw observation.
    let ff = null;
    let ffSource = 'none';
    let ffCapped = false;
    if (record?.bss && ownBss) {
      ff = fairFightFromScores(record.bss, ownBss);
      ffSource = 'model';
      ffCapped = Boolean(record.bssCap);
    } else if (Number.isFinite(Number(record?.ff)) && record.ffAt && nowMs - Number(record.ffAt) * 1000 <= INTEL_FF_MAX_AGE_MS) {
      ff = Number(record.ff);
      ffSource = 'observed';
      ffCapped = ff >= FAIR_FIGHT_CAP - 1e-9;
    }
    if (ff !== null && ffCapped) ff = FAIR_FIGHT_CAP; // A capped observation is only a lower bound on opponent strength.

    // Smoothed personal win probability. The prior leans on Fair Fight: a capped FF means the opponent is at least 75% of our score.
    const priorMean = ff === null ? 0.6 : ffCapped ? 0.45 : ff >= 2.5 ? 0.7 : 0.88;
    const priorWeight = 2;
    const winProb = (wins + priorWeight * priorMean) / (decisive.length + priorWeight);

    // CHANGED = the two latest fights are losses but the history *before* them was reliably won.
    const lastTwoLosses = decisive.length >= 2 && decisive[0].k === 'loss' && decisive[1].k === 'loss';
    const priorLosses = Math.max(0, lifetimeLosses - (lastTwoLosses ? 2 : 0));
    const priorTotal = lifetimeWins + priorLosses;
    const historicalRate = priorTotal > 0 ? lifetimeWins / priorTotal : null;
    let label = 'UNKNOWN';
    if (lastTwoLosses && priorTotal >= 3 && historicalRate >= 0.75) label = 'CHANGED';
    else if (decisive.length > 0 && (decisive[0].k === 'loss' || losses * 3 > wins)) label = 'RISK';
    else if (decisive.length >= 3 && losses === 0) label = 'PROVEN';
    else if (wins >= 1) label = 'LIKELY';
    else if (ff !== null) label = ffCapped ? 'RISK' : ff <= 2.5 ? 'LIKELY' : 'UNKNOWN';

    // Expected ranked-war score for a Leave/Hospitalize hit at the next chain position.
    const base = baseRespectForLevel(Number.isFinite(Number(level)) && Number(level) > 0 ? Number(level) : record?.lvl);
    const nextHit = chainSnapshot?.nextHit || 1;
    const chainScale = chainScaleForHit(nextHit);
    let expectedScore = null;
    let scoreSource = 'none';
    if (base !== null && ff !== null) {
      expectedScore = base * WAR_RESPECT_MULTIPLIER * ff * chainScale;
      scoreSource = 'model';
    } else {
      const observed = samples
        .filter(sample => sample.k === 'win' && sample.rw && Number.isFinite(Number(sample.s)) && Number(sample.s) > 0)
        .map(sample => Number(sample.s))
        .sort((a, b) => a - b);
      if (observed.length > 0) {
        expectedScore = observed[Math.floor(observed.length / 2)];
        scoreSource = 'observed';
      }
    }
    const ev = expectedScore !== null ? winProb * expectedScore : null;

    return {
      hasRecord: Boolean(record),
      samples: decisive.length,
      wins,
      losses,
      lifetimeWins,
      lifetimeLosses,
      lastResultAt: decisive.length > 0 ? Number(decisive[0].t) : null,
      ff,
      ffSource,
      ffCapped,
      winProb,
      label,
      expectedScore,
      scoreSource,
      ev,
      chainScale,
      nextHit,
      ownBssKnown: Boolean(ownBss),
      ffLabel: ff === null ? '' : ffCapped ? 'FF3.0+' : `FF${ff.toFixed(2)}`,
      evLabel: ev === null ? '' : `EV${ev.toFixed(1)}`,
    };
  }

  function computeBestTarget() {
    const previous = bestTargetUserId;
    bestTargetUserId = null;
    bestTargetReason = '';
    if (!intelEnabled() || attackHistoryFeatureState === 'unsupported' || !isLiveStatusTrusted()) {
      return { changed: previous !== null, previous, current: null };
    }
    const chainSnapshot = getChainSnapshot();
    const bonusNext = Boolean(chainSnapshot?.bonusNext);
    let best = null;
    for (const userId of rowsByUser.keys()) {
      const target = getTargetState(userId);
      if (!target.ideal) continue;
      const intel = getOpponentIntel(userId);
      if (intel.ev === null || !(intel.label === 'PROVEN' || intel.label === 'LIKELY')) continue;
      // During a bonus hit the priority is securing it, so rank by win confidence first.
      const rank = bonusNext ? [intel.winProb, intel.ev] : [intel.ev, intel.winProb];
      const better = !best
        || rank[0] > best.rank[0] + 1e-9
        || (Math.abs(rank[0] - best.rank[0]) <= 1e-9 && rank[1] > best.rank[1]);
      if (better) best = { userId, rank, intel };
    }
    if (best) {
      bestTargetUserId = best.userId;
      bestTargetReason = bonusNext
        ? `chain bonus hit #${chainSnapshot.nextHit} is next: safest proven green target`
        : 'highest expected ranked-war score per 25 energy among green targets';
      if (previous !== best.userId) incStat('bestRecommendations');
    }
    return { changed: previous !== bestTargetUserId, previous, current: bestTargetUserId };
  }

  function ensureIntelBadge(memberDiv, userId) {
    if (!memberDiv) return null;
    const marker = String(userId);
    const container = ensureMemberMetaContainer(memberDiv, userId);
    let badge = container?.querySelector(`span[data-two-intel="${marker}"]`);
    if (badge) return badge;

    badge = document.createElement('span');
    badge.dataset.twoIntel = marker;
    badge.className = 'two-intel-badge';
    badge.hidden = true;
    badge.title = 'Personal intel';
    container?.appendChild(badge);
    return badge;
  }

  function describeIntel(intel, userId) {
    const lines = [];
    if (bestTargetUserId === userId) lines.push(`BEST: ${bestTargetReason}`);
    lines.push(`Confidence: ${intel.label}`);
    if (intel.samples > 0) {
      lines.push(`Recent record: ${intel.wins}-${intel.losses} (${intel.samples} decisive fights in the last 180 days${intel.lastResultAt ? `, last ${formatRelativeAgeFromNow(intel.lastResultAt)}` : ''})`);
    } else {
      lines.push('No decisive personal fights recorded yet');
    }
    if (intel.lifetimeWins + intel.lifetimeLosses > intel.samples) lines.push(`Lifetime record: ${intel.lifetimeWins}-${intel.lifetimeLosses}`);
    if (intel.ff !== null) {
      lines.push(intel.ffCapped
        ? 'Fair Fight: 3.00 (capped: opponent is at least 75% of your battle-stat score)'
        : `Fair Fight: ${intel.ff.toFixed(2)} (${intel.ffSource === 'model' ? 'projected from an observed fight and your current stats' : 'last observed value'})`);
    } else {
      lines.push('Fair Fight: unknown until you fight this player once');
    }
    lines.push(`Win probability: ${(intel.winProb * 100).toFixed(0)}% (smoothed)`);
    if (intel.expectedScore !== null) {
      lines.push(intel.scoreSource === 'model'
        ? `Expected score if you win: ${intel.expectedScore.toFixed(2)} (level base x2 war x FF x chain scale ${intel.chainScale.toFixed(2)} at hit #${intel.nextHit})`
        : `Expected score if you win: ${intel.expectedScore.toFixed(2)} (median of your ranked-war wins vs this player)`);
      lines.push(`Expected value per 25 energy: ${intel.ev.toFixed(2)}`);
    }
    if (!intel.ownBssKnown) lines.push('Own battle stats unavailable to this key; Fair Fight cannot be re-projected as your stats grow');
    return lines.join(' | ');
  }

  function renderIntelBadge(badge, userId, target) {
    if (!badge) return;
    const enabled = intelEnabled() && attackHistoryFeatureState !== 'unsupported';
    const intel = enabled ? getOpponentIntel(userId) : null;
    const isBest = enabled && bestTargetUserId === userId;
    const text = !intel ? '' : isBest
      ? `★ ${intel.evLabel || intel.ffLabel}`
      : intel.evLabel || intel.ffLabel || (intel.label !== 'UNKNOWN' ? intel.label : '');
    const signature = `${text}|${intel?.label || ''}|${intel ? `${intel.wins}-${intel.losses}:${intel.nextHit}:${intel.ffSource}` : ''}|${isBest ? 1 : 0}|${target?.ideal ? 1 : 0}|${target?.good ? 1 : 0}`;
    if (badge.dataset.twoSignature === signature) return;
    badge.dataset.twoSignature = signature;
    badge.hidden = text === '';
    badge.textContent = text;
    badge.className = `two-intel-badge two-intel-${String(intel?.label || 'unknown').toLowerCase()}${isBest ? ' two-intel-best' : ''}`;
    badge.title = intel ? describeIntel(intel, userId) : 'Personal intel';
  }


  function ensureTargetToolbar(list) {
    if (!list) return null;
    const existing = list.__twoTargetToolbar;
    if (existing?.isConnected) return existing;

    const toolbar = document.createElement('div');
    toolbar.className = 'two-target-toolbar';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Torn War Overlay controls');

    const modeGroup = document.createElement('div');
    modeGroup.className = 'two-mode-group';

    function makeButton(text, title, onClick) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'two-mode-btn';
      button.dataset.twoMode = String(text).toLowerCase();
      button.textContent = text;
      button.title = title;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      });
      return button;
    }

    const allButton = makeButton('ALL', 'Show all faction members', () => { filterMode = 'all'; renderAll(); });
    const targetButton = makeButton('TARGETS', 'Show only green and yellow targets', () => { filterMode = 'targets'; renderAll(); });
    const settingsButton = makeButton('SET', 'Configure target rules', openSettingsDialog);
    modeGroup.append(allButton, targetButton, settingsButton);

    const historyKeyButton = document.createElement('button');
    historyKeyButton.type = 'button';
    historyKeyButton.className = 'two-history-key-btn';
    historyKeyButton.textContent = 'HIST KEY';
    historyKeyButton.hidden = true;
    historyKeyButton.title = 'Personal intel (attack dots, Fair Fight memory, expected score) needs a Limited or Custom user -> attacks key';
    historyKeyButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      setAttackApiKey();
    });

    const warChip = document.createElement('span');
    warChip.className = 'two-context-chip two-war-chip';
    warChip.hidden = true;
    warChip.title = 'Ranked war score';

    const chainChip = document.createElement('span');
    chainChip.className = 'two-context-chip two-chain-chip';
    chainChip.hidden = true;
    chainChip.title = 'Your faction chain';

    const sync = document.createElement('span');
    sync.className = 'two-sync-indicator two-syncing';
    sync.textContent = 'SYNC';
    sync.title = 'Waiting for a fresh Torn API faction snapshot';

    const counter = document.createElement('div');
    counter.className = 'two-target-counter';
    counter.title = 'Current targets under the active configuration';

    const greenItem = document.createElement('span');
    greenItem.className = 'two-counter-item';
    const greenDot = document.createElement('span');
    greenDot.className = 'two-counter-dot two-counter-green';
    const greenCount = document.createElement('span');
    greenCount.className = 'two-counter-number';
    greenCount.textContent = '0';
    greenItem.append(greenDot, greenCount);

    const yellowItem = document.createElement('span');
    yellowItem.className = 'two-counter-item';
    const yellowDot = document.createElement('span');
    yellowDot.className = 'two-counter-dot two-counter-yellow';
    const yellowCount = document.createElement('span');
    yellowCount.className = 'two-counter-number';
    yellowCount.textContent = '0';
    yellowItem.append(yellowDot, yellowCount);

    counter.append(greenItem, yellowItem);

    const right = document.createElement('div');
    right.className = 'two-toolbar-right';
    right.append(historyKeyButton, warChip, chainChip, sync, counter);
    toolbar.append(modeGroup, right);

    toolbar.__twoWarChip = warChip;
    toolbar.__twoChainChip = chainChip;
    toolbar.__twoAllButton = allButton;
    toolbar.__twoTargetButton = targetButton;
    toolbar.__twoSettingsButton = settingsButton;
    toolbar.__twoGreenCount = greenCount;
    toolbar.__twoYellowCount = yellowCount;
    toolbar.__twoHistoryKeyButton = historyKeyButton;
    toolbar.__twoSync = sync;
    toolbar.__twoList = list;
    list.__twoTargetToolbar = toolbar;

    list.before(toolbar);
    return toolbar;
  }

  function isLiveStatusTrusted() {
    return factionLiveReady
      && lastFreshSnapshotPerfAt > 0
      && (monotonicNowMs() - lastFreshSnapshotPerfAt) <= STATUS_TRUST_MAX_AGE_MS;
  }

  function getDomOkayOverride(userId) {
    const override = domStatusOverrideByUser.get(userId);
    if (!override || override.state !== 'okay') return null;
    if (!isActiveView() || Date.now() - override.observedAt > DOM_OKAY_OVERRIDE_TTL_MS) {
      domStatusOverrideByUser.delete(userId);
      return null;
    }
    return override;
  }

  function getEffectiveStatus(userId) {
    const apiStatus = statusByUser.get(userId) || null;
    const rawState = String(apiStatus?.state ?? '').toLowerCase();
    const domOverride = rawState === 'hospital' ? getDomOkayOverride(userId) : null;
    if (domOverride) {
      return {
        status: { ...(apiStatus || {}), state: 'Okay' },
        rawState,
        state: 'okay',
        domConfirmedOkay: true,
        domObservedAt: domOverride.observedAt,
      };
    }
    return {
      status: apiStatus,
      rawState,
      state: rawState,
      domConfirmedOkay: false,
      domObservedAt: null,
    };
  }

  function getTargetState(userId, ageInfo = null) {
    const effective = getEffectiveStatus(userId);
    const status = effective.status;
    const apiStatus = statusByUser.get(userId);
    const activityInfo = getActivityInfo(userId);
    const rawUntil = getStatusUntil(apiStatus);
    const secondsLeft = rawUntil !== null ? Math.ceil(rawUntil - serverNowSec()) : null;

    const hasActivityData = ['online', 'idle', 'offline'].includes(activityInfo.status);
    const activityEligible = hasActivityData && (activityInfo.status === 'offline' || (allowIdleTargets() && activityInfo.status === 'idle'));
    const notOnline = activityEligible;
    const isOkay = effective.state === 'okay';
    const isHospital = effective.state === 'hospital';
    const rawIsHospital = effective.rawState === 'hospital';
    const isDue = rawIsHospital && !effective.domConfirmedOkay && Number.isFinite(secondsLeft) && secondsLeft <= 0;
    const leavingHospitalSoon = rawIsHospital
      && !effective.domConfirmedOkay
      && Number.isFinite(secondsLeft)
      && secondsLeft > 0
      && secondsLeft <= configuredGreenHospitalSec();
    const hospitalWatchWindow = rawIsHospital
      && !effective.domConfirmedOkay
      && Number.isFinite(secondsLeft)
      && secondsLeft > configuredGreenHospitalSec()
      && secondsLeft <= configuredYellowHospitalSec();

    const attackWindow = isOkay || isDue || leavingHospitalSoon;
    const resolvedAge = ageInfo ?? getAgeInfo(userId);
    const ageEligible = Boolean(resolvedAge?.eligible);

    // Cached or stale API status may render context but can never create a target.
    // Focused-page DOM evidence can refine a fresh API snapshot, but never replaces the freshness requirement.
    const statusTrusted = isLiveStatusTrusted();
    const level = getBestLevelForUser(userId);
    const maxLevel = configuredMaxLevel();
    const levelEligible = maxLevel === null || !Number.isFinite(level) || level <= maxLevel;
    const ideal = statusTrusted && ageEligible && notOnline && levelEligible && attackWindow;
    const good = statusTrusted && ageEligible && notOnline && levelEligible && hospitalWatchWindow;

    let availabilityKind = 'other';
    let availabilityLabel = '';
    if (isOkay) {
      availabilityKind = 'ready';
      availabilityLabel = 'READY';
    } else if (isDue) {
      availabilityKind = 'due';
      availabilityLabel = 'DUE';
    } else if (leavingHospitalSoon) {
      availabilityKind = 'imminent';
      availabilityLabel = `H ${Math.max(1, secondsLeft)}s`;
    } else if (hospitalWatchWindow) {
      availabilityKind = 'watch';
      availabilityLabel = `H ${Math.max(1, secondsLeft)}s`;
    }

    return {
      state: effective.state,
      rawState: effective.rawState,
      activity: activityInfo.status,
      activityInfo,
      hasActivityData,
      notOnline,
      activityEligible,
      isOkay,
      isHospital,
      rawIsHospital,
      isDue,
      leavingHospitalSoon,
      hospitalWatchWindow,
      attackWindow,
      ageEligible,
      levelEligible,
      ideal,
      good,
      secondsLeft,
      statusTrusted,
      availabilityKind,
      availabilityLabel,
      domConfirmedOkay: effective.domConfirmedOkay,
      risk: getMemberRiskInfo(userId),
    };
  }

  function getTargetCountsForList(list) {
    let green = 0;
    let yellow = 0;
    for (const [userId, rows] of rowsByUser) {
      if (!rows.some(row => row.list === list)) continue;
      const target = getTargetState(userId);
      if (target.ideal) green += 1;
      else if (target.good) yellow += 1;
    }
    return { green, yellow };
  }



  function syncIndicatorText() {
    if (selfTestFaults.length > 0) return { text: 'QA ERR', className: 'two-error', title: `Internal self-test failed: ${selfTestFaults.join(', ')}` };
    if (apiPermanentlyDisabled || apiHealth === 'key') return { text: 'KEY', className: 'two-key', title: apiHealthDetail || 'API key error' };

    if (Date.now() < globalBackoffUntil) {
      const seconds = Math.max(1, Math.ceil((globalBackoffUntil - Date.now()) / 1000));
      if (apiHealth === 'rate') return { text: `RATE ${seconds}s`, className: 'two-rate', title: 'Torn API rate limit; automatic backoff active' };
      if (apiHealth === 'blocked') return { text: 'IP WAIT', className: 'two-error', title: `${apiHealthDetail || 'Torn API IP block'}; conservative backoff active` };
      return { text: `WAIT ${seconds}s`, className: 'two-error', title: apiHealthDetail || 'Temporary Torn API backoff' };
    }

    if (!factionLiveReady || apiHealth === 'syncing') return { text: 'SYNC', className: 'two-syncing', title: 'Waiting for a fresh Torn API faction snapshot' };
    if (apiHealth === 'down') return { text: 'API DOWN', className: 'two-error', title: apiHealthDetail || 'Torn API unavailable' };
    if (apiHealth === 'error') return { text: 'API ERR', className: 'two-error', title: apiHealthDetail || 'Torn API error' };

    const ageSec = Math.max(0, Math.floor((monotonicNowMs() - lastFreshSnapshotPerfAt) / 1000));
    if (!isLiveStatusTrusted()) {
      return { text: `STALE ${ageSec}s`, className: 'two-rate', title: `Last faction snapshot is ${ageSec}s old; target highlighting is suspended until fresh data arrives` };
    }
    return { text: `LIVE ${ageSec}s`, className: 'two-live', title: `Fresh faction snapshot received ${ageSec}s ago` };
  }

  function updateTargetToolbars() {
    const lists = new Set();
    for (const rows of rowsByUser.values()) {
      for (const row of rows) if (row.list?.isConnected) lists.add(row.list);
    }

    const indicator = syncIndicatorText();
    for (const list of lists) {
      const toolbar = ensureTargetToolbar(list);
      if (!toolbar) continue;

      const { green, yellow } = getTargetCountsForList(list);
      toolbar.__twoGreenCount.textContent = String(green);
      toolbar.__twoYellowCount.textContent = String(yellow);
      toolbar.__twoAllButton.classList.toggle('two-active', filterMode === 'all');
      toolbar.__twoTargetButton.classList.toggle('two-active', filterMode === 'targets');
      toolbar.__twoAllButton.setAttribute('aria-pressed', String(filterMode === 'all'));
      toolbar.__twoTargetButton.setAttribute('aria-pressed', String(filterMode === 'targets'));
      toolbar.classList.toggle('two-targets-mode', filterMode === 'targets');

      const historyKeyButton = toolbar.__twoHistoryKeyButton;
      if (historyKeyButton) historyKeyButton.hidden = attackHistoryFeatureState !== 'unsupported';

      renderWarChip(toolbar.__twoWarChip);
      renderChainChip(toolbar.__twoChainChip);

      const sync = toolbar.__twoSync;
      sync.textContent = indicator.text;
      sync.className = `two-sync-indicator ${indicator.className}`;
      sync.title = indicator.title;

    }
  }

  function formatClock(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(value / 60);
    const rest = value % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function getWarDecayInfo(war) {
    const start = Number(war?.start);
    if (!Number.isFinite(start) || start <= 0) return null;
    const now = serverNowSec();
    const decayStartsAt = start + 24 * 3600;
    if (now < decayStartsAt) return { started: false, nextAt: decayStartsAt, secondsToNext: decayStartsAt - now };
    const hoursElapsed = Math.floor((now - decayStartsAt) / 3600);
    const nextAt = decayStartsAt + (hoursElapsed + 1) * 3600;
    return { started: true, nextAt, secondsToNext: nextAt - now };
  }

  function renderWarChip(chip) {
    if (!chip) return;
    const war = currentWar;
    if (!intelEnabled() || !war || !Number.isFinite(Number(war.target)) || !Number.isFinite(Number(war.ownScore)) || !Number.isFinite(Number(war.enemyScore))) {
      if (!chip.hidden) chip.hidden = true;
      return;
    }
    const lead = Number(war.ownScore) - Number(war.enemyScore);
    const target = Number(war.target);
    const text = `WAR ${lead >= 0 ? '+' : ''}${lead} / ${target}`;
    const decay = getWarDecayInfo(war);
    const ageSec = Number.isFinite(Number(war.fetchedAtPerf)) ? Math.max(0, Math.floor((monotonicNowMs() - Number(war.fetchedAtPerf)) / 1000)) : null;
    const remaining = Math.max(0, target - lead);
    const signature = `${text}|${decay?.started ? 1 : 0}|${Math.floor((decay?.secondsToNext || 0) / 60)}|${ageSec === null ? '' : Math.floor(ageSec / 30)}`;
    if (chip.dataset.twoSignature !== signature) {
      chip.dataset.twoSignature = signature;
      chip.hidden = false;
      chip.textContent = text;
      chip.classList.toggle('two-chip-positive', lead > 0);
      chip.classList.toggle('two-chip-negative', lead < 0);
      const lines = [
        `Ranked war: ${war.ownName || 'us'} ${war.ownScore} vs ${war.enemyName || 'them'} ${war.enemyScore}`,
        `Lead ${lead >= 0 ? '+' : ''}${lead}; target ${target}; ${lead >= target ? 'target reached' : `${remaining} more needed`}`,
      ];
      if (decay) {
        lines.push(decay.started
          ? `Target decays 1% of the original per hour; next reduction in ${formatClock(decay.secondsToNext)}`
          : `Target decay starts 24h after war start (in ${formatDurationCompact(decay.secondsToNext)})`);
      }
      if (ageSec !== null) lines.push(`Score refreshed ${ageSec}s ago`);
      chip.title = lines.join(' | ');
    }
  }

  function renderChainChip(chip) {
    if (!chip) return;
    const snapshot = intelEnabled() ? getChainSnapshot() : null;
    if (!snapshot || !snapshot.active) {
      if (!chip.hidden) chip.hidden = true;
      return;
    }
    const text = snapshot.bonusNext
      ? `BONUS #${snapshot.nextHit} ${formatClock(snapshot.timeoutLeft)}`
      : `CHAIN ${snapshot.current} ${formatClock(snapshot.timeoutLeft)}`;
    const urgent = snapshot.timeoutLeft <= 90;
    const signature = `${text}|${urgent ? 1 : 0}`;
    if (chip.dataset.twoSignature === signature) return;
    chip.dataset.twoSignature = signature;
    chip.hidden = false;
    chip.textContent = text;
    chip.classList.toggle('two-chip-bonus', snapshot.bonusNext);
    chip.classList.toggle('two-chip-urgent', urgent);
    chip.title = snapshot.bonusNext
      ? `Your next hit (#${snapshot.nextHit}) is a chain bonus hit. It must land on an enemy to count for the war; BEST switches to the safest proven target. ${formatClock(snapshot.timeoutLeft)} left on the chain timer.`
      : `Your faction chain is at ${snapshot.current} with ${formatClock(snapshot.timeoutLeft)} left. Next hit scales respect by x${chainScaleForHit(snapshot.nextHit).toFixed(2)}.`;
  }

  function getUserRenderSignature(userId, ageInfo, target, activityInfo, rawStatus) {
    const history = getAttackHistory(userId).slice(0, ATTACK_RESULTS_LIMIT)
      .map(item => `${item.kind}:${item.result}:${item.ended}:${item.id}`)
      .join(',');
    const until = getStatusUntil(rawStatus);
    const hospitalSecond = until !== null ? Math.ceil(until - serverNowSec()) : '';
    const intel = intelEnabled() ? getOpponentIntel(userId) : null;
    return [
      filterMode,
      intel ? `${intel.label}:${intel.evLabel}:${intel.ffLabel}:${intel.wins}-${intel.losses}:${intel.nextHit}` : 'nointel',
      bestTargetUserId === userId ? 'best' : '',
      configuredMaxAgeYears(),
      configuredGreenHospitalSec(),
      configuredYellowHospitalSec(),
      configuredMaxLevel() ?? 'none',
      allowIdleTargets() ? 1 : 0,
      ageInfo?.label,
      ageInfo?.hint,
      activityInfo?.label,
      target?.state,
      target?.rawState,
      target?.ideal ? 1 : 0,
      target?.good ? 1 : 0,
      target?.statusTrusted ? 1 : 0,
      target?.domConfirmedOkay ? 1 : 0,
      target?.risk?.label || '',
      hospitalSecond,
      history,
    ].join('|');
  }

  function renderUser(userId) {
    incStat('renderCalls');
    const rows = rowsByUser.get(userId);
    if (!rows) return;

    const ageInfo = getAgeInfo(userId);
    const rawStatus = statusByUser.get(userId);
    const target = getTargetState(userId, ageInfo);
    const activityInfo = target.activityInfo;
    const renderSignature = getUserRenderSignature(userId, ageInfo, target, activityInfo, rawStatus);
    if (lastRenderedSignatureByUser.get(userId) === renderSignature) { incStat('renderSkips'); return; }
    lastRenderedSignatureByUser.set(userId, renderSignature);

    for (const item of rows) {
      const ageBadge = item.ageBadge || ensureAgeBadge(item.memberDiv, userId);
      const activityBadge = item.activityBadge || ensureActivityBadge(item.memberDiv, userId);
      const attackHistoryBadge = item.attackHistoryBadge || ensureAttackHistoryBadge(item.memberDiv, userId);
      const intelBadge = item.intelBadge || ensureIntelBadge(item.memberDiv, userId);
      const hospBadge = item.hospBadge || ensureHospitalBadge(item.statusDiv, userId);

      item.li.classList.toggle('two-young-player', target.ageEligible);
      item.li.classList.toggle('two-best-target', target.ideal && intelEnabled() && bestTargetUserId === userId);
      item.li.classList.toggle('two-ideal-target', target.ideal);
      item.li.classList.toggle('two-good-target', target.good);
      item.li.classList.toggle('two-ideal-soon', target.ideal && (target.leavingHospitalSoon || target.isDue));
      item.li.classList.toggle('two-due-target', target.ideal && target.isDue);
      item.li.classList.toggle('two-dom-ready', target.ideal && target.domConfirmedOkay);
      item.li.classList.toggle('two-target-hidden', filterMode === 'targets' && !target.ideal && !target.good);
      item.li.classList.toggle('two-provisional', !target.statusTrusted);

      if (ageBadge) {
        ageBadge.textContent = ageInfo.label;
        const exactKnown = Number.isFinite(ageInfo.exactYears);
        ageBadge.classList.toggle('two-loading', !exactKnown && !ageInfo.hint);
        ageBadge.classList.toggle('two-estimate', !exactKnown && Boolean(ageInfo.hint));
        ageBadge.classList.toggle('two-candidate', !exactKnown && ageInfo.candidate);
        ageBadge.classList.toggle('two-young', target.ageEligible);
        ageBadge.classList.toggle('two-target', target.ideal);
        ageBadge.classList.toggle('two-good', target.good);

        const stateLabel = target.state || 'status unknown';
        const ageTitle = exactKnown
          ? `${ageInfo.exactYears.toFixed(2)} years (exact signup timestamp)`
          : ageInfo.hint === 'candidate'
            ? `API search found this account inside the <${configuredMaxAgeYears().toFixed(1)}y candidate window; exact profile confirmation is loading`
            : ageInfo.hint === 'old'
              ? `API search classifies this account outside the <${configuredMaxAgeYears().toFixed(1)}y target window; exact age is intentionally not fetched`
            : ageInfo.hint === 'level-excluded'
              ? `Account age was not queried because this player is above the configured maximum level`
              : 'Torn account age: loading';
        const readySource = target.domConfirmedOkay ? ' | READY confirmed from the currently visible Torn page' : '';
        ageBadge.title = `${ageTitle} | ${activityInfo.longLabel} | ${stateLabel}${readySource}${!target.statusTrusted ? ' | API status syncing/stale' : target.ideal ? ` | IDEAL TARGET (${target.availabilityLabel})` : target.good ? ` | GOOD TARGET (${target.availabilityLabel})` : ''}`;
      }

      if (activityBadge) {
        activityBadge.textContent = activityInfo.label;
        activityBadge.classList.toggle('two-activity-online', activityInfo.status === 'online');
        activityBadge.classList.toggle('two-activity-idle', activityInfo.status === 'idle');
        activityBadge.classList.toggle('two-activity-offline', activityInfo.status === 'offline');
        activityBadge.classList.toggle('two-target', target.ideal);
        activityBadge.classList.toggle('two-good', target.good);
        activityBadge.title = activityInfo.longLabel;
      }

      if (attackHistoryBadge) renderAttackHistoryBadge(attackHistoryBadge, userId);
      if (intelBadge) renderIntelBadge(intelBadge, userId, target);

      if (!hospBadge) continue;
      const rawUntil = getStatusUntil(rawStatus);
      if (!target.rawIsHospital || target.domConfirmedOkay || rawUntil === null) {
        hospBadge.hidden = true;
        hospBadge.classList.remove('two-soon', 'two-now', 'two-target-window', 'two-watch-window', 'two-due', 'two-volatile');
        continue;
      }

      const secondsLeft = target.secondsLeft;
      if (!Number.isFinite(secondsLeft)) {
        hospBadge.hidden = true;
        continue;
      }

      const riskLabel = target.risk.label;
      const riskSuffix = riskLabel ? ` ${riskLabel}` : '';
      const displaySeconds = Math.max(0, secondsLeft);
      hospBadge.hidden = false;
      hospBadge.textContent = target.isDue ? `DUE${riskSuffix}` : `${displaySeconds}s${riskSuffix}`;
      hospBadge.classList.toggle('two-soon', target.statusTrusted && !target.isDue && displaySeconds > 10 && displaySeconds <= 60);
      hospBadge.classList.toggle('two-now', target.statusTrusted && (target.isDue || displaySeconds <= 10));
      hospBadge.classList.toggle('two-target-window', target.statusTrusted && (target.isDue || displaySeconds <= configuredGreenHospitalSec()));
      hospBadge.classList.toggle('two-watch-window', target.statusTrusted && !target.isDue && displaySeconds > configuredGreenHospitalSec() && displaySeconds <= configuredYellowHospitalSec());
      hospBadge.classList.toggle('two-due', target.isDue);
      hospBadge.classList.toggle('two-volatile', target.risk.volatile);
      hospBadge.classList.toggle('two-provisional-badge', !target.statusTrusted);

      const riskDetails = [];
      if (target.risk.hasEarlyDischarge) riskDetails.push('ED = eligible for Early Discharge');
      if (target.risk.isRevivable) riskDetails.push('RV = revivable');
      const dueDetails = target.isDue
        ? 'Hospital timer has mathematically expired, but Torn has not yet confirmed Okay.'
        : `Hospital time remaining: ${displaySeconds}s.`;
      hospBadge.title = `${dueDetails}${riskDetails.length ? ` ${riskDetails.join(' | ')}. Timer may end earlier than shown.` : ''}`;
    }
  }

  function flushRenderAll() {
    renderFrame = null;
    if (!fullRenderQueued) return;
    fullRenderQueued = false;
    computeBestTarget();
    for (const userId of rowsByUser.keys()) renderUser(userId);
    lastRenderedTrustState = isLiveStatusTrusted();
    updateTargetToolbars();
  }

  function renderAll() {
    fullRenderQueued = true;
    if (renderFrame !== null) return;
    if (typeof requestAnimationFrame === 'function') {
      renderFrame = requestAnimationFrame(flushRenderAll);
    } else {
      renderFrame = setTimeout(flushRenderAll, 0);
    }
  }

  function pruneDomStatusOverrides() {
    const expired = [];
    const now = Date.now();
    for (const [userId, override] of domStatusOverrideByUser) {
      if (!isActiveView() || now - override.observedAt > DOM_OKAY_OVERRIDE_TTL_MS) {
        domStatusOverrideByUser.delete(userId);
        expired.push(userId);
      }
    }
    return expired;
  }

  function tickCountdowns() {
    const trustedNow = isLiveStatusTrusted();
    if (trustedNow !== lastRenderedTrustState) {
      renderAll();
      return;
    }

    const renderIds = new Set(pruneDomStatusOverrides());

    // Hospital timers can change every second.
    for (const [userId, status] of statusByUser) {
      if (String(status?.state ?? '').toLowerCase() !== 'hospital') continue;
      const until = getStatusUntil(status);
      const seconds = until !== null ? Math.ceil(until - serverNowSec()) : null;
      const displaySignature = Number.isFinite(seconds) ? (seconds <= 0 ? 'DUE' : String(seconds)) : '?';
      const signature = `${displaySignature}|${isLiveStatusTrusted() ? 1 : 0}|${getMemberRiskInfo(userId).label}|${getDomOkayOverride(userId) ? 1 : 0}`;
      if (lastHospitalDisplayByUser.get(userId) === signature) continue;
      lastHospitalDisplayByUser.set(userId, signature);
      renderIds.add(userId);
    }

    // Activity labels only change occasionally, but checking the compact signature is cheap and avoids a separate timer.
    for (const userId of lastActionByUser.keys()) {
      const signature = getActivityInfo(userId).label;
      if (lastActivityDisplayByUser.get(userId) === signature) continue;
      lastActivityDisplayByUser.set(userId, signature);
      renderIds.add(userId);
    }

    // Hospital timers change green eligibility every second, so the BEST recommendation is re-evaluated here too.
    const best = computeBestTarget();
    if (best.changed) {
      if (best.previous !== null) renderIds.add(best.previous);
      if (best.current !== null) renderIds.add(best.current);
    }

    for (const userId of renderIds) renderUser(userId);
    tightenAdaptiveFactionSchedule();
    updateTargetToolbars();
  }

  function stopCountdownTimer() {
    if (countdownTimer) clearTimeout(countdownTimer);
    countdownTimer = null;
  }

  function scheduleCountdownTick() {
    stopCountdownTimer();
    if (!isActiveView()) return;
    // Align updates just after the next Torn-server second boundary.
    const now = serverNowMs();
    const delay = Math.max(80, 1_000 - (now % 1_000) + 25);
    countdownTimer = setTimeout(() => {
      countdownTimer = null;
      if (!isActiveView()) return;
      tickCountdowns();
      scheduleCountdownTick();
    }, delay);
  }

  function detectDomStatusState(statusDiv) {
    if (!statusDiv) return null;
    if (statusDiv.classList?.contains('hospital') || statusDiv.classList?.contains('jail')) return 'hospital';

    const clone = statusDiv.cloneNode(true);
    for (const overlay of clone.querySelectorAll('[data-two-hosp], .two-hosp-badge')) overlay.remove();
    const directText = String(clone.textContent || '').trim();
    if (directText === 'Okay') return 'okay';

    const parts = [directText, clone.getAttribute?.('title') || '', clone.getAttribute?.('aria-label') || '', clone.className || ''];
    for (const element of clone.querySelectorAll('*')) {
      parts.push(
        element.getAttribute?.('title') || '',
        element.getAttribute?.('aria-label') || '',
        typeof element.className === 'string' ? element.className : '',
      );
    }
    const signal = parts.join(' ').replace(/\s+/g, ' ').toLowerCase();
    if (/(^|\W)hospital(\W|$)/.test(signal)) return 'hospital';
    if (/(^|\W)okay(\W|$)/.test(signal)) return 'okay';
    return null;
  }

  function getUserIdFromStatusDiv(statusDiv) {
    const stored = Number(statusDiv?.dataset?.twoUserId);
    if (Number.isFinite(stored) && stored > 0) return stored;
    const li = statusDiv?.closest?.('li');
    const anchor = li?.querySelector?.('a[href*="profiles.php"][href*="XID="]');
    return anchor ? getUserIdFromProfileLink(anchor) : null;
  }

  function processDomStatusDiv(statusDiv, { renderNow = true } = {}) {
    if (!statusDiv || !isActiveView() || !isLiveStatusTrusted()) return false;
    const userId = getUserIdFromStatusDiv(statusDiv);
    if (!userId) return false;

    const apiState = String(statusByUser.get(userId)?.state ?? '').toLowerCase();
    const existing = domStatusOverrideByUser.get(userId);

    if (apiState !== 'hospital') {
      if (!existing) return false;
      domStatusOverrideByUser.delete(userId);
      if (renderNow) {
        renderUser(userId);
        updateTargetToolbars();
      }
      return true;
    }

    const domState = detectDomStatusState(statusDiv);
    if (domState === 'okay') {
      const changed = !existing || existing.state !== 'okay';
      domStatusOverrideByUser.set(userId, { state: 'okay', observedAt: Date.now() });
      if (changed && renderNow) {
        renderUser(userId);
        updateTargetToolbars();
      }
      return changed;
    }

    if (domState === 'hospital' && existing) {
      domStatusOverrideByUser.delete(userId);
      if (renderNow) {
        renderUser(userId);
        updateTargetToolbars();
      }
      return true;
    }
    return false;
  }

  function reconcileDomStatusOverrides() {
    if (!isActiveView() || !isLiveStatusTrusted()) return;
    let changed = false;
    for (const rows of rowsByUser.values()) {
      const statusDiv = rows.find(row => row.statusDiv?.isConnected)?.statusDiv;
      if (!statusDiv) continue;
      if (processDomStatusDiv(statusDiv, { renderNow: false })) changed = true;
    }
    if (changed) renderAll();
  }

  function mutationTouchesOverlay(mutation) {
    const targetElement = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;
    if (targetElement?.closest?.('[data-two-hosp], .two-hosp-badge, .two-member-meta')) return true;
    const nodes = [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])];
    return nodes.length > 0 && nodes.every(node => {
      const element = node instanceof Element ? node : node.parentElement;
      return Boolean(element?.closest?.('[data-two-hosp], .two-hosp-badge, .two-member-meta'));
    });
  }

  function observeMembersList(list) {
    if (!list || listObservers.has(list)) return;
    const observer = new MutationObserver(mutations => {
      let structureChanged = false;
      const statusDivs = new Set();

      for (const mutation of mutations) {
        if (mutationTouchesOverlay(mutation)) continue;

        const targetElement = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;
        const statusDiv = targetElement?.closest?.('div.status');
        if (statusDiv) statusDivs.add(statusDiv);

        if (mutation.type === 'childList') {
          for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
            if (!(node instanceof Element)) continue;
            if (node.matches?.('li.enemy, li [href*="profiles.php"][href*="XID="]')
              || node.querySelector?.('a[href*="profiles.php"][href*="XID="]')) {
              structureChanged = true;
              break;
            }
          }
        }
      }

      if (isActiveView()) {
        for (const statusDiv of statusDivs) processDomStatusDiv(statusDiv);
      }
      if (structureChanged) scheduleScan();
    });
    observer.observe(list, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'title', 'aria-label'],
    });
    listObservers.set(list, observer);
  }

  function cleanupListObservers() {
    for (const [list, observer] of listObservers) {
      if (!list.isConnected) {
        observer.disconnect();
        listObservers.delete(list);
      }
    }
  }

  function cleanupTargetToolbars() {
    for (const toolbar of document.querySelectorAll('.two-target-toolbar')) {
      const list = toolbar.__twoList;
      if (!list || !list.isConnected) toolbar.remove();
    }
  }

  function scanWarRows() {
    incStat('scans');
    cleanupListObservers();
    cleanupTargetToolbars();
    const previousIds = new Set(rowsByUser.keys());
    const previousFirstRows = new Map(Array.from(rowsByUser.entries()).map(([id, rows]) => [id, rows?.[0]?.li || null]));
    const newMap = new Map();
    const lists = Array.from(document.querySelectorAll('ul.members-list'));

    for (const list of lists) {
      observeMembersList(list);
      let lis = Array.from(list.querySelectorAll('li.enemy'));
      if (lis.length === 0) lis = Array.from(list.querySelectorAll('li'));

      for (const li of lis) {
        const anchor = li.querySelector('a[href*="profiles.php"][href*="XID="]');
        if (!anchor) continue;
        const userId = getUserIdFromProfileLink(anchor);
        if (!userId) continue;

        const memberDiv = li.querySelector('div.member, [class*="member"]') || anchor.parentElement;
        const statusDiv = li.querySelector('div.status, [class*="status"]');
        const level = getLevelFromRow(li);
        const ageBadge = ensureAgeBadge(memberDiv, userId);
        const activityBadge = ensureActivityBadge(memberDiv, userId);
        const attackHistoryBadge = ensureAttackHistoryBadge(memberDiv, userId);
        const intelBadge = ensureIntelBadge(memberDiv, userId);
        const hospBadge = ensureHospitalBadge(statusDiv, userId);

        if (!newMap.has(userId)) newMap.set(userId, []);
        newMap.get(userId).push({ li, list, anchor, memberDiv, statusDiv, level, ageBadge, activityBadge, attackHistoryBadge, intelBadge, hospBadge });
      }
    }

    if (newMap.size === 0) {
      const elapsed = Date.now() - lastNonEmptyRowsAt;
      if (activeFactionId && elapsed < EMPTY_ROWS_GRACE_MS) {
        // Keep the previous row map during a transient React unmount. The next scan will rebind fresh DOM nodes.
        scheduleScan(EMPTY_ROWS_GRACE_MS - elapsed + 50);
        return;
      }
      rowsByUser.clear();
      lastRenderedSignatureByUser.clear();
      if (activeFactionId) {
        clearFactionRefreshTimer();
        clearAttackRefreshTimer();
        activeFactionId = null;
        factionRefreshInFlight = null;
        attackRefreshInFlight = null;
        resetFactionState();
      }
      return;
    }

    const remounted = Array.from(newMap.entries()).some(([id, rows]) => previousFirstRows.has(id) && previousFirstRows.get(id) !== rows?.[0]?.li);
    if (remounted) incStat('remounts');
    rowsByUser.clear();
    lastRenderedSignatureByUser.clear();
    for (const [id, rows] of newMap) rowsByUser.set(id, rows);
    const addedUserIds = new Set(Array.from(newMap.keys()).filter(id => !previousIds.has(id)));
    if (addedUserIds.size > 0 && attackHistoryScope) {
      // Backfill the current war/window once for genuinely new faction members, then resume incremental updates.
      attackHistoryCursor = 0;
      attackHistoryBackfillTo = null;
      attackHistoryBackfillDone = false;
      scheduleAttackRefresh(500);
    }
    lastNonEmptyRowsAt = Date.now();

    if (!activeFactionId) {
      const firstRows = rowsByUser.values().next().value;
      const directFactionId = getFactionIdFromList(firstRows?.[0]?.list);
      if (directFactionId) setActiveFaction(directFactionId);
      else resolveActiveFactionFallback();
    }

    // Existing rows can inherit safe non-candidate hints after a React remount. Truly new faction members trigger a fresh search.
    if (ageSearchComplete && ageSearchFactionId === activeFactionId) {
      const maxLevel = configuredMaxLevel();
      for (const userId of rowsByUser.keys()) {
        if (addedUserIds.has(userId) || ageHintByUser.has(userId) || getSignedUp(userId)) continue;
        const level = getBestLevelForUser(userId);
        ageHintByUser.set(userId, maxLevel !== null && Number.isFinite(level) && level > maxLevel ? 'level-excluded' : 'old');
      }
      if (addedUserIds.size > 0 && activeFactionId) startAgePrefilter(activeFactionId);
    }

    renderAll();
    if (isLiveStatusTrusted()) reconcileDomStatusOverrides();
    if (ageSearchComplete || ageSearchUnavailable) queueMissingProfilesByPriority();
  }

  function getBestLevelForUser(userId) {
    // The faction members payload is authoritative; DOM scraping is only a pre-snapshot fallback.
    const apiLevel = Number(memberMetaByUser.get(userId)?.level);
    if (Number.isFinite(apiLevel) && apiLevel > 0) return apiLevel;
    const rows = rowsByUser.get(userId) || [];
    let best = Number.POSITIVE_INFINITY;
    for (const row of rows) best = Math.min(best, Number(row.level));
    return best;
  }

  // Torn's v2 schema types `status.until` as nullable. Number(null) is 0, which would look like an expired timer.
  function getStatusUntil(status) {
    const until = Number(status?.until);
    return Number.isFinite(until) && until > 0 ? until : null;
  }

  function profilePriority(userId) {
    const target = getTargetState(userId);
    const ageInfo = getAgeInfo(userId);
    const candidate = ageInfo.candidate && !ageInfo.confirmed;

    // /user/search candidates get exact confirmation first, with the most useful combat states first.
    if (candidate && target.notOnline && target.attackWindow) return 0;
    if (candidate && target.notOnline && target.hospitalWatchWindow) return 1;
    if (candidate && target.notOnline && target.isHospital) return 2;
    if (candidate && target.notOnline) return 3;
    if (candidate) return 4;

    // If /user/search is unavailable, progressively scan lower-risk/lower-level rows first.
    if (fallbackProfileMode && !ageInfo.confirmed) {
      if (target.notOnline && target.attackWindow) return 5;
      if (target.notOnline && target.hospitalWatchWindow) return 6;
      if (target.notOnline) return 7;
      return 8;
    }

    // Known-old exact-age decoration is intentionally cold background work.
    if (ageInfo.hint === 'old') {
      if (target.notOnline && target.attackWindow) return 20;
      if (target.notOnline) return 21;
      return 22;
    }
    return 30;
  }

  function sortProfileQueue(queue) {
    queue.sort((a, b) => {
      const priorityA = profilePriority(a.userId);
      const priorityB = profilePriority(b.userId);
      if (priorityA !== priorityB) return priorityA - priorityB;
      if (a.level !== b.level) return a.level - b.level;
      return a.queuedAt - b.queuedAt;
    });
  }

  function removeQueuedProfile(userId, queue) {
    const index = queue.findIndex(item => item.userId === userId);
    if (index >= 0) queue.splice(index, 1);
  }

  function queueProfile(userId, kind = 'hot') {
    if (getSignedUp(userId)) {
      renderUser(userId);
      return;
    }
    if (profileIdsInFlight.has(userId)) return;

    const existingKind = queuedProfiles.get(userId);
    if (existingKind === 'hot' || existingKind === kind) return;

    // Promote cold work to hot if this player becomes a candidate.
    if (existingKind === 'cold' && kind === 'hot') {
      removeQueuedProfile(userId, coldProfileQueue);
      queuedProfiles.delete(userId);
    }

    queuedProfiles.set(userId, kind);
    const entry = { userId, level: getBestLevelForUser(userId), queuedAt: Date.now(), kind };
    const queue = kind === 'hot' ? hotProfileQueue : coldProfileQueue;
    queue.push(entry);
    sortProfileQueue(queue);
    runProfileWorker();
  }

  function queueYoungProfilesNow() {
    const ids = Array.from(rowsByUser.keys())
      .filter(id => ageHintByUser.get(id) === 'candidate' && !getSignedUp(id))
      .sort((a, b) => {
        const p = profilePriority(a) - profilePriority(b);
        return p || getBestLevelForUser(a) - getBestLevelForUser(b);
      });
    for (const id of ids) queueProfile(id, 'hot');
  }

  function queueOldProfilesSlowly() {
    if (!LOAD_OLD_EXACT_AGES_SLOWLY) return;
    const ids = Array.from(rowsByUser.keys())
      .filter(id => ageHintByUser.get(id) === 'old' && !getSignedUp(id))
      .sort((a, b) => {
        const p = profilePriority(a) - profilePriority(b);
        return p || getBestLevelForUser(a) - getBestLevelForUser(b);
      });
    for (const id of ids) queueProfile(id, 'cold');
  }

  function queueFallbackProfiles() {
    fallbackProfileMode = true;
    const ids = Array.from(rowsByUser.keys())
      .filter(id => !getSignedUp(id))
      .sort((a, b) => {
        const p = profilePriority(a) - profilePriority(b);
        return p || getBestLevelForUser(a) - getBestLevelForUser(b);
      });
    for (const id of ids) queueProfile(id, 'cold');
  }

  function queueMissingProfilesByPriority() {
    if (ageSearchUnavailable) {
      queueFallbackProfiles();
      return;
    }
    if (!ageSearchComplete) {
      queueYoungProfilesNow();
      return;
    }
    queueYoungProfilesNow();
    queueOldProfilesSlowly();
  }

  async function fetchProfile(userId, { force = false } = {}) {
    const cachedSignedUp = getSignedUp(userId);
    if (!force && cachedSignedUp) return { signed_up: cachedSignedUp, id: userId };
    incStat('profileFetches');

    const data = await apiGet(`/user/${userId}/profile`);
    const profile = data?.profile;
    if (!profile) throw new ApiError(`Profile ${userId} missing from API response.`);

    const signedUp = Number(profile.signed_up);
    if (!Number.isFinite(signedUp) || signedUp <= 0) {
      throw new ApiError(`Profile ${userId} did not provide a valid signup timestamp.`);
    }
    setSignedUp(userId, signedUp);

    // Live status remains faction-only. Profile contributes permanent account-age data only.
    renderUser(userId);
    updateTargetToolbars();
    return profile;
  }

  async function runProfileWorker() {
    if (profileWorkerRunning) return;
    profileWorkerRunning = true;

    try {
      while (hotProfileQueue.length > 0 || coldProfileQueue.length > 0 || profileRequestsInFlight > 0) {
        if (apiPermanentlyDisabled) {
          hotProfileQueue.length = 0;
          coldProfileQueue.length = 0;
          queuedProfiles.clear();
          break;
        }
        if (!isActiveView()) {
          await sleep(500);
          continue;
        }
        if (Date.now() < globalBackoffUntil) {
          await sleep(Math.min(500, Math.max(50, globalBackoffUntil - Date.now())));
          continue;
        }

        const nextKind = hotProfileQueue.length > 0 ? 'hot' : coldProfileQueue.length > 0 ? 'cold' : null;
        if (!nextKind) {
          await sleep(50);
          continue;
        }

        const maxInFlight = nextKind === 'hot' ? PROFILE_MAX_IN_FLIGHT : 1;
        if (profileRequestsInFlight >= maxInFlight) {
          await sleep(50);
          continue;
        }

        const gapMs = nextKind === 'hot'
          ? HOT_PROFILE_START_GAP_MS
          : fallbackProfileMode
            ? FALLBACK_PROFILE_START_GAP_MS
            : COLD_PROFILE_START_GAP_MS;
        const waitForGap = gapMs - (Date.now() - lastProfileRequestStart);
        if (waitForGap > 0) {
          await sleep(Math.min(waitForGap, 100));
          continue;
        }

        const queue = nextKind === 'hot' ? hotProfileQueue : coldProfileQueue;
        const next = queue.shift();
        if (!next) continue;

        queuedProfiles.delete(next.userId);
        if (getSignedUp(next.userId) || profileIdsInFlight.has(next.userId)) continue;

        profileIdsInFlight.add(next.userId);
        profileRequestsInFlight += 1;
        lastProfileRequestStart = Date.now();

        fetchProfile(next.userId)
          .then(() => registerApiSuccess())
          .catch(err => {
            console.warn(`[${SCRIPT}] Could not fetch profile ${next.userId}`, err);
            if (err?.message !== 'API backoff active.') registerApiFailure(err);
            if (err?.retryable && !apiPermanentlyDisabled) {
              const retryDelay = Math.max(1_000, globalBackoffUntil - Date.now() + 250);
              setTimeout(() => queueProfile(next.userId, next.kind), retryDelay);
            }
          })
          .finally(() => {
            profileIdsInFlight.delete(next.userId);
            profileRequestsInFlight -= 1;
          });
      }
    } finally {
      profileWorkerRunning = false;
    }
  }

  async function resolveActiveFactionFallback() {
    if (resolvingFaction || rowsByUser.size === 0 || activeFactionId) return;
    resolvingFaction = true;
    try {
      const sortedIds = Array.from(rowsByUser.keys()).sort((a, b) => getBestLevelForUser(a) - getBestLevelForUser(b));
      const firstUserId = sortedIds[0];
      const data = await apiGet(`/user/${firstUserId}/faction`);
      const factionId = Number(data?.faction?.id);
      if (Number.isFinite(factionId) && factionId > 0) setActiveFaction(factionId);
      registerApiSuccess();
    } catch (err) {
      console.warn(`[${SCRIPT}] Could not resolve enemy faction`, err);
      if (err?.message !== 'API backoff active.') registerApiFailure(err);
    } finally {
      resolvingFaction = false;
    }
  }



  function pruneAttackHistoryMap(map) {
    for (const [userId, entries] of map) {
      const seen = new Set();
      const compact = (Array.isArray(entries) ? entries : [])
        .filter(Boolean)
        .sort((a, b) => Number(b?.ended || 0) - Number(a?.ended || 0) || Number(b?.id || 0) - Number(a?.id || 0))
        .filter(entry => {
          const key = Number(entry?.id) > 0
            ? `id:${Number(entry.id)}`
            : `fallback:${Number(entry?.ended || 0)}:${String(entry?.result || '')}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, ATTACK_RESULTS_LIMIT);
      if (compact.length > 0) map.set(userId, compact);
      else map.delete(userId);
    }
  }

  function makeFallbackAttackScope(factionId) {
    const nowSec = Math.floor(serverNowSec());
    return {
      key: `fallback:${Number(factionId)}`,
      factionId: Number(factionId),
      warId: null,
      from: Math.max(0, nowSec - ATTACK_HISTORY_FALLBACK_WINDOW_SEC),
      mode: 'fallback',
    };
  }

  function makeWarAttackScope(factionId, war) {
    const warId = Number(war?.id);
    const start = Number(war?.start);
    if (!Number.isFinite(warId) || warId <= 0 || !Number.isFinite(start) || start <= 0) {
      return makeFallbackAttackScope(factionId);
    }
    return {
      key: `war:${warId}:enemy:${Number(factionId)}`,
      factionId: Number(factionId),
      warId,
      from: start,
      mode: 'war',
    };
  }

  function setAttackHistoryScope(scope) {
    if (!scope?.key) return;
    if (attackHistoryScope?.key === scope.key) {
      attackHistoryScope = scope;
      return;
    }
    attackHistoryScope = scope;
    attackHistoryCursor = 0;
    attackHistoryBackfillTo = null;
    attackHistoryBackfillDone = false;
    attackHistoryByUser.clear();
    lastRenderedSignatureByUser.clear();
    if (loadCachedAttackHistory(scope)) renderAll();
  }

  function loadCachedAttackHistory(scope) {
    if (!scope?.key) return false;
    const cached = attackHistoryCache[scope.key];
    if (!cached || !Number.isFinite(Number(cached.savedAt))) return false;
    if (Date.now() - Number(cached.savedAt) > ATTACKS_CACHE_MAX_AGE_MS) return false;
    if (!cached.entries || typeof cached.entries !== 'object') return false;
    if (Number(cached.scopeFrom || 0) !== Number(scope.from || 0)) return false;

    attackHistoryByUser.clear();
    for (const [userId, entries] of Object.entries(cached.entries)) {
      const numericId = Number(userId);
      if (!Number.isFinite(numericId)) continue;
      attackHistoryByUser.set(numericId, (Array.isArray(entries) ? entries : []).slice(0, ATTACK_RESULTS_LIMIT));
    }
    pruneAttackHistoryMap(attackHistoryByUser);
    // A cursor from a previous session is only meaningful if the opponent memory it fed still exists.
    if (processedAttackIds.size === 0) {
      attackHistoryCursor = 0;
      attackHistoryBackfillTo = null;
      attackHistoryBackfillDone = false;
      return true;
    }
    attackHistoryCursor = Number.isFinite(Number(cached.cursor)) ? Number(cached.cursor) : 0;
    const backfillTo = Number(cached.backfillTo);
    attackHistoryBackfillTo = Number.isFinite(backfillTo) && backfillTo > 0 ? backfillTo : null;
    attackHistoryBackfillDone = Boolean(cached.backfillDone) && attackHistoryCursor > 0 && attackHistoryBackfillTo === null;
    return true;
  }

  function persistAttackHistory(scope = attackHistoryScope) {
    if (!scope?.key) return;
    const entries = {};
    for (const [userId, history] of attackHistoryByUser) {
      if (!Array.isArray(history) || history.length === 0) continue;
      entries[String(userId)] = history.slice(0, ATTACK_RESULTS_LIMIT);
    }
    attackHistoryCache[scope.key] = {
      savedAt: Date.now(),
      scopeFrom: Number(scope.from || 0),
      factionId: Number(scope.factionId || 0),
      warId: Number.isFinite(Number(scope.warId)) ? Number(scope.warId) : null,
      cursor: Number(attackHistoryCursor || 0),
      backfillTo: attackHistoryBackfillTo,
      backfillDone: Boolean(attackHistoryBackfillDone),
      entries,
    };
    pruneTimestampedObjectCache(attackHistoryCache);
    saveJson(ATTACK_HISTORY_CACHE_STORAGE, attackHistoryCache);
  }

  // Accepts both the /faction/wars `ranked` object (war_id) and a /faction/warfareranked item (id).
  // Returns null unless the war is ongoing and involves the enemy faction currently displayed.
  function normalizeRankedWar(raw, enemyFactionId, nowSec) {
    if (!raw || typeof raw !== 'object') return null;
    const id = Number(raw.war_id ?? raw.id);
    const start = Number(raw.start);
    const end = raw.end === null || raw.end === undefined ? null : Number(raw.end);
    const winner = raw.winner === null || raw.winner === undefined ? null : Number(raw.winner);
    const factions = Array.isArray(raw.factions) ? raw.factions : [];
    const enemy = factions.find(item => Number(item?.id) === Number(enemyFactionId)) || null;
    if (!enemy || !Number.isFinite(id) || id <= 0 || !Number.isFinite(start) || start <= 0) return null;
    const own = factions.find(item => ownFactionId ? Number(item?.id) === Number(ownFactionId) : Number(item?.id) !== Number(enemyFactionId)) || null;
    if (ownFactionId && !own) return null;
    const ongoing = winner === null && (end === null || !Number.isFinite(end) || end <= 0 || end >= nowSec - 120);
    if (!ongoing || start > nowSec + 120) return null;
    const target = Number(raw.target);
    return {
      id,
      start,
      end: Number.isFinite(end) ? end : null,
      target: Number.isFinite(target) && target > 0 ? target : null,
      winner,
      ownScore: Number.isFinite(Number(own?.score)) ? Number(own.score) : null,
      enemyScore: Number.isFinite(Number(enemy?.score)) ? Number(enemy.score) : null,
      ownChain: Number(own?.chain) || 0,
      enemyChain: Number(enemy?.chain) || 0,
      ownName: typeof own?.name === 'string' ? own.name : '',
      enemyName: typeof enemy?.name === 'string' ? enemy.name : '',
      fetchedAtPerf: monotonicNowMs(),
    };
  }

  let warfareRankedFallbackNeeded = false;

  async function refreshWarContext(factionId, { force = false } = {}) {
    factionId = Number(factionId);
    if (!Number.isFinite(factionId) || factionId <= 0) return null;
    if (warContextInFlight) return warContextInFlight;
    if (!force && currentWar && Date.now() - warContextLastCheckedAt < WAR_CONTEXT_REFRESH_MS) return currentWar;
    if (!force && warContextState === 'fallback' && Date.now() - warContextLastCheckedAt < WAR_CONTEXT_FALLBACK_REFRESH_MS) return null;

    const flight = (async () => {
      try {
        try { await ensurePrimaryKeyInfo(); } catch { /* war lookup can still proceed without own faction id */ }
        const nowSec = Math.floor(serverNowSec());
        let war = null;
        try {
          // /faction/wars is the live source: it returns only the key owner's current ranked war with score, target and chains.
          const data = await apiGet('/faction/wars', { cacheBust: true });
          if (activeFactionId !== factionId) return null;
          war = normalizeRankedWar(data?.wars?.ranked, factionId, nowSec);
          warfareRankedFallbackNeeded = false;
        } catch (err) {
          if (activeFactionId !== factionId) return null;
          if (err?.message === 'API backoff active.') throw err;
          warfareRankedFallbackNeeded = true;
          console.warn(`[${SCRIPT}] /faction/wars unavailable; trying the warfare list.`, err);
        }
        if (!war && warfareRankedFallbackNeeded) {
          const data = await apiGet('/faction/warfareranked', {
            query: { sort: 'DESC', limit: 100, from: Math.max(0, nowSec - 7 * 24 * 60 * 60) },
            cacheBust: force || warContextState === 'unknown',
          });
          if (activeFactionId !== factionId) return null;
          const wars = Array.isArray(data?.warfareranked) ? data.warfareranked : [];
          const candidates = wars
            .map(item => normalizeRankedWar(item, factionId, nowSec))
            .filter(Boolean)
            .sort((a, b) => Number(b.start || 0) - Number(a.start || 0));
          war = candidates[0] || null;
        }

        currentWar = war;
        warContextState = currentWar ? 'ready' : 'fallback';
        warContextLastCheckedAt = Date.now();
        setAttackHistoryScope(currentWar ? makeWarAttackScope(factionId, currentWar) : makeFallbackAttackScope(factionId));
        updateTargetToolbars();
        return currentWar;
      } catch (err) {
        if (activeFactionId !== factionId) return null;
        warContextLastCheckedAt = Date.now();
        if (currentWar && (err?.retryable || err?.message === 'API backoff active.')) {
          // A transient failure must not flip the scope: that would wipe the dots and restart the backfill for nothing.
          return currentWar;
        }
        warContextState = 'fallback';
        currentWar = null;
        setAttackHistoryScope(makeFallbackAttackScope(factionId));
        if (err?.message !== 'API backoff active.') console.warn(`[${SCRIPT}] Ranked-war context unavailable; using a time-scoped attack-history fallback.`, err);
        return null;
      }
    })().finally(() => {
      if (warContextInFlight === flight) warContextInFlight = null;
    });

    warContextInFlight = flight;
    return flight;
  }

  function clearAttackRefreshTimer() {
    if (attackRefreshTimer) clearTimeout(attackRefreshTimer);
    attackRefreshTimer = null;
  }

  function scheduleAttackRefresh(delayMs = ATTACKS_REFRESH_MS) {
    clearAttackRefreshTimer();
    if (!activeFactionId || !isActiveView() || !apiKey || attackHistoryFeatureState === 'unsupported') return;
    attackRefreshTimer = setTimeout(() => {
      attackRefreshTimer = null;
      refreshRecentAttacks();
    }, Math.max(500, delayMs));
  }

  function mergeRecentAttacks(rawAttacks) {
    const visibleIds = new Set(rowsByUser.keys());
    const scope = attackHistoryScope;
    let dotsChanged = 0;
    let maxStarted = 0;

    for (const raw of Array.isArray(rawAttacks) ? rawAttacks : []) {
      const attack = normalizeAttack(raw);
      if (!attack) continue;
      maxStarted = Math.max(maxStarted, attack.started);

      // Long-term personal matchup memory is scoped to the opponent, not to the current war or page.
      if (intelEnabled()) recordAttackIntel(attack);

      if (!visibleIds.has(attack.defenderId)) continue;
      if (scope?.mode === 'war' && !attack.isRankedWar) continue;
      if (scope && attack.ended < Number(scope.from || 0)) continue;
      const current = attackHistoryByUser.get(attack.defenderId) || [];
      if (current.some(entry => Number(entry?.id) === attack.id)) continue;
      current.push({
        kind: attack.outcome.kind,
        title: attack.outcome.title,
        result: attack.result,
        ended: attack.ended,
        id: attack.id,
        respect: attack.respect,
        ff: attack.ff,
      });
      attackHistoryByUser.set(attack.defenderId, current);
      dotsChanged += 1;
    }

    // Advance the incremental cursor on every outgoing attack so unrelated hits are not downloaded repeatedly.
    if (maxStarted > attackHistoryCursor) attackHistoryCursor = maxStarted;
    if (dotsChanged > 0) pruneAttackHistoryMap(attackHistoryByUser);
    return dotsChanged;
  }

  async function refreshRecentAttacks() {
    if (!activeFactionId || !isActiveView() || !apiKey) {
      clearAttackRefreshTimer();
      return;
    }
    if (attackRefreshInFlight) return attackRefreshInFlight;
    if (Date.now() < globalBackoffUntil) {
      scheduleAttackRefresh(Math.max(1_000, globalBackoffUntil - Date.now() + 500));
      return;
    }

    const factionId = activeFactionId;
    const generation = lifecycleGeneration;
    let aborted = false;
    const flight = (async () => {
      try {
        const capable = await ensureAttackHistoryCapability();
        if (!capable) {
          attackHistoryByUser.clear();
          renderAll();
          return;
        }
        if (generation !== lifecycleGeneration) { aborted = true; return; }
        await refreshWarContext(factionId);
        if (activeFactionId !== factionId) return;
        if (generation !== lifecycleGeneration) { aborted = true; return; }
        if (!attackHistoryScope) setAttackHistoryScope(makeFallbackAttackScope(factionId));
        // Own battle stats turn observed Fair Fight into today's expected score. Cached for hours; one request.
        await refreshSelfStats();
        if (activeFactionId !== factionId) return;
        if (generation !== lifecycleGeneration || !isActiveView()) { aborted = true; return; }

        const requestScopeKey = attackHistoryScope?.key || null;
        const baseFrom = Number(attackHistoryScope?.from || 0);
        let budget = ATTACKS_PAGES_PER_CYCLE;

        // /user/attacks pages are capped at 100 rows and arrive newest first. One page is fetched with `from` and
        // older pages are reached by walking `to` backwards. Returns the oldest `started` on the page, or null when
        // the page was short (nothing older remains in the requested range) or the flight must abort.
        const fetchPage = async (from, to) => {
          const data = await apiGet('/user/attacks', {
            query: {
              filters: 'outgoing',
              sort: 'DESC',
              limit: ATTACKS_PAGE_LIMIT,
              from: Math.max(0, Math.floor(from)),
              ...(to !== null ? { to: Math.floor(to) } : {}),
            },
            cacheBust: true,
            keyOverride: attackApiKey || null,
          });
          budget -= 1;
          if (activeFactionId !== factionId || generation !== lifecycleGeneration || !isActiveView()) return { aborted: true };
          if ((attackHistoryScope?.key || null) !== requestScopeKey) return { aborted: true };
          const attacks = Array.isArray(data?.attacks) ? data.attacks : [];
          mergeRecentAttacks(attacks);
          if (attacks.length < ATTACKS_PAGE_LIMIT) return { aborted: false, older: null };
          const minStarted = attacks.reduce((min, item) => {
            const started = Number(item?.started);
            return Number.isFinite(started) && started > 0 ? Math.min(min, started) : min;
          }, Number.POSITIVE_INFINITY);
          // `to` is inclusive, so the boundary attack repeats (deduplicated by id). No progress means the range is exhausted.
          if (!Number.isFinite(minStarted) || (to !== null && minStarted >= to)) return { aborted: false, older: null };
          return { aborted: false, older: minStarted };
        };

        // Phase 1: the head of the window (everything since the cursor). On the very first fetch this is the whole window.
        const headFrom = attackHistoryCursor > 0 ? Math.max(baseFrom, attackHistoryCursor - ATTACK_CURSOR_OVERLAP_SEC) : baseFrom;
        let headTo = null;
        let headComplete = false;
        while (budget > 0) {
          const page = await fetchPage(headFrom, headTo);
          if (page.aborted) { aborted = true; return; }
          if (page.older === null) { headComplete = true; break; }
          headTo = page.older;
        }
        if (!headComplete && headTo !== null) {
          // More history exists below headTo. Restart the backfill pointer from there; any overlap with an earlier
          // partial backfill is harmless because every attack is deduplicated by id.
          attackHistoryBackfillTo = headTo;
          attackHistoryBackfillDone = false;
        } else if (attackHistoryBackfillTo === null) {
          attackHistoryBackfillDone = true;
        }

        // Phase 2: continue an unfinished backfill downwards to the scope start, within the remaining page budget.
        while (attackHistoryBackfillTo !== null && budget > 0) {
          const page = await fetchPage(baseFrom, attackHistoryBackfillTo);
          if (page.aborted) { aborted = true; return; }
          if (page.older === null || page.older >= attackHistoryBackfillTo) {
            attackHistoryBackfillTo = null;
            attackHistoryBackfillDone = true;
            break;
          }
          attackHistoryBackfillTo = page.older;
        }

        incStat('attackHistoryRefreshes');
        attackHistoryFeatureState = 'ready';
        persistAttackHistory();
        renderAll();
      } catch (err) {
        if (activeFactionId !== factionId) return;
        if (Number(err?.code) === 16 || Number(err?.code) === 7) {
          attackHistoryFeatureState = 'unsupported';
          attackHistoryByUser.clear();
          console.warn(`[${SCRIPT}] Personal intel needs a Limited key or Custom user -> attacks key. Main overlay remains active.`, err);
          renderAll();
          return;
        }
        if (err?.retryable || err?.message === 'API backoff active.') {
          console.warn(`[${SCRIPT}] Could not refresh recent attacks`, err);
          if (err?.message !== 'API backoff active.' && !attackApiKey) registerApiFailure(err);
          scheduleAttackRefresh(Math.max(5_000, globalBackoffUntil - Date.now() + 750));
          return;
        }
        attackHistoryFeatureState = 'unsupported';
        attackHistoryByUser.clear();
        console.warn(`[${SCRIPT}] Personal intel disabled for this key.`, err);
        renderAll();
      }
    })().finally(() => {
      if (attackRefreshInFlight === flight) attackRefreshInFlight = null;
      if (activeFactionId === factionId && isActiveView() && apiKey && attackHistoryFeatureState !== 'unsupported') {
        // An unfinished backfill or a lifecycle-aborted flight continues quickly; steady state polls every 30 s.
        scheduleAttackRefresh(aborted || attackHistoryBackfillTo !== null ? 1_500 : ATTACKS_REFRESH_MS);
      }
    });

    attackRefreshInFlight = flight;
    return flight;
  }

  function restoreCachedFactionStatuses(factionId) {
    const cached = factionStatusCache[String(factionId)];
    if (!cached || !Number.isFinite(Number(cached.savedAt))) return;
    if (Date.now() - Number(cached.savedAt) > STATUS_CACHE_MAX_AGE_MS) return;
    if (!Array.isArray(cached.members)) return;

    for (const member of cached.members) {
      const id = Number(member?.id);
      if (!Number.isFinite(id)) continue;
      if (member?.status) statusByUser.set(id, member.status);
      if (member?.last_action) lastActionByUser.set(id, member.last_action);
      const level = Number(member?.level);
      memberMetaByUser.set(id, {
        hasEarlyDischarge: Boolean(member?.has_early_discharge),
        isRevivable: Boolean(member?.is_revivable),
        reviveSetting: String(member?.revive_setting || 'Unknown'),
        level: Number.isFinite(level) && level > 0 ? level : null,
        name: '',
      });
    }

    // Provisional only: target state remains disabled until a fresh snapshot arrives.
    factionLiveReady = false;
    apiHealth = 'syncing';
    renderAll();
  }

  function resetFactionState() {
    ageSearchGeneration += 1;
    statusByUser.clear();
    lastActionByUser.clear();
    memberMetaByUser.clear();
    ageHintByUser.clear();
    lastHospitalDisplayByUser.clear();
    lastActivityDisplayByUser.clear();
    domStatusOverrideByUser.clear();
    attackHistoryByUser.clear();
    lastRenderedSignatureByUser.clear();
    currentWar = null;
    warContextState = 'unknown';
    warContextLastCheckedAt = 0;
    warContextInFlight = null;
    attackHistoryScope = null;
    attackHistoryCursor = 0;
    attackHistoryBackfillTo = null;
    attackHistoryBackfillDone = false;
    bestTargetUserId = null;
    bestTargetReason = '';

    hotProfileQueue.length = 0;
    coldProfileQueue.length = 0;
    queuedProfiles.clear();

    factionLiveReady = false;
    lastFreshSnapshotAt = 0;
    lastFreshSnapshotPerfAt = 0;
    lastRenderedTrustState = false;
    apiHealth = 'syncing';
    apiHealthDetail = '';
    ageSearchFactionId = null;
    ageSearchComplete = false;
    ageSearchUnavailable = false;
    fallbackProfileMode = false;
    attackHistoryFeatureState = 'unknown';
  }

  function clearFactionRefreshTimer() {
    if (factionRefreshTimer) clearTimeout(factionRefreshTimer);
    factionRefreshTimer = null;
    factionRefreshDueAt = 0;
  }

  function getAdaptiveFactionRefreshMs() {
    if (!ageSearchComplete && !ageSearchUnavailable) return STATUS_REFRESH_ACTIVE_MS;
    let hasCandidate = false;
    const watchSec = configuredYellowHospitalSec();
    for (const userId of rowsByUser.keys()) {
      const ageInfo = getAgeInfo(userId);
      const level = getBestLevelForUser(userId);
      const maxLevel = configuredMaxLevel();
      const levelEligible = maxLevel === null || !Number.isFinite(level) || level <= maxLevel;
      const candidate = levelEligible && (ageInfo.eligible || ageInfo.hint === 'candidate');
      if (!candidate) continue;
      hasCandidate = true;
      const target = getTargetState(userId, ageInfo);
      if (target.isOkay || target.isDue || target.ideal || target.good) return STATUS_REFRESH_ACTIVE_MS;
      if (target.rawIsHospital && Number.isFinite(target.secondsLeft) && target.secondsLeft <= watchSec + 60) {
        return STATUS_REFRESH_ACTIVE_MS;
      }
    }
    return hasCandidate ? STATUS_REFRESH_WATCH_MS : STATUS_REFRESH_IDLE_MS;
  }

  function scheduleFactionRefresh(delayMs = null) {
    clearFactionRefreshTimer();
    if (!activeFactionId || !isActiveView() || apiPermanentlyDisabled) return;
    const resolvedDelay = delayMs == null ? getAdaptiveFactionRefreshMs() : Number(delayMs);
    const safeDelay = Math.max(250, Number.isFinite(resolvedDelay) ? resolvedDelay : STATUS_REFRESH_ACTIVE_MS);
    factionRefreshDueAt = Date.now() + safeDelay;
    factionRefreshTimer = setTimeout(() => {
      factionRefreshTimer = null;
      factionRefreshDueAt = 0;
      refreshFactionMembers();
    }, safeDelay);
  }

  function tightenAdaptiveFactionSchedule() {
    if (!factionRefreshTimer || !factionRefreshDueAt) return;
    const desired = getAdaptiveFactionRefreshMs();
    const remaining = factionRefreshDueAt - Date.now();
    if (remaining > desired + 500) scheduleFactionRefresh(desired);
  }

  function setActiveFaction(factionId) {
    factionId = Number(factionId);
    if (!Number.isFinite(factionId) || factionId <= 0) return;
    if (activeFactionId === factionId) {
      if (isActiveView()) {
        scheduleFactionRefresh(250);
        scheduleAttackRefresh(250);
      }
      return;
    }

    clearFactionRefreshTimer();
    clearAttackRefreshTimer();
    factionRefreshInFlight = null; // Detach any request belonging to the previous faction; its response is faction-id guarded.
    attackRefreshInFlight = null; // Same for a paginated attack flight, which can span several requests.
    activeFactionId = factionId;
    resetFactionState();
    restoreCachedFactionStatuses(factionId);

    // Run both in parallel: fresh combat state + fast candidate discovery.
    if (isActiveView()) {
      refreshFactionMembers();
      refreshRecentAttacks();
    }
    startAgePrefilter(factionId);
  }

  async function fetchFactionSnapshotGeneric(factionId) {
    const before = monotonicNowMs();
    const data = await apiGet('/faction', {
      query: { selections: 'members,timestamp', id: factionId },
      cacheBust: true,
    });
    const after = monotonicNowMs();
    if (Number.isFinite(Number(data?.timestamp))) syncClockFromTimestamp(Number(data.timestamp), before, after);
    if (!Array.isArray(data?.members)) throw new ApiError('Generic faction response missing members.', { retryable: false });
    return data.members;
  }

  async function fetchFactionSnapshotStable(factionId) {
    const before = monotonicNowMs();
    const [membersData, timestampData] = await Promise.all([
      apiGet(`/faction/${factionId}/members`, { cacheBust: true }),
      apiGet('/faction/timestamp', { cacheBust: true }),
    ]);
    const after = monotonicNowMs();
    if (Number.isFinite(Number(timestampData?.timestamp))) syncClockFromTimestamp(Number(timestampData.timestamp), before, after);
    const members = Array.isArray(membersData?.members) ? membersData.members : null;
    if (!members) throw new ApiError('Stable faction members response missing members.', { retryable: true });
    return members;
  }

  async function fetchFactionSnapshot(factionId) {
    if (factionSnapshotMode === 'stable-fallback') return fetchFactionSnapshotStable(factionId);
    try {
      return await fetchFactionSnapshotGeneric(factionId);
    } catch (err) {
      if (err?.message === 'Generic faction response missing members.') {
        console.warn(`[${SCRIPT}] Generic faction response changed; switching to stable endpoint fallback for this session.`);
        factionSnapshotMode = 'stable-fallback';
        return fetchFactionSnapshotStable(factionId);
      }
      throw err;
    }
  }

  async function refreshFactionMembers() {
    if (!activeFactionId || !isActiveView() || apiPermanentlyDisabled || !apiKey) {
      clearFactionRefreshTimer();
      return;
    }
    if (factionRefreshInFlight) return factionRefreshInFlight;
    if (Date.now() < globalBackoffUntil) {
      updateTargetToolbars();
      scheduleFactionRefresh(Math.max(500, globalBackoffUntil - Date.now() + 250));
      return;
    }

    const factionId = activeFactionId;
    const flight = (async () => {
      try {
        const members = await fetchFactionSnapshot(factionId);
        if (activeFactionId !== factionId) return;

        statusByUser.clear();
        lastActionByUser.clear();
        memberMetaByUser.clear();
        const cachedMembers = [];

        for (const member of members) {
          const id = Number(member?.id);
          if (!Number.isFinite(id)) continue;
          if (member?.status) statusByUser.set(id, member.status);
          if (member?.last_action) lastActionByUser.set(id, member.last_action);
          const level = Number(member?.level);
          memberMetaByUser.set(id, {
            hasEarlyDischarge: Boolean(member?.has_early_discharge),
            isRevivable: Boolean(member?.is_revivable),
            reviveSetting: String(member?.revive_setting || 'Unknown'),
            level: Number.isFinite(level) && level > 0 ? level : null,
            name: typeof member?.name === 'string' ? member.name : '',
          });
          cachedMembers.push({
            id,
            status: member?.status ?? null,
            last_action: member?.last_action ?? null,
            has_early_discharge: Boolean(member?.has_early_discharge),
            is_revivable: Boolean(member?.is_revivable),
            revive_setting: String(member?.revive_setting || 'Unknown'),
            level: Number.isFinite(level) && level > 0 ? level : null,
          });
        }

        factionStatusCache[String(factionId)] = { savedAt: Date.now(), members: cachedMembers };
        scheduleFactionStatusCacheSave();
        incStat('factionSnapshots');
        registerApiSuccess({ snapshot: true });
        reconcileDomStatusOverrides();
        sortProfileQueue(hotProfileQueue);
        sortProfileQueue(coldProfileQueue);
        renderAll();
        // War score and own chain are Public-key context. Both calls are TTL-guarded (60 s / 30 s) and must never delay the snapshot.
        if (intelEnabled()) {
          refreshWarContext(factionId).catch(() => { /* handled inside */ });
          const nextHitBefore = getChainSnapshot()?.nextHit ?? 1;
          refreshOwnChain().then(() => {
            if (activeFactionId !== factionId) return;
            // The chain position changes every row's expected score, so a chain move re-renders rows, not just the chip.
            if ((getChainSnapshot()?.nextHit ?? 1) !== nextHitBefore) renderAll();
            else updateTargetToolbars();
          }).catch(() => { /* handled inside */ });
        }
      } catch (err) {
        console.warn(`[${SCRIPT}] Could not refresh faction members`, err);
        if (err?.message !== 'API backoff active.') registerApiFailure(err);
      }
    })().finally(() => {
      if (factionRefreshInFlight === flight) factionRefreshInFlight = null;
      if (activeFactionId === factionId && isActiveView() && !apiPermanentlyDisabled) {
        const delay = Date.now() < globalBackoffUntil
          ? Math.max(500, globalBackoffUntil - Date.now() + 250)
          : getAdaptiveFactionRefreshMs();
        scheduleFactionRefresh(delay);
      }
    });

    factionRefreshInFlight = flight;
    return flight;
  }

  function startAgePrefilter(factionId) {
    ageSearchGeneration += 1;
    const generation = ageSearchGeneration;
    return prefilterYoungAccounts(factionId, 0, generation);
  }

  async function prefilterYoungAccounts(factionId, attempt = 0, generation = ageSearchGeneration) {
    if (!factionId || generation !== ageSearchGeneration || (ageSearchFactionId === factionId && attempt === 0)) return;
    ageSearchFactionId = factionId;
    ageSearchComplete = false;
    ageSearchUnavailable = false;
    fallbackProfileMode = false;

    const candidateIds = new Set();
    let offset = 0;
    let total = null;

    try {
      do {
        if (activeFactionId !== factionId || generation !== ageSearchGeneration) return;
        while (!isActiveView()) {
          if (generation !== ageSearchGeneration) return;
          await sleep(500);
        }
        if (activeFactionId !== factionId || generation !== ageSearchGeneration) return;
        if (Date.now() < globalBackoffUntil) await sleep(Math.max(250, globalBackoffUntil - Date.now()));
        if (activeFactionId !== factionId || generation !== ageSearchGeneration) return;

        const filterParts = [`factions:${factionId}`, `daysOld:<:${searchAgeDaysThreshold()}`];
        const maxLevel = configuredMaxLevel();
        if (maxLevel !== null) filterParts.push(`level:<=:${maxLevel}`);
        const filters = filterParts.join(',');
        const data = await apiGet('/user/search', {
          query: { filters, offset },
          cacheBust: true,
        });
        const results = Array.isArray(data?.search) ? data.search : [];
        total = Number(data?._metadata?.total);

        for (const result of results) {
          const id = Number(result?.id);
          if (!Number.isFinite(id)) continue;
          candidateIds.add(id);
          // Search narrows the candidates but does not prove exact configured-age eligibility.
          ageHintByUser.set(id, 'candidate');
        }

        // Candidate profiles are the hot queue. Exact signed_up confirmation creates targets.
        queueYoungProfilesNow();
        renderAll();

        offset += results.length;
        if (results.length === 0) break;
      } while ((Number.isFinite(total) ? offset < total : true) && offset < 100);

      if (activeFactionId !== factionId || generation !== ageSearchGeneration) return;

      // Search is faction-scoped. With a max-level filter, absence can mean either old age or level exclusion.
      const maxLevel = configuredMaxLevel();
      for (const userId of rowsByUser.keys()) {
        if (getSignedUp(userId)) continue;
        if (candidateIds.has(userId)) {
          ageHintByUser.set(userId, 'candidate');
          continue;
        }
        const level = getBestLevelForUser(userId);
        if (maxLevel !== null && Number.isFinite(level) && level > maxLevel) {
          ageHintByUser.set(userId, 'level-excluded');
        } else {
          ageHintByUser.set(userId, 'old');
        }
      }

      ageSearchComplete = true;
      registerApiSuccess();
      renderAll();
      queueMissingProfilesByPriority();
    } catch (err) {
      if (activeFactionId !== factionId || generation !== ageSearchGeneration) return;

      const backoffOnly = err?.message === 'API backoff active.';
      if (!backoffOnly) registerApiFailure(err);

      // Do not abandon the low-API search path because of a transient rate/server/network condition.
      // Retry once after the active backoff; only then use the throttled profile fallback.
      if ((backoffOnly || err?.retryable) && attempt < 1 && !apiPermanentlyDisabled) {
        ageSearchFactionId = null;
        const delay = Math.max(2_000, globalBackoffUntil - Date.now() + 500);
        setTimeout(() => {
          if (activeFactionId === factionId && generation === ageSearchGeneration) prefilterYoungAccounts(factionId, attempt + 1, generation);
        }, delay);
        return;
      }

      console.warn(`[${SCRIPT}] Young-account search unavailable; using throttled profile fallback`, err);
      ageSearchUnavailable = true;
      fallbackProfileMode = true;
      // /user/search is Unstable. Fall back at a script-capped pace rather than bursting up to the Torn limit.
      queueFallbackProfiles();
    }
  }

  function isPdaRuntime() {
    return typeof PDA_httpGet === 'function';
  }

  function isActiveView() {
    if (document.hidden) return false;
    // Torn PDA webviews can report hasFocus() inconsistently; visibility is the reliable foreground signal there.
    if (isPdaRuntime()) return true;
    return typeof document.hasFocus !== 'function' ? true : document.hasFocus();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
  }

  function injectStyles() {
    if (document.getElementById('two-styles')) return;
    const style = document.createElement('style');
    style.id = 'two-styles';
    style.textContent = `
      .two-target-toolbar {
        display:flex; align-items:center; justify-content:space-between; gap:6px; width:100%; min-height:29px;
        box-sizing:border-box; padding:3px 6px; border-top:1px solid rgba(255,255,255,.08);
        border-bottom:1px solid rgba(0,0,0,.55); background:linear-gradient(to bottom,rgba(57,57,57,.98),rgba(38,38,38,.98));
        color:#d8d8d8; font-family:Arial,sans-serif; position:relative; z-index:25;
      }
      .two-mode-group { display:flex; flex-wrap:wrap; align-items:center; border:1px solid rgba(255,255,255,.15); border-radius:4px; overflow:hidden; background:rgba(0,0,0,.18); max-width:100%; }
      .two-mode-btn { appearance:none; -webkit-appearance:none; min-height:22px; margin:0; padding:2px 8px; border:0; border-right:1px solid rgba(255,255,255,.12); border-radius:0; background:transparent; color:#aaa; font:800 9px/1 Arial,sans-serif; letter-spacing:.25px; cursor:pointer; touch-action:manipulation; }
      .two-mode-btn:last-child { border-right:0; }
      .two-mode-btn.two-active { background:rgba(255,255,255,.13); color:#fff; box-shadow:inset 0 -2px 0 rgba(220,220,220,.65); }
      .two-target-toolbar.two-targets-mode .two-mode-btn[data-two-mode='targets'].two-active { color:#eaffd5; background:rgba(58,100,22,.45); box-shadow:inset 0 -2px 0 rgba(137,255,67,.90); }
      .two-toolbar-right { display:inline-flex; align-items:center; gap:8px; min-width:0; flex-wrap:wrap; justify-content:flex-end; }
      .two-history-key-btn { appearance:none; -webkit-appearance:none; margin:0; padding:2px 4px; min-height:18px; border-radius:3px; border:1px solid rgba(255,194,64,.62); background:rgba(83,61,8,.62); color:#ffe38a; font:800 7px/1 Arial,sans-serif; letter-spacing:.1px; cursor:pointer; touch-action:manipulation; }
      .two-history-key-btn[hidden] { display:none !important; }
      .two-sync-indicator { white-space:nowrap; padding:2px 4px; border-radius:3px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.20); font:800 7px/1 Arial,sans-serif; letter-spacing:.15px; font-variant-numeric:tabular-nums; }
      .two-sync-indicator.two-live { color:#c9ffa0; border-color:rgba(137,255,67,.45); background:rgba(37,70,17,.45); }
      .two-sync-indicator.two-syncing { color:#d7d7d7; }
      .two-sync-indicator.two-rate { color:#ffe38a; border-color:rgba(255,205,61,.55); background:rgba(83,61,8,.55); }
      .two-sync-indicator.two-error, .two-sync-indicator.two-key { color:#ffaaa0; border-color:rgba(255,95,78,.6); background:rgba(75,24,18,.58); }
      .two-target-counter { display:inline-flex; align-items:center; gap:9px; padding-right:2px; white-space:nowrap; font:800 10px/1 Arial,sans-serif; font-variant-numeric:tabular-nums; }
      .two-counter-item { display:inline-flex; align-items:center; gap:3px; min-width:22px; }
      .two-counter-dot { display:inline-block; width:7px; height:7px; flex:0 0 7px; border-radius:50%; }
      .two-counter-green { background:#8dff49; box-shadow:0 0 4px rgba(137,255,67,.55); }
      .two-counter-yellow { background:#ffd23f; box-shadow:0 0 4px rgba(255,205,61,.45); }
      .two-counter-number { color:#eee; }

      ul.members-list li.two-target-hidden { display:none !important; }
      ul.members-list li .member, ul.members-list li .status { position:relative !important; }

      .two-member-meta { position:absolute; right:4px; bottom:2px; z-index:20; display:inline-flex; align-items:center; justify-content:flex-end; gap:2px; max-width:94%; pointer-events:none; white-space:nowrap; }
      .two-attack-history { display:inline-flex; align-items:center; gap:2px; min-width:0; }
      .two-attack-dot { display:inline-block; width:6px; height:6px; flex:0 0 6px; border-radius:50%; box-shadow:0 0 0 1px rgba(0,0,0,.28), 0 0 3px rgba(0,0,0,.18); }
      .two-attack-dot.two-attack-win { background:#7dff57; }
      .two-attack-dot.two-attack-loss { background:#ff7468; }
      .two-attack-dot.two-attack-stalemate { background:#9a9a9a; }
      .two-intel-badge { position:relative; pointer-events:none; white-space:nowrap; box-sizing:border-box; padding:1px 3px; border-radius:3px; border:1px solid rgba(255,255,255,.18); background:rgba(18,18,18,.78); color:#cfcfcf; font:800 7.5px/1.15 Arial,sans-serif; font-variant-numeric:tabular-nums; letter-spacing:-.1px; box-shadow:0 1px 2px rgba(0,0,0,.35); }
      .two-intel-badge[hidden] { display:none !important; }
      .two-intel-badge.two-intel-proven { color:#d6ff9b; border-color:rgba(151,220,75,.62); background:rgba(28,48,13,.86); }
      .two-intel-badge.two-intel-likely { color:#e8f7b3; border-color:rgba(204,235,116,.55); background:rgba(54,63,22,.84); }
      .two-intel-badge.two-intel-risk { color:#ffb1a6; border-color:rgba(255,95,78,.62); background:rgba(75,24,18,.84); }
      .two-intel-badge.two-intel-changed { color:#ffd36a; border-color:rgba(255,193,64,.75); background:rgba(55,40,10,.88); }
      .two-intel-badge.two-intel-best { color:#fff7d1; border-color:rgba(255,224,102,.98); background:rgba(92,70,8,.96); box-shadow:0 0 6px rgba(255,214,64,.55),0 1px 2px rgba(0,0,0,.45); }
      ul.members-list li.two-best-target { outline:2px solid rgba(255,224,102,.92) !important; outline-offset:-2px; }
      ul.members-list li.two-best-target .member { box-shadow:inset 4px 0 0 rgba(255,224,102,1),inset 0 0 22px rgba(255,200,40,.14) !important; }
      .two-context-chip { white-space:nowrap; padding:2px 4px; border-radius:3px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.20); color:#d7d7d7; font:800 7px/1 Arial,sans-serif; letter-spacing:.15px; font-variant-numeric:tabular-nums; }
      .two-context-chip[hidden] { display:none !important; }
      .two-context-chip.two-chip-positive { color:#c9ffa0; border-color:rgba(137,255,67,.45); background:rgba(37,70,17,.45); }
      .two-context-chip.two-chip-negative { color:#ffaaa0; border-color:rgba(255,95,78,.55); background:rgba(75,24,18,.5); }
      .two-context-chip.two-chip-urgent { color:#ffe38a; border-color:rgba(255,205,61,.6); background:rgba(83,61,8,.55); }
      .two-context-chip.two-chip-bonus { color:#fff7d1; border-color:rgba(255,224,102,.95); background:rgba(92,70,8,.9); animation:two-chip-pulse 1s ease-in-out infinite alternate; }
      @keyframes two-chip-pulse { from{box-shadow:0 0 0 rgba(255,214,64,0)} to{box-shadow:0 0 6px rgba(255,214,64,.7)} }
      .two-age-badge { position:relative; pointer-events:none; white-space:nowrap; box-sizing:border-box; padding:1px 3px; border-radius:3px; border:1px solid rgba(255,255,255,.20); background:rgba(18,18,18,.78); color:#dedede; font:700 8px/1.15 Arial,sans-serif; letter-spacing:-.1px; box-shadow:0 1px 2px rgba(0,0,0,.35); }
      .two-activity-badge { position:relative; pointer-events:none; white-space:nowrap; box-sizing:border-box; padding:1px 3px; border-radius:3px; border:1px solid rgba(255,255,255,.15); background:rgba(18,18,18,.70); color:#aaa; font:700 7px/1.15 Arial,sans-serif; font-variant-numeric:tabular-nums; box-shadow:0 1px 2px rgba(0,0,0,.28); }
      .two-activity-badge.two-activity-online { color:#ff9d8e; border-color:rgba(255,95,78,.38); }
      .two-activity-badge.two-activity-idle { color:#e9d78c; border-color:rgba(232,202,94,.38); }
      .two-activity-badge.two-activity-offline { color:#bfc8d0; border-color:rgba(182,199,214,.34); }
      .two-activity-badge.two-target { color:#eaffd5; border-color:rgba(137,255,67,.72); background:rgba(42,82,12,.88); }
      .two-activity-badge.two-good { color:#fff0a8; border-color:rgba(255,205,61,.72); background:rgba(83,61,8,.88); }
      .two-age-badge.two-loading { opacity:.45; }
      .two-age-badge.two-estimate { border-style:dashed; }
      .two-age-badge.two-candidate { color:#e8f7b3; border-color:rgba(204,235,116,.58); background:rgba(54,63,22,.84); }
      .two-age-badge.two-young { color:#d6ff9b; border-color:rgba(151,220,75,.58); background:rgba(28,48,13,.84); }
      .two-age-badge.two-target { color:#efffd7; border-color:rgba(151,255,79,.98); background:rgba(42,82,12,.95); box-shadow:0 0 5px rgba(132,255,60,.50),0 1px 2px rgba(0,0,0,.45); }
      .two-age-badge.two-good { color:#fff0a8; border-color:rgba(255,205,61,.95); background:rgba(83,61,8,.95); box-shadow:0 0 4px rgba(255,196,45,.35),0 1px 2px rgba(0,0,0,.45); }

      ul.members-list li.two-good-target { outline:1px solid rgba(255,205,61,.76); outline-offset:-1px; }
      ul.members-list li.two-good-target .member { box-shadow:inset 4px 0 0 rgba(255,205,61,.92),inset 0 0 18px rgba(220,165,20,.09) !important; }
      ul.members-list li.two-good-target .attack a, ul.members-list li.two-good-target a[href*='loader.php?sid=attack'], ul.members-list li.two-good-target a[href*='attack'] { color:#ffd85a !important; font-weight:800 !important; text-shadow:0 0 4px rgba(255,196,45,.30); }

      ul.members-list li.two-ideal-target { outline:1px solid rgba(137,255,67,.78); outline-offset:-1px; }
      ul.members-list li.two-ideal-target .member { box-shadow:inset 4px 0 0 rgba(137,255,67,.95),inset 0 0 20px rgba(90,190,28,.10) !important; }
      ul.members-list li.two-ideal-target .attack a, ul.members-list li.two-ideal-target a[href*='loader.php?sid=attack'], ul.members-list li.two-ideal-target a[href*='attack'] { color:#baff76 !important; font-weight:800 !important; text-shadow:0 0 4px rgba(130,255,60,.40); }
      ul.members-list li.two-ideal-soon { animation:two-target-pulse 1.2s ease-in-out infinite alternate; }
      @keyframes two-target-pulse { from{outline-color:rgba(137,255,67,.55)} to{outline-color:rgba(205,255,151,1)} }
      ul.members-list li.two-due-target .status { box-shadow:inset 0 0 12px rgba(137,255,67,.08); }
      ul.members-list li.two-dom-ready .member { box-shadow:inset 4px 0 0 rgba(137,255,67,1),inset 0 0 24px rgba(90,190,28,.14) !important; }
      ul.members-list li.two-target-focus-flash { animation:two-focus-flash ${TARGET_FLASH_MS}ms ease-out 1 !important; }
      @keyframes two-focus-flash { 0%{box-shadow:0 0 0 3px rgba(255,255,255,.95),0 0 18px rgba(255,255,255,.55)} 100%{box-shadow:0 0 0 0 rgba(255,255,255,0),0 0 0 rgba(255,255,255,0)} }

      .two-hosp-badge { position:absolute; right:3px; bottom:2px; z-index:20; pointer-events:none; white-space:nowrap; box-sizing:border-box; min-width:27px; padding:1px 3px; border-radius:3px; border:1px solid rgba(255,95,78,.55); background:rgba(35,15,13,.82); color:#ff9b8f; text-align:center; font:800 9px/1.15 Arial,sans-serif; font-variant-numeric:tabular-nums; box-shadow:0 1px 2px rgba(0,0,0,.35); }
      .two-hosp-badge.two-provisional-badge { opacity:.62; border-style:dashed; }
      .two-hosp-badge.two-soon { color:#ffd36a; border-color:rgba(255,193,64,.80); background:rgba(55,40,10,.86); }
      .two-hosp-badge.two-watch-window { color:#fff0a8; border-color:rgba(255,205,61,.98); background:rgba(83,61,8,.95); box-shadow:0 0 4px rgba(255,196,45,.30),0 1px 2px rgba(0,0,0,.35); }
      .two-hosp-badge.two-now { color:#c6ff84; border-color:rgba(123,255,74,.95); background:rgba(36,72,10,.90); font-size:10px; }
      .two-hosp-badge.two-target-window { color:#e9ffd0; border-color:rgba(137,255,67,.98); background:rgba(42,82,12,.95); box-shadow:0 0 5px rgba(132,255,60,.42),0 1px 2px rgba(0,0,0,.35); }
      .two-hosp-badge.two-due { min-width:31px; letter-spacing:.1px; }
      .two-hosp-badge.two-volatile { border-style:dashed; }

      @media (max-width:600px) {
        .two-target-toolbar { min-height:27px; padding:3px 5px; gap:4px; }
        .two-mode-btn { min-height:21px; padding:2px 7px; font-size:8px; }
        .two-toolbar-right { gap:5px; }
        .two-history-key-btn { font-size:6px; padding:2px 3px; }
        .two-sync-indicator { font-size:6.5px; padding:2px 3px; }
        .two-target-counter { gap:7px; font-size:9px; }
        .two-member-meta { right:3px; bottom:2px; gap:1px; }
        .two-attack-history { gap:1px; }
        .two-attack-dot { width:5px; height:5px; flex-basis:5px; }
        .two-age-badge { font-size:7.5px; padding:1px 2px; }
        .two-activity-badge { font-size:6.5px; padding:1px 2px; }
        .two-intel-badge { font-size:7px; padding:1px 2px; }
        .two-context-chip { font-size:6.5px; padding:2px 3px; }
        .two-hosp-badge { right:2px; bottom:2px; min-width:25px; font-size:8px; padding:1px 2px; }
        .two-hosp-badge.two-now { font-size:9px; }
      }
    `;
    document.head.appendChild(style);
  }

  function scheduleScan(delayMs = 80) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanWarRows, Math.max(25, delayMs));
  }

  function installBodyDiscoveryObserver() {
    if (bodyObserver || !document.body || !isActiveView()) return;
    bodyObserver = new MutationObserver(mutations => {
      let shouldScan = rowsByUser.size === 0;
      if (!shouldScan) {
        for (const mutation of mutations) {
          for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
            if (!(node instanceof Element)) continue;
            if (node.matches?.('ul.members-list') || node.querySelector?.('ul.members-list')) {
              shouldScan = true;
              break;
            }
          }
          if (shouldScan) break;
        }
      }
      if (shouldScan) scheduleScan();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  function disconnectDiscoveryObservers() {
    if (bodyObserver) {
      bodyObserver.disconnect();
      bodyObserver = null;
    }
    for (const observer of listObservers.values()) observer.disconnect();
    listObservers.clear();
  }


  function cancelQueuedRender() {
    if (renderFrame != null) {
      try { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(renderFrame); } catch { /* no-op */ }
      try { clearTimeout(renderFrame); } catch { /* no-op */ }
    }
    renderFrame = null;
    fullRenderQueued = false;
  }

  function stopWatchdog() {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }

  function noteWatchdogRecovery(reason) {
    incStat('watchdogRecoveries');
    lastWatchdogRecoveryAt = Date.now();
    console.warn(`[${SCRIPT}] Watchdog recovery: ${reason}`);
  }

  function watchdogTick() {
    watchdogTimer = null;
    if (!isActiveView()) return;

    let recovered = false;
    const connectedRows = Array.from(rowsByUser.values()).some(rows => rows.some(row => row?.li?.isConnected));
    if (rowsByUser.size === 0 || !connectedRows) {
      scheduleScan(50);
      noteWatchdogRecovery('row discovery');
      recovered = true;
    }

    if (!bodyObserver) {
      installBodyDiscoveryObserver();
      if (!recovered) noteWatchdogRecovery('DOM observer');
      recovered = true;
    }

    if (!countdownTimer) {
      scheduleCountdownTick();
      if (!recovered) noteWatchdogRecovery('countdown timer');
      recovered = true;
    }

    if (activeFactionId && !factionRefreshInFlight && !apiPermanentlyDisabled && Date.now() >= globalBackoffUntil) {
      const staleMs = lastFreshSnapshotPerfAt > 0 ? monotonicNowMs() - lastFreshSnapshotPerfAt : Number.POSITIVE_INFINITY;
      const severelyStale = staleMs > STATUS_TRUST_MAX_AGE_MS + WATCHDOG_STALE_GRACE_MS;
      if (severelyStale || !factionRefreshTimer) {
        refreshFactionMembers();
        if (!recovered) noteWatchdogRecovery(severelyStale ? 'stale faction snapshot' : 'faction timer');
        recovered = true;
      }
    }

    if (activeFactionId && attackHistoryFeatureState !== 'unsupported' && !attackRefreshInFlight && !attackRefreshTimer) {
      scheduleAttackRefresh(1_000);
      if (!recovered) noteWatchdogRecovery('attack-history timer');
    }

    watchdogTimer = setTimeout(watchdogTick, WATCHDOG_INTERVAL_MS);
  }

  function startWatchdog() {
    stopWatchdog();
    if (!isActiveView()) return;
    watchdogTimer = setTimeout(watchdogTick, WATCHDOG_INTERVAL_MS);
  }

  function pauseForegroundWork() {
    incStat('pauseCount');
    lifecycleGeneration += 1;
    clearFactionRefreshTimer();
    clearAttackRefreshTimer();
    stopCountdownTimer();
    stopWatchdog();
    cancelQueuedRender();
    disconnectDiscoveryObservers();
    // Never trust a pre-background snapshot for target highlighting on resume. Preserve its context for display, but require a fresh API confirmation.
    factionLiveReady = false;
    lastRenderedTrustState = false;
    if (!apiPermanentlyDisabled) { apiHealth = 'syncing'; apiHealthDetail = ''; }
    // Only focused-page evidence is ephemeral. Preserve war context and attack history so resume is fast and stable.
    domStatusOverrideByUser.clear();
    lastHospitalDisplayByUser.clear();
    lastActivityDisplayByUser.clear();
  }

  function resumeForegroundWork() {
    if (!isActiveView()) return;
    // Desktop focus/visibility/pageshow events arrive in bursts; coalesce them so one resume costs one API round.
    if (resumeTimer) return;
    resumeTimer = setTimeout(() => {
      resumeTimer = null;
      if (isActiveView()) performResume();
    }, RESUME_DEBOUNCE_MS);
  }

  function performResume() {
    incStat('resumeCount');
    lifecycleGeneration += 1;
    installBodyDiscoveryObserver();
    scheduleScan();
    lastRenderedSignatureByUser.clear();
    renderAll();
    scheduleCountdownTick();
    if (activeFactionId) {
      // performance.now() can freeze while a mobile webview is suspended, so the wall clock must agree before a snapshot is reused.
      const snapshotAgePerfMs = lastFreshSnapshotPerfAt > 0 ? monotonicNowMs() - lastFreshSnapshotPerfAt : Number.POSITIVE_INFINITY;
      const snapshotAgeWallMs = lastFreshSnapshotAt > 0 ? Date.now() - lastFreshSnapshotAt : Number.POSITIVE_INFINITY;
      if (snapshotAgePerfMs <= RESUME_SNAPSHOT_REUSE_MS && snapshotAgeWallMs <= RESUME_SNAPSHOT_REUSE_MS && !apiPermanentlyDisabled && Date.now() >= globalBackoffUntil) {
        // A snapshot fetched moments before a quick blur/focus flip is fresher than the normal poll; re-trust it without re-stamping its age.
        factionLiveReady = true;
        apiHealth = 'live';
        apiHealthDetail = '';
        scheduleFactionRefresh();
        renderAll();
      } else {
        refreshFactionMembers();
      }
      if (attackHistoryFeatureState !== 'unsupported') refreshRecentAttacks();
    }
    if (hotProfileQueue.length > 0 || coldProfileQueue.length > 0) runProfileWorker();
    startWatchdog();
  }

  function flushPersistentState() {
    clearTimeout(signupSaveTimer);
    signupSaveTimer = null;
    saveJson(SIGNUP_CACHE_STORAGE, signupCache);
    flushFactionStatusCache();
    persistAttackHistory();
    flushOpponentIntel();
  }

  function runSelfTests() {
    const faults = [];
    try {
      if (sanitizeSettings({ maxLevel: null }).maxLevel !== null) faults.push('nullable maxLevel');
      const thresholds = sanitizeSettings({ greenHospitalSec: 300, yellowHospitalSec: 30 });
      if (thresholds.yellowHospitalSec < thresholds.greenHospitalSec) faults.push('threshold ordering');
      if (classifyAttackResult('Lost').kind !== 'loss') faults.push('loss mapping');
      if (classifyAttackResult('Stalemate').kind !== 'stalemate') faults.push('stalemate mapping');
      if (classifyAttackResult('Mugged').kind !== 'win') faults.push('win mapping');
      if (classifyAttackResult('Assist').kind !== 'stalemate') faults.push('assist mapping');
      if (LOAD_OLD_EXACT_AGES_SLOWLY !== false) faults.push('old-age API suppression');
      if (!(STATUS_REFRESH_ACTIVE_MS <= STATUS_REFRESH_WATCH_MS && STATUS_REFRESH_WATCH_MS <= STATUS_REFRESH_IDLE_MS)) faults.push('adaptive polling order');
      if (!(WATCHDOG_INTERVAL_MS > 0 && WATCHDOG_STALE_GRACE_MS >= 0)) faults.push('watchdog constants');
      if (!(REQUEST_TIMEOUT_MS > STATUS_REFRESH_ACTIVE_MS)) faults.push('request timeout budget');
      const fakeKeyInfo = { info: { selections: { user: ['profile', 'attacks', 'battlestats'] } } };
      if (!keyInfoAllowsUserSelection(fakeKeyInfo, 'attacks')) faults.push('key capability parsing');
      const testScope = makeWarAttackScope(123, { id: 456, start: 1000 });
      if (testScope.key !== 'war:456:enemy:123' || testScope.from !== 1000) faults.push('war attack scope');
      if (getStatusUntil({ until: null }) !== null || getStatusUntil({ until: 0 }) !== null || getStatusUntil({ until: 1700000000 }) !== 1700000000) faults.push('nullable hospital until');
      if (baseRespectForLevel(1) !== 1 || baseRespectForLevel(100) !== 1.5 || baseRespectForLevel(60) !== 1.3) faults.push('base respect formula');
      if (chainScaleForHit(10) !== 1 || Math.abs(chainScaleForHit(100) - 1.25) > 1e-9 || Math.abs(chainScaleForHit(1000) - 1.5) > 1e-9) faults.push('chain scale formula');
      if (!isChainBonusHit(250) || isChainBonusHit(251)) faults.push('chain bonus table');
      if (battleStatScore(100, 100, 100, 100) !== 40) faults.push('battle stat score');
      if (fairFightFromScores(30, 40) !== 3 || Math.abs(fairFightFromScores(15, 40) - 2) > 1e-9) faults.push('fair fight formula');
      if (Math.abs(defenderScoreFromFairFight(2, 40) - 15) > 1e-9) faults.push('fair fight inversion');
      const normalized = normalizeAttack({ id: 9, started: 100, ended: 160, defender: { id: 7, level: 60, faction: { id: 5 } }, result: 'Hospitalized', respect_gain: 5.2, chain: null, is_ranked_war: true, modifiers: { fair_fight: 2.71, war: 2 } });
      if (!normalized || normalized.ff !== 2.71 || normalized.chain !== null || normalized.defenderFactionId !== 5 || normalized.outcome.kind !== 'win' || !normalized.isRankedWar) faults.push('attack normalization');
      const decayInfo = getWarDecayInfo({ start: Math.floor(serverNowSec()) - 3600 });
      if (!decayInfo || decayInfo.started) faults.push('war decay timing');

      // Intel model scenarios (synthetic records, no store access).
      const nowSec = Math.floor(Date.now() / 1000);
      const sample = (offsetSec, kind, extra = {}) => ({ t: nowSec - offsetSec, k: kind, s: 6, f: 2.71, c: null, w: 2, rw: 1, ...extra });
      const unknown = deriveOpponentIntel(null, { level: 60 });
      if (unknown.label !== 'UNKNOWN' || unknown.ev !== null || unknown.ffLabel !== '') faults.push('intel unknown state');
      const proven = deriveOpponentIntel({ w: 3, l: 0, n: 0, r: [sample(10, 'win'), sample(20, 'win'), sample(30, 'win')], ff: 2.71, ffAt: nowSec - 10 }, { level: 60, chainSnapshot: { nextHit: 1 } });
      if (proven.label !== 'PROVEN' || proven.ff !== 2.71 || proven.scoreSource !== 'model') faults.push('intel proven state');
      if (Math.abs(proven.expectedScore - 1.3 * 2 * 2.71) > 1e-9) faults.push('intel expected score');
      if (Math.abs(proven.winProb - (3 + 2 * 0.7) / 5) > 1e-9 || Math.abs(proven.ev - proven.winProb * proven.expectedScore) > 1e-9) faults.push('intel win probability');
      const risk = deriveOpponentIntel({ w: 1, l: 1, n: 0, r: [sample(10, 'loss'), sample(20, 'win')] }, { level: 60 });
      if (risk.label !== 'RISK') faults.push('intel risk state');
      const changed = deriveOpponentIntel({ w: 5, l: 2, n: 0, r: [sample(10, 'loss'), sample(20, 'loss'), sample(30, 'win'), sample(40, 'win'), sample(50, 'win'), sample(60, 'win'), sample(70, 'win')] }, { level: 60 });
      if (changed.label !== 'CHANGED') faults.push('intel changed state');
      const capped = deriveOpponentIntel({ w: 0, l: 0, n: 0, r: [], ff: 3, ffAt: nowSec - 10, bss: 30, bssAt: nowSec - 10, bssCap: true }, { level: 60, ownBss: 40 });
      if (capped.label !== 'RISK' || !capped.ffCapped || capped.ff !== 3) faults.push('intel capped fair fight');
      const projected = deriveOpponentIntel({ w: 1, l: 0, n: 0, r: [sample(10, 'win', { f: 2 })], ff: 2, ffAt: nowSec - 10, bss: 15, bssAt: nowSec - 10, bssCap: false }, { level: 60, ownBss: 80 });
      if (projected.ffSource !== 'model' || Math.abs(projected.ff - 1.5) > 1e-9 || projected.label !== 'LIKELY') faults.push('intel fair fight projection');
      const stale = deriveOpponentIntel({ w: 3, l: 0, n: 0, r: [sample(200 * 86400, 'win')], ff: 2.5, ffAt: nowSec - 200 * 86400 }, { level: 60 });
      if (stale.samples !== 0 || stale.ff !== null || stale.label !== 'UNKNOWN') faults.push('intel stale discounting');
      const observedOnly = deriveOpponentIntel({ w: 2, l: 0, n: 0, r: [sample(10, 'win', { f: null, s: 4 }), sample(20, 'win', { f: null, s: 8 })] }, { level: null });
      if (observedOnly.scoreSource !== 'observed' || observedOnly.expectedScore !== 8) faults.push('intel observed score fallback');
      const debugText = JSON.stringify(getDiagnosticSnapshot());
      if (debugText.includes(String(apiKey || '___never___')) && apiKey) faults.push('diagnostic key leak');
      const before = apiPermanentlyDisabled;
      const keyClass = classifyApiError(1, 200, 'test');
      if (!keyClass.permanentKeyError || apiPermanentlyDisabled !== before) faults.push('pure key error classification');
    } catch (err) {
      faults.push(`self-test exception: ${err?.message || err}`);
    }
    return faults;
  }

  function installNavigationHooks() {
    const onNavigation = () => setTimeout(() => {
      if (!isActiveView()) return;
      scheduleScan();
      installBodyDiscoveryObserver();
    }, 0);

    window.addEventListener('popstate', onNavigation);
    window.addEventListener('hashchange', onNavigation);
    try {
      if (typeof navigation !== 'undefined' && typeof navigation.addEventListener === 'function') {
        navigation.addEventListener('navigate', onNavigation);
      }
    } catch { /* Navigation API is optional. */ }

    for (const method of ['pushState', 'replaceState']) {
      try {
        const original = history[method];
        if (typeof original !== 'function' || original.__twoWrapped) continue;
        const wrapped = function(...args) {
          const result = original.apply(this, args);
          onNavigation();
          return result;
        };
        wrapped.__twoWrapped = true;
        history[method] = wrapped;
      } catch { /* History wrapping is best-effort; the DOM observer remains the fallback. */ }
    }
  }

  async function init() {
    injectStyles();
    prunePersistentCaches();
    selfTestFaults = runSelfTests();
    if (selfTestFaults.length) console.error(`[${SCRIPT}] Internal self-test failures`, selfTestFaults);
    apiKey = getStoredApiKey();
    attackApiKey = getStoredAttackApiKey();

    if (!apiKey) {
      if (!isPdaKey(PDA_API_KEY)) setManualApiKey();
      apiKey = getStoredApiKey();
      if (!apiKey) return;
    }

    installNavigationHooks();
    try { window.__TWO_DIAGNOSTICS__ = getDiagnosticSnapshot; } catch { /* optional debug hook */ }

    // Capability discovery is non-blocking; the main overlay does not depend on it.
    ensurePrimaryKeyInfo()
      .then(() => {
        if (activeFactionId) {
          refreshWarContext(activeFactionId, { force: true }).then(() => refreshRecentAttacks());
        }
      })
      .catch(err => console.warn(`[${SCRIPT}] Could not inspect primary key capabilities.`, err));

    if (isActiveView()) {
      scanWarRows();
      installBodyDiscoveryObserver();
      scheduleCountdownTick();
      startWatchdog();
    }

    document.addEventListener('visibilitychange', () => {
      if (isActiveView()) resumeForegroundWork();
      else pauseForegroundWork();
    });

    window.addEventListener('focus', () => resumeForegroundWork());
    window.addEventListener('blur', () => {
      if (!isActiveView()) pauseForegroundWork();
    });

    window.addEventListener('pagehide', () => {
      pauseForegroundWork();
      flushPersistentState();
    });
    window.addEventListener('pageshow', () => resumeForegroundWork());
  }

  init().catch(err => console.error(`[${SCRIPT}] Initialization failed`, err));
})();
