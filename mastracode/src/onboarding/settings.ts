/**
 * Persistent global settings stored in the app data directory as settings.json.
 * This file persists onboarding state AND user preferences (model choices, yolo, etc.)
 * so they carry across threads and restarts.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { MastraBrowser } from '@mastra/core/browser';
import type { LSPConfig } from '@mastra/core/workspace';
import { getAppDataDir } from '../utils/project.js';

/** A saved custom pack — user-defined model selections for each mode. */
export interface CustomPack {
  name: string;
  models: Record<string, string>;
  createdAt: string;
}

/** A saved custom provider for OpenAI-compatible endpoints. */
export interface CustomProviderSetting {
  name: string;
  url: string;
  apiKey?: string;
  models: string[];
}

/** Storage backend type. */
export type StorageBackend = 'libsql' | 'pg';

/** LibSQL-specific storage settings. */
export interface LibSQLStorageSettings {
  url?: string;
  authToken?: string;
}

/** PostgreSQL-specific storage settings. */
export interface PgStorageSettings {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  schemaName?: string;
  disableInit?: boolean;
  skipDefaultIndexes?: boolean;
}

/** Storage configuration persisted in global settings. */
export interface StorageSettings {
  /** Which backend to use. Default: 'libsql'. */
  backend: StorageBackend;
  /** LibSQL-specific config (used when backend is 'libsql'). */
  libsql: LibSQLStorageSettings;
  /** PostgreSQL-specific config (used when backend is 'pg'). */
  pg: PgStorageSettings;
}

/** Memory gateway provider key used in AuthStorage. */
export const MEMORY_GATEWAY_PROVIDER = 'mastra-gateway';

/** Default gateway URL. */
export const MEMORY_GATEWAY_DEFAULT_URL = 'https://gateway-api.mastra.ai';

/** Valid persisted thinking level values. */
export type ThinkingLevelSetting = 'off' | 'low' | 'medium' | 'high' | 'xhigh';

/** Browser provider type. */
export type BrowserProvider = 'stagehand' | 'agent-browser';

/** Stagehand environment type. */
export type StagehandEnv = 'LOCAL' | 'BROWSERBASE';

/** Stagehand-specific browser settings. */
export interface StagehandSettings {
  env: StagehandEnv;
  apiKey?: string;
  projectId?: string;
}

/** Browser configuration persisted in global settings. */
export interface BrowserSettings {
  /** Whether browser automation is enabled. */
  enabled: boolean;
  /** Which browser provider to use. */
  provider: BrowserProvider;
  /** Whether to run headless (no visible browser window). */
  headless: boolean;
  /** Browser viewport dimensions. */
  viewport?: { width: number; height: number };
  /** CDP URL for connecting to an existing browser. */
  cdpUrl?: string;
  /** Stagehand-specific settings. */
  stagehand?: StagehandSettings;
}

export interface GlobalSettings {
  // Onboarding tracking
  onboarding: {
    completedAt: string | null;
    skippedAt: string | null;
    version: number;
    modePackId: string | null;
    omPackId: string | null;
  };
  // Global model preferences (applied to new threads)
  models: {
    /**
     * Active model pack ID. Built-in packs use their id directly ("anthropic",
     * "openai"). Custom packs use "custom:<name>".
     * When set, models are resolved from the pack at startup so pack updates
     * (e.g. new model versions) apply automatically.
     * Cleared when the user manually overrides via /models (falls back to modeDefaults).
     */
    activeModelPackId: string | null;
    /** Explicit per-mode overrides — used when no activeModelPackId is set. */
    modeDefaults: Record<string, string>;
    /**
     * Active OM pack ID (e.g. "gemini", "anthropic", "custom").
     * When set, the OM model is resolved from the pack at startup so pack
     * updates (e.g. new model versions) apply automatically.
     * Cleared when the user manually overrides via /om (falls back to omModelOverride).
     */
    activeOmPackId: string | null;
    /** Explicit OM model override — used for custom OM pack or /om manual changes. */
    omModelOverride: string | null;
    /** Default OM observation threshold used for new threads unless overridden per-thread. */
    omObservationThreshold: number | null;
    /** Default OM reflection threshold used for new threads unless overridden per-thread. */
    omReflectionThreshold: number | null;
    /** Per-agent-type subagent model overrides (e.g. { explore: "openai/gpt-5.1-codex-mini" }) */
    subagentModels: Record<string, string>;
  };
  // Global behavior preferences
  preferences: {
    yolo: boolean | null;
    theme: 'auto' | 'dark' | 'light';
    /** Default reasoning effort level used for all threads/models unless overridden in-session. */
    thinkingLevel: ThinkingLevelSetting;
    /** When true, components like subagent output collapse to compact summaries on completion. */
    quietMode: boolean;
  };
  // Storage backend configuration
  storage: StorageSettings;
  // User-created custom model packs
  customModelPacks: CustomPack[];
  // User-created custom providers with custom models
  customProviders: CustomProviderSetting[];
  // Model usage counts for ranking in the selector
  modelUseCounts: Record<string, number>;
  // Version the user dismissed the update prompt for (skip until they manually update past this)
  updateDismissedVersion: string | null;
  // Memory gateway configuration
  memoryGateway: { baseUrl?: string };
  // LSP configuration forwarded to the workspace
  lsp?: LSPConfig;
  // Browser automation configuration
  browser: BrowserSettings;
}

export const STORAGE_DEFAULTS: StorageSettings = {
  backend: 'libsql',
  libsql: {},
  pg: {},
};

const DEFAULTS: GlobalSettings = {
  onboarding: {
    completedAt: null,
    skippedAt: null,
    version: 0,
    modePackId: null,
    omPackId: null,
  },
  models: {
    activeModelPackId: null,
    modeDefaults: {},
    activeOmPackId: null,
    omModelOverride: null,
    omObservationThreshold: null,
    omReflectionThreshold: null,
    subagentModels: {},
  },
  preferences: {
    yolo: null,
    theme: 'auto',
    thinkingLevel: 'off',
    quietMode: false,
  },
  storage: { ...STORAGE_DEFAULTS },
  customModelPacks: [],
  customProviders: [],
  modelUseCounts: {},
  updateDismissedVersion: null,
  memoryGateway: {},
  lsp: {},
  browser: {
    enabled: false,
    provider: 'stagehand',
    headless: false,
    viewport: { width: 1280, height: 720 },
    stagehand: { env: 'LOCAL' },
  },
};

const THINKING_LEVEL_VALUES: ThinkingLevelSetting[] = ['off', 'low', 'medium', 'high', 'xhigh'];

function parseThinkingLevel(value: unknown): ThinkingLevelSetting {
  return typeof value === 'string' && THINKING_LEVEL_VALUES.includes(value as ThinkingLevelSetting)
    ? (value as ThinkingLevelSetting)
    : DEFAULTS.preferences.thinkingLevel;
}

function parsePreferences(rawPreferences: unknown): GlobalSettings['preferences'] {
  const raw = rawPreferences && typeof rawPreferences === 'object' ? (rawPreferences as Record<string, unknown>) : {};

  return {
    ...DEFAULTS.preferences,
    ...raw,
    thinkingLevel: parseThinkingLevel(raw.thinkingLevel),
  };
}

export function getSettingsPath(): string {
  return join(getAppDataDir(), 'settings.json');
}

export function getCustomProviderId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'provider';
}

export function toCustomProviderModelId(providerName: string, modelName: string): string {
  const providerId = getCustomProviderId(providerName);
  const trimmedModelName = modelName.trim();
  const providerPrefix = `${providerId}/`;
  if (trimmedModelName.startsWith(providerPrefix)) {
    return trimmedModelName;
  }
  return `${providerId}/${trimmedModelName}`;
}

export function parseCustomProviders(rawProviders: unknown): CustomProviderSetting[] {
  if (!Array.isArray(rawProviders)) return [];

  const parsedProviders: CustomProviderSetting[] = [];
  for (const rawProvider of rawProviders) {
    if (!rawProvider || typeof rawProvider !== 'object') continue;

    const candidate = rawProvider as Record<string, unknown>;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const url = typeof candidate.url === 'string' ? candidate.url.trim() : '';
    if (!name || !url) continue;

    const providerId = getCustomProviderId(name);
    const models = Array.isArray(candidate.models)
      ? [
          ...new Set(
            candidate.models
              .filter((model): model is string => typeof model === 'string')
              .map(model => model.trim())
              .map(model => {
                const providerPrefix = `${providerId}/`;
                if (model.startsWith(providerPrefix)) {
                  return model.slice(providerPrefix.length);
                }
                return model;
              }),
          ),
        ].filter(model => model.length > 0)
      : [];

    const apiKey =
      typeof candidate.apiKey === 'string' && candidate.apiKey.trim().length > 0 ? candidate.apiKey.trim() : undefined;

    parsedProviders.push({
      name,
      url,
      ...(apiKey ? { apiKey } : {}),
      models,
    });
  }

  return parsedProviders;
}

const BROWSER_PROVIDERS = new Set<BrowserProvider>(['stagehand', 'agent-browser']);
const STAGEHAND_ENVS = new Set<StagehandEnv>(['LOCAL', 'BROWSERBASE']);

/**
 * Deep-merge and validate browser settings from JSON.
 * Explicitly validates types to handle malformed settings.json gracefully.
 */
function parseBrowserSettings(rawBrowser: unknown): BrowserSettings {
  const raw = rawBrowser && typeof rawBrowser === 'object' ? (rawBrowser as Record<string, unknown>) : {};
  const rawViewport = raw.viewport && typeof raw.viewport === 'object' ? (raw.viewport as Record<string, unknown>) : {};
  const rawStagehand =
    raw.stagehand && typeof raw.stagehand === 'object' ? (raw.stagehand as Record<string, unknown>) : {};

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULTS.browser.enabled,
    provider:
      typeof raw.provider === 'string' && BROWSER_PROVIDERS.has(raw.provider as BrowserProvider)
        ? (raw.provider as BrowserProvider)
        : DEFAULTS.browser.provider,
    headless: typeof raw.headless === 'boolean' ? raw.headless : DEFAULTS.browser.headless,
    cdpUrl: typeof raw.cdpUrl === 'string' && raw.cdpUrl.trim() ? raw.cdpUrl.trim() : undefined,
    viewport: {
      width: typeof rawViewport.width === 'number' ? rawViewport.width : DEFAULTS.browser.viewport!.width,
      height: typeof rawViewport.height === 'number' ? rawViewport.height : DEFAULTS.browser.viewport!.height,
    },
    stagehand: {
      env:
        typeof rawStagehand.env === 'string' && STAGEHAND_ENVS.has(rawStagehand.env as StagehandEnv)
          ? (rawStagehand.env as StagehandEnv)
          : DEFAULTS.browser.stagehand!.env,
      ...(typeof rawStagehand.apiKey === 'string' && rawStagehand.apiKey.trim()
        ? { apiKey: rawStagehand.apiKey.trim() }
        : {}),
      ...(typeof rawStagehand.projectId === 'string' && rawStagehand.projectId.trim()
        ? { projectId: rawStagehand.projectId.trim() }
        : {}),
    },
  };
}

/**
 * One-time migration: move model-related data from auth.json to settings.json.
 * Reads `_modelRanks`, `_modeModelId_*`, `_subagentModelId*` from auth.json,
 * merges them into settings, removes them from auth.json, and writes both files.
 * No-ops if auth.json has no _ prefixed model data.
 */
function migrateFromAuth(settingsPath: string): boolean {
  const authPath = join(getAppDataDir(), 'auth.json');
  if (!existsSync(authPath)) return false;

  let authData: Record<string, any>;
  try {
    authData = JSON.parse(readFileSync(authPath, 'utf-8'));
  } catch {
    return false;
  }

  const modelKeys = Object.keys(authData).filter(k => k.startsWith('_'));
  if (modelKeys.length === 0) return false;

  // Load existing settings (or defaults) and merge auth data into it
  let settings: GlobalSettings;
  if (existsSync(settingsPath)) {
    try {
      const raw = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      settings = {
        onboarding: { ...DEFAULTS.onboarding, ...raw.onboarding },
        models: { ...DEFAULTS.models, ...raw.models },
        preferences: parsePreferences(raw.preferences),
        storage: {
          ...STORAGE_DEFAULTS,
          ...raw.storage,
          libsql: { ...STORAGE_DEFAULTS.libsql, ...raw.storage?.libsql },
          pg: { ...STORAGE_DEFAULTS.pg, ...raw.storage?.pg },
        },
        customModelPacks: Array.isArray(raw.customModelPacks) ? raw.customModelPacks : [],
        customProviders: parseCustomProviders(raw.customProviders),
        modelUseCounts: raw.modelUseCounts && typeof raw.modelUseCounts === 'object' ? raw.modelUseCounts : {},
        updateDismissedVersion: typeof raw.updateDismissedVersion === 'string' ? raw.updateDismissedVersion : null,
        memoryGateway: raw.memoryGateway && typeof raw.memoryGateway === 'object' ? raw.memoryGateway : {},
        lsp: raw.lsp && typeof raw.lsp === 'object' ? (raw.lsp as LSPConfig) : undefined,
        browser: parseBrowserSettings(raw.browser),
      };
    } catch {
      settings = structuredClone(DEFAULTS);
    }
  } else {
    settings = structuredClone(DEFAULTS);
  }

  // Migrate model use counts (only if settings doesn't already have them)
  if (authData._modelRanks && typeof authData._modelRanks === 'object') {
    settings.modelUseCounts = { ...authData._modelRanks, ...settings.modelUseCounts };
  }

  // Migrate per-mode model defaults (don't overwrite existing settings)
  for (const key of modelKeys) {
    const modeMatch = key.match(/^_modeModelId_(.+)$/);
    if (modeMatch?.[1] && typeof authData[key] === 'string' && !settings.models.modeDefaults[modeMatch[1]]) {
      settings.models.modeDefaults[modeMatch[1]] = authData[key];
    }
  }

  // Migrate subagent models (don't overwrite existing settings)
  for (const key of modelKeys) {
    if (key === '_subagentModelId' && typeof authData[key] === 'string' && !settings.models.subagentModels['default']) {
      settings.models.subagentModels['default'] = authData[key];
    }
    const saMatch = key.match(/^_subagentModelId_(.+)$/);
    if (saMatch?.[1] && typeof authData[key] === 'string' && !settings.models.subagentModels[saMatch[1]]) {
      settings.models.subagentModels[saMatch[1]] = authData[key];
    }
  }

  // Write migrated settings
  saveSettings(settings, settingsPath);

  // Clean up auth.json — remove _ prefixed keys
  for (const key of modelKeys) {
    delete authData[key];
  }
  try {
    writeFileSync(authPath, JSON.stringify(authData, null, 2), 'utf-8');
  } catch {
    // Non-fatal — settings are saved, auth cleanup can fail
  }

  return true;
}

const LEGACY_VARIED_MODELS: Record<string, string> = {
  plan: 'openai/gpt-5.4',
  build: 'anthropic/claude-sonnet-4-5',
  fast: 'anthropic/claude-haiku-4-5',
};

export function migrateLegacyVariedPack(settings: GlobalSettings): boolean {
  const legacyPackId = 'varied';
  const customPackId = 'custom:varied';
  const hasLegacyReference =
    settings.models.activeModelPackId === legacyPackId || settings.onboarding.modePackId === legacyPackId;

  if (!hasLegacyReference) return false;

  const existingIdx = settings.customModelPacks.findIndex(p => p.name === 'varied');
  if (existingIdx >= 0) {
    const existing = settings.customModelPacks[existingIdx]!;
    const modelsMatch = Object.entries(LEGACY_VARIED_MODELS).every(([k, v]) => existing.models[k] === v);
    if (!modelsMatch) {
      existing.models = { ...LEGACY_VARIED_MODELS };
    }
  } else {
    settings.customModelPacks.push({
      name: 'varied',
      models: { ...LEGACY_VARIED_MODELS },
      createdAt: new Date().toISOString(),
    });
  }

  if (settings.models.activeModelPackId === legacyPackId) {
    settings.models.activeModelPackId = customPackId;
    if (Object.keys(settings.models.modeDefaults).length === 0) {
      settings.models.modeDefaults = { ...LEGACY_VARIED_MODELS };
    }
  }

  if (settings.onboarding.modePackId === legacyPackId) {
    settings.onboarding.modePackId = customPackId;
  }

  return true;
}

export function loadSettings(filePath: string = getSettingsPath()): GlobalSettings {
  // One-time migration: move model data from auth.json into settings.json
  migrateFromAuth(filePath);

  if (!existsSync(filePath)) return structuredClone(DEFAULTS);
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    // Spread raw first to preserve unknown top-level keys (forward-compatibility),
    // then overlay with parsed/typed fields so known keys are always correct.
    const settings: GlobalSettings = {
      ...raw,
      onboarding: { ...DEFAULTS.onboarding, ...raw.onboarding },
      models: { ...DEFAULTS.models, ...raw.models },
      preferences: parsePreferences(raw.preferences),
      storage: {
        ...STORAGE_DEFAULTS,
        ...raw.storage,
        libsql: { ...STORAGE_DEFAULTS.libsql, ...raw.storage?.libsql },
        pg: { ...STORAGE_DEFAULTS.pg, ...raw.storage?.pg },
      },
      customModelPacks: Array.isArray(raw.customModelPacks) ? raw.customModelPacks : [],
      customProviders: parseCustomProviders(raw.customProviders),
      modelUseCounts: raw.modelUseCounts && typeof raw.modelUseCounts === 'object' ? raw.modelUseCounts : {},
      updateDismissedVersion: typeof raw.updateDismissedVersion === 'string' ? raw.updateDismissedVersion : null,
      memoryGateway: raw.memoryGateway && typeof raw.memoryGateway === 'object' ? raw.memoryGateway : {},
      lsp: raw.lsp && typeof raw.lsp === 'object' ? (raw.lsp as LSPConfig) : undefined,
      browser: parseBrowserSettings(raw.browser),
    };

    // Migrate legacy omModelId → omModelOverride
    let settingsChanged = false;
    if (raw.models?.omModelId && !settings.models.omModelOverride) {
      settings.models.omModelOverride = raw.models.omModelId;
      settingsChanged = true;
    }

    if (migrateLegacyVariedPack(settings)) {
      settingsChanged = true;
    }

    if (settingsChanged) {
      saveSettings(settings, filePath);
    }

    return settings;
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const THREAD_ACTIVE_MODEL_PACK_ID_KEY = 'activeModelPackId';

export interface ThreadSettings {
  activeModelPackId: string | null;
  modeModelIds: Record<string, string>;
}

export function parseThreadSettings(metadata: Record<string, unknown> | undefined): ThreadSettings {
  const modeModelIds: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    const modeMatch = key.match(/^modeModelId_(.+)$/);
    if (modeMatch?.[1] && typeof value === 'string' && value.length > 0) {
      modeModelIds[modeMatch[1]] = value;
    }
  }

  const rawPackId = metadata?.[THREAD_ACTIVE_MODEL_PACK_ID_KEY];
  const activeModelPackId = typeof rawPackId === 'string' && rawPackId.length > 0 ? rawPackId : null;

  return {
    activeModelPackId,
    modeModelIds,
  };
}

/**
 * Resolve active model pack id for the current thread.
 *
 * Priority:
 * 1) explicit thread metadata activeModelPackId
 * 2) inferred from thread modeModelId_* values
 * 3) global settings.models.activeModelPackId
 */
export function resolveThreadActiveModelPackId(
  settings: GlobalSettings,
  builtinPacks: Array<{ id: string; models: Record<string, string> }>,
  metadata: Record<string, unknown> | undefined,
): string | null {
  const threadSettings = parseThreadSettings(metadata);

  const isKnownPack = (packId: string): boolean => {
    if (packId.startsWith('custom:')) {
      const name = packId.slice('custom:'.length);
      return settings.customModelPacks.some(p => p.name === name);
    }
    return builtinPacks.some(p => p.id === packId);
  };

  if (threadSettings.activeModelPackId && isKnownPack(threadSettings.activeModelPackId)) {
    return threadSettings.activeModelPackId;
  }

  const allPacks: Array<{ id: string; models: Record<string, string> }> = [
    ...builtinPacks,
    ...settings.customModelPacks.map(p => ({ id: `custom:${p.name}`, models: p.models })),
  ];

  for (const pack of allPacks) {
    const packEntries = Object.entries(pack.models);
    const threadEntries = Object.keys(threadSettings.modeModelIds);
    const matches =
      packEntries.length === threadEntries.length &&
      packEntries.every(([modeId, modelId]) => threadSettings.modeModelIds[modeId] === modelId);
    if (matches) return pack.id;
  }

  if (settings.models.activeModelPackId && isKnownPack(settings.models.activeModelPackId)) {
    return settings.models.activeModelPackId;
  }

  return null;
}

/**
 * Resolve effective per-mode model defaults.
 *
 * If `activeModelPackId` is set, looks up the pack (built-in or custom) and
 * returns its models. Falls back to the explicit `modeDefaults` map.
 *
 * @param settings  The loaded global settings.
 * @param builtinPacks  Built-in packs for the current provider access
 *                      (from `getAvailableModePacks`). Pass `[]` if unavailable.
 */
export function resolveModelDefaults(
  settings: GlobalSettings,
  builtinPacks: Array<{ id: string; models: Record<string, string> }>,
): Record<string, string> {
  const { activeModelPackId, modeDefaults } = settings.models;
  if (!activeModelPackId) return modeDefaults;

  // Custom pack: "custom:<name>"
  if (activeModelPackId.startsWith('custom:')) {
    const name = activeModelPackId.slice('custom:'.length);
    const pack = settings.customModelPacks.find(p => p.name === name);
    if (pack) return pack.models;
    // Custom pack was deleted — fall through to modeDefaults
    return modeDefaults;
  }

  // Built-in pack
  const builtin = builtinPacks.find(p => p.id === activeModelPackId);
  if (builtin) return builtin.models;

  // Unknown pack id — fall through
  return modeDefaults;
}

/**
 * Resolve the effective OM model ID.
 *
 * If `activeOmPackId` is set, looks up the matching OM pack and returns its
 * model. Falls back to the explicit `omModelOverride`.
 *
 * @param settings  The loaded global settings.
 * @param builtinOmPacks  Built-in OM packs for the current provider access
 *                        (from `getAvailableOmPacks`). Pass `[]` if unavailable.
 */
export function resolveOmModel(
  settings: GlobalSettings,
  builtinOmPacks: Array<{ id: string; modelId: string }>,
): string | null {
  const { activeOmPackId, omModelOverride } = settings.models;
  if (!activeOmPackId) return omModelOverride;

  if (activeOmPackId === 'custom') return omModelOverride;

  const pack = builtinOmPacks.find(p => p.id === activeOmPackId);
  if (pack) return pack.modelId;

  // Unknown pack — fall back to override
  return omModelOverride;
}

export function saveSettings(settings: GlobalSettings, filePath: string = getSettingsPath()): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Create a browser instance from settings.
 * Shared by startup (main.ts) and live reconfiguration (/browser command).
 * Returns undefined if browser is disabled.
 */
export async function createBrowserFromSettings(settings: BrowserSettings): Promise<MastraBrowser | undefined> {
  if (!settings.enabled) {
    return undefined;
  }

  const { provider, headless, viewport, cdpUrl, stagehand } = settings;

  if (provider === 'stagehand') {
    const { StagehandBrowser } = await import('@mastra/stagehand');
    return new StagehandBrowser({
      headless,
      viewport,
      cdpUrl,
      env: stagehand?.env ?? 'LOCAL',
      apiKey: stagehand?.apiKey ?? process.env.BROWSERBASE_API_KEY,
      projectId: stagehand?.projectId ?? process.env.BROWSERBASE_PROJECT_ID,
    });
  } else if (provider === 'agent-browser') {
    const { AgentBrowser } = await import('@mastra/agent-browser');
    return new AgentBrowser({
      headless,
      viewport,
      cdpUrl,
    });
  }

  throw new Error(`Unsupported browser provider: ${provider}`);
}
