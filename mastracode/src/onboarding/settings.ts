/**
 * Persistent global settings stored in the app data directory as settings.json.
 * This file persists onboarding state AND user preferences (model choices, yolo, etc.)
 * so they carry across threads and restarts.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAppDataDir } from '../utils/project.js';

/** A saved custom pack — user-defined model selections for each mode. */
export interface CustomPack {
  name: string;
  models: Record<string, string>;
  createdAt: string;
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
     * Active model pack ID. Built-in packs use their id directly ("varied",
     * "anthropic", "openai"). Custom packs use "custom:<name>".
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
    /** Per-agent-type subagent model overrides (e.g. { explore: "openai/gpt-5.1-codex-mini" }) */
    subagentModels: Record<string, string>;
  };
  // Global behavior preferences
  preferences: {
    yolo: boolean | null;
    theme: 'auto' | 'dark' | 'light';
  };
  // Storage backend configuration
  storage: StorageSettings;
  // User-created custom model packs
  customModelPacks: CustomPack[];
  // Model usage counts for ranking in the selector
  modelUseCounts: Record<string, number>;
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
    subagentModels: {},
  },
  preferences: {
    yolo: null,
    theme: 'auto',
  },
  storage: { ...STORAGE_DEFAULTS },
  customModelPacks: [],
  modelUseCounts: {},
};

export function getSettingsPath(): string {
  return join(getAppDataDir(), 'settings.json');
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
        preferences: { ...DEFAULTS.preferences, ...raw.preferences },
        storage: {
          ...STORAGE_DEFAULTS,
          ...raw.storage,
          libsql: { ...STORAGE_DEFAULTS.libsql, ...raw.storage?.libsql },
          pg: { ...STORAGE_DEFAULTS.pg, ...raw.storage?.pg },
        },
        customModelPacks: Array.isArray(raw.customModelPacks) ? raw.customModelPacks : [],
        modelUseCounts: raw.modelUseCounts && typeof raw.modelUseCounts === 'object' ? raw.modelUseCounts : {},
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

export function loadSettings(filePath: string = getSettingsPath()): GlobalSettings {
  // One-time migration: move model data from auth.json into settings.json
  migrateFromAuth(filePath);

  if (!existsSync(filePath)) return structuredClone(DEFAULTS);
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const settings: GlobalSettings = {
      onboarding: { ...DEFAULTS.onboarding, ...raw.onboarding },
      models: { ...DEFAULTS.models, ...raw.models },
      preferences: { ...DEFAULTS.preferences, ...raw.preferences },
      storage: {
        ...STORAGE_DEFAULTS,
        ...raw.storage,
        libsql: { ...STORAGE_DEFAULTS.libsql, ...raw.storage?.libsql },
        pg: { ...STORAGE_DEFAULTS.pg, ...raw.storage?.pg },
      },
      customModelPacks: Array.isArray(raw.customModelPacks) ? raw.customModelPacks : [],
      modelUseCounts: raw.modelUseCounts && typeof raw.modelUseCounts === 'object' ? raw.modelUseCounts : {},
    };

    // Migrate legacy omModelId → omModelOverride
    if (raw.models?.omModelId && !settings.models.omModelOverride) {
      settings.models.omModelOverride = raw.models.omModelId;
      saveSettings(settings, filePath);
    }

    return settings;
  } catch {
    return structuredClone(DEFAULTS);
  }
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
