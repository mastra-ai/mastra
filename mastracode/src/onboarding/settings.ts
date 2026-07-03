/**
 * Persistent global settings stored in the app data directory as settings.json.
 * This file persists onboarding state AND user preferences (model choices, yolo, etc.)
 * so they carry across threads and restarts.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { MastraBrowser } from '@mastra/core/browser';
import type { LSPConfig } from '@mastra/core/workspace';
import { AuthStorage } from '../auth/storage.js';
import { buildCodexStagehandFetch, createCodexMiddleware } from '../providers/openai-codex.js';
import { DEFAULT_STT_PROVIDER, resolveSTTModel } from '../tui/voice/stt-registry.js';
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

/** Direct TUI `!` shell passthrough mode. */
export type ShellPassthroughSettingsMode = 'default' | 'path' | 'login';

/** Direct TUI `!` shell command language. */
export type ShellPassthroughSettingsFamily = 'posix' | 'cmd' | 'powershell';

/** Direct TUI `!` shell passthrough configuration. */
export interface ShellPassthroughSettings {
  mode?: ShellPassthroughSettingsMode | string;
  executable?: string;
  family?: ShellPassthroughSettingsFamily | string;
}

/** STT engine: on-device macOS recognizer or a cloud provider. */
export type VoiceEngine = 'macos-native' | 'cloud';

/** Voice (hold-space dictation) configuration persisted in global settings. */
export interface VoiceSettings {
  /** Whether hold-space voice input is enabled. */
  enabled: boolean;
  /** Which STT engine to use. Defaults to macOS native on darwin, else cloud. */
  engine: VoiceEngine;
  /** Cloud provider id (matches an STT registry entry). Cloud engine only. */
  provider: string;
  /** Cloud model id; defaults to the provider's first registry model. */
  model?: string;
}

/** Stagehand environment type. */
export type StagehandEnv = 'LOCAL' | 'BROWSERBASE';

/** Stagehand-specific browser settings. */
export interface StagehandSettings {
  env: StagehandEnv;
  apiKey?: string;
  projectId?: string;
  /** Whether to preserve the user data directory after the browser closes. */
  preserveUserDataDir?: boolean;
}

/** AgentBrowser-specific browser settings. */
export interface AgentBrowserSettings {
  /** Path to a Playwright storage state file (JSON) containing cookies and localStorage. */
  storageState?: string;
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
  /** Path to a Chrome/Chromium user data directory (profile). */
  profile?: string;
  /** Path to the browser executable to use. */
  executablePath?: string;
  /** Browser scope — 'shared' (all threads share one browser) or 'thread' (each thread gets its own). */
  scope?: 'shared' | 'thread';
  /** Stagehand-specific settings. */
  stagehand?: StagehandSettings;
  /** AgentBrowser-specific settings. */
  agentBrowser?: AgentBrowserSettings;
}

export interface GlobalSettings {
  // Onboarding tracking
  onboarding: {
    completedAt: string | null;
    skippedAt: string | null;
    version: number;
    modePackId: string | null;
    omPackId: string | null;
    quietModePreferenceSelected: boolean;
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
    /**
     * Shared OM model override — used for both observer and reflector when a
     * role-specific override is not set. Kept for back-compat with older settings
     * files and set by onboarding when the user picks a custom OM pack.
     */
    omModelOverride: string | null;
    /**
     * Explicit Observer model override — takes precedence over `omModelOverride`
     * when set. Written by `/om` when the observer model is changed independently.
     */
    observerModelOverride: string | null;
    /**
     * Explicit Reflector model override — takes precedence over `omModelOverride`
     * when set. Written by `/om` when the reflector model is changed independently.
     */
    reflectorModelOverride: string | null;
    /** Default OM observation threshold used for new threads unless overridden per-thread. */
    omObservationThreshold: number | null;
    /** Default OM reflection threshold used for new threads unless overridden per-thread. */
    omReflectionThreshold: number | null;
    /**
     * Whether observations and reflections use the terse caveman-style instruction.
     * `null` means inherit the built-in default (currently `false` — caveman is
     * opt-in via `/om` settings). Used as the default for new threads unless
     * overridden per-thread.
     */
    omCavemanObservations: boolean | null;
    /**
     * Whether Observational Memory forwards image/file attachment parts to the
     * Observer LLM. `null` ⇒ inherit built-in default ('auto'). 'auto' checks
     * model capabilities; true/false forces the setting.
     */
    omObserveAttachments: 'auto' | boolean | null;
    /** Per-agent-type subagent model overrides (e.g. { explore: "openai/gpt-5.1-codex-mini" }) */
    subagentModels: Record<string, string>;
    /** Default judge model for /goal. */
    goalJudgeModel: string | null;
    /** Default max attempts for /goal. */
    goalMaxTurns: number | null;
  };
  // Global behavior preferences
  preferences: {
    yolo: boolean | null;
    theme: 'auto' | 'dark' | 'light';
    /** Default reasoning effort level used for all threads/models unless overridden in-session. */
    thinkingLevel: ThinkingLevelSetting;
    /** When true, components like subagent output collapse to compact summaries on completion. */
    quietMode: boolean;
    /** Maximum quiet-mode detail preview lines for compact tool calls. Set to 0 to hide previews. */
    quietModeMaxToolPreviewLines: number;
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
  // Direct TUI `!` shell passthrough configuration
  shellPassthrough: ShellPassthroughSettings;
  // Hold-space voice input configuration
  voice: VoiceSettings;
  // Signal routing configuration
  signals: SignalSettings;
  // Cloud observability configuration (per-resource project IDs; tokens stored in auth.json)
  observability: ObservabilitySettings;
}

export interface SignalSettings {
  /** Opt into local Unix socket PubSub for cross-process signal routing. */
  unixSocketPubSub: boolean;
  /** Experimental: enable GitHub PR subscription signals backed by gitcrawl. */
  experimentalGithubSignals: boolean;
}

export interface ObservabilityResourceConfig {
  /** Cloud project ID for this resource */
  projectId: string;
  /** When this config was created */
  configuredAt: string;
}

export interface ObservabilitySettings {
  /** Per-resource cloud project configs, keyed by resourceId */
  resources: Record<string, ObservabilityResourceConfig>;
  /** Whether to store traces locally in DuckDB. Off by default to avoid disk usage. */
  localTracing: boolean;
}

/** Auth key prefix for observability tokens stored per-resource in auth.json */
export const OBSERVABILITY_AUTH_PREFIX = 'observability:';

export const STORAGE_DEFAULTS: StorageSettings = {
  backend: 'libsql',
  libsql: {},
  pg: {},
};

/** Default STT engine: on-device macOS recognizer where available, else cloud. */
export function defaultVoiceEngine(): VoiceEngine {
  return process.platform === 'darwin' ? 'macos-native' : 'cloud';
}

const DEFAULTS: GlobalSettings = {
  onboarding: {
    completedAt: null,
    skippedAt: null,
    version: 0,
    modePackId: null,
    omPackId: null,
    quietModePreferenceSelected: true,
  },
  models: {
    activeModelPackId: null,
    modeDefaults: {},
    activeOmPackId: null,
    omModelOverride: null,
    observerModelOverride: null,
    reflectorModelOverride: null,
    omObservationThreshold: null,
    omReflectionThreshold: null,
    omCavemanObservations: null,
    omObserveAttachments: null,
    subagentModels: {},
    goalJudgeModel: null,
    goalMaxTurns: null,
  },
  preferences: {
    yolo: null,
    theme: 'auto',
    thinkingLevel: 'off',
    quietMode: false,
    quietModeMaxToolPreviewLines: 2,
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
  shellPassthrough: { mode: 'default' },
  voice: { enabled: false, engine: defaultVoiceEngine(), provider: DEFAULT_STT_PROVIDER },
  signals: { unixSocketPubSub: false, experimentalGithubSignals: false },
  observability: { resources: {}, localTracing: false },
};

const THINKING_LEVEL_VALUES: ThinkingLevelSetting[] = ['off', 'low', 'medium', 'high', 'xhigh'];
const QUIET_MODE_MAX_TOOL_PREVIEW_LINES_MAX = 8;
const loadedSignalSettings = new WeakMap<GlobalSettings, SignalSettings>();

function cloneSignalSettings(signals: SignalSettings): SignalSettings {
  return { ...signals };
}

function rememberLoadedSettings(settings: GlobalSettings): GlobalSettings {
  loadedSignalSettings.set(settings, cloneSignalSettings(settings.signals));
  return settings;
}

function signalSettingsEqual(left: SignalSettings, right: SignalSettings): boolean {
  return (
    left.unixSocketPubSub === right.unixSocketPubSub &&
    left.experimentalGithubSignals === right.experimentalGithubSignals
  );
}

function parseThinkingLevel(value: unknown): ThinkingLevelSetting {
  return typeof value === 'string' && THINKING_LEVEL_VALUES.includes(value as ThinkingLevelSetting)
    ? (value as ThinkingLevelSetting)
    : DEFAULTS.preferences.thinkingLevel;
}

function parseQuietModeMaxToolPreviewLines(value: unknown): number {
  const rawValue =
    typeof value === 'number' && Number.isFinite(value) ? value : DEFAULTS.preferences.quietModeMaxToolPreviewLines;
  return Math.min(QUIET_MODE_MAX_TOOL_PREVIEW_LINES_MAX, Math.max(0, Math.floor(rawValue)));
}

function parsePreferences(rawPreferences: unknown): GlobalSettings['preferences'] {
  const raw = rawPreferences && typeof rawPreferences === 'object' ? (rawPreferences as Record<string, unknown>) : {};

  return {
    ...DEFAULTS.preferences,
    ...raw,
    thinkingLevel: parseThinkingLevel(raw.thinkingLevel),
    quietModeMaxToolPreviewLines: parseQuietModeMaxToolPreviewLines(raw.quietModeMaxToolPreviewLines),
  };
}

function parseSignalSettings(rawSignals: unknown): SignalSettings {
  const raw = rawSignals && typeof rawSignals === 'object' ? (rawSignals as Record<string, unknown>) : {};
  return {
    unixSocketPubSub:
      typeof raw.unixSocketPubSub === 'boolean' ? raw.unixSocketPubSub : DEFAULTS.signals.unixSocketPubSub,
    experimentalGithubSignals:
      typeof raw.experimentalGithubSignals === 'boolean'
        ? raw.experimentalGithubSignals
        : DEFAULTS.signals.experimentalGithubSignals,
  };
}

function hasQuietModePreferenceSelected(rawOnboarding: unknown): boolean {
  return Boolean(
    rawOnboarding &&
    typeof rawOnboarding === 'object' &&
    Object.prototype.hasOwnProperty.call(rawOnboarding, 'quietModePreferenceSelected'),
  );
}

function applyQuietModePreferenceRollout(settings: GlobalSettings, rawOnboarding: unknown): void {
  if (hasQuietModePreferenceSelected(rawOnboarding)) return;
  settings.onboarding.quietModePreferenceSelected = settings.preferences.quietMode === true;
}

function getNewInstallDefaults(): GlobalSettings {
  const settings = structuredClone(DEFAULTS);
  settings.preferences.quietMode = true;
  settings.onboarding.quietModePreferenceSelected = true;
  return settings;
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
  const rawAgentBrowser =
    raw.agentBrowser && typeof raw.agentBrowser === 'object' ? (raw.agentBrowser as Record<string, unknown>) : {};

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULTS.browser.enabled,
    provider:
      typeof raw.provider === 'string' && BROWSER_PROVIDERS.has(raw.provider as BrowserProvider)
        ? (raw.provider as BrowserProvider)
        : DEFAULTS.browser.provider,
    headless: typeof raw.headless === 'boolean' ? raw.headless : DEFAULTS.browser.headless,
    cdpUrl: typeof raw.cdpUrl === 'string' && raw.cdpUrl.trim() ? raw.cdpUrl.trim() : undefined,
    profile: typeof raw.profile === 'string' && raw.profile.trim() ? raw.profile.trim() : undefined,
    executablePath:
      typeof raw.executablePath === 'string' && raw.executablePath.trim() ? raw.executablePath.trim() : undefined,
    viewport: {
      width: typeof rawViewport.width === 'number' ? rawViewport.width : DEFAULTS.browser.viewport!.width,
      height: typeof rawViewport.height === 'number' ? rawViewport.height : DEFAULTS.browser.viewport!.height,
    },
    scope: typeof raw.scope === 'string' && (raw.scope === 'shared' || raw.scope === 'thread') ? raw.scope : undefined,
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
      ...(typeof rawStagehand.preserveUserDataDir === 'boolean'
        ? { preserveUserDataDir: rawStagehand.preserveUserDataDir }
        : {}),
    },
    agentBrowser:
      typeof rawAgentBrowser.storageState === 'string' && rawAgentBrowser.storageState.trim()
        ? { storageState: rawAgentBrowser.storageState.trim() }
        : undefined,
  };
}

function parseShellPassthroughSettings(rawShellPassthrough: unknown): ShellPassthroughSettings {
  const raw =
    rawShellPassthrough && typeof rawShellPassthrough === 'object'
      ? (rawShellPassthrough as Record<string, unknown>)
      : {};
  const executable = typeof raw.executable === 'string' && raw.executable.trim() ? raw.executable.trim() : undefined;
  const family = typeof raw.family === 'string' && raw.family.trim() ? raw.family.trim() : undefined;
  const mode = typeof raw.mode === 'string' && raw.mode.trim() ? raw.mode.trim() : undefined;
  const defaultMode = executable ? undefined : DEFAULTS.shellPassthrough.mode;

  return {
    ...((mode ?? defaultMode) ? { mode: mode ?? defaultMode } : {}),
    ...(executable ? { executable } : {}),
    ...(family ? { family } : {}),
  };
}

function parseVoiceSettings(rawVoice: unknown): VoiceSettings {
  const raw = rawVoice && typeof rawVoice === 'object' ? (rawVoice as Record<string, unknown>) : {};
  const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULTS.voice.enabled;
  const engine: VoiceEngine =
    raw.engine === 'macos-native' || raw.engine === 'cloud' ? raw.engine : defaultVoiceEngine();
  // Validate provider/model against the registry, falling back to a usable entry
  // so old `{ enabled }`-only files and unknown values still resolve cleanly.
  const provider = typeof raw.provider === 'string' ? raw.provider : DEFAULTS.voice.provider;
  const model = typeof raw.model === 'string' ? raw.model : undefined;
  const resolved = resolveSTTModel(provider, model);
  return {
    enabled,
    engine,
    provider: resolved.provider,
    model: resolved.model,
  };
}

const VALID_PROJECT_ID = /^[a-zA-Z0-9_-]+$/;

function parseObservabilitySettings(raw: unknown): ObservabilitySettings {
  if (!raw || typeof raw !== 'object') return { resources: {}, localTracing: false };
  const obj = raw as Record<string, unknown>;
  const localTracing = obj.localTracing === true;
  const rawResources = obj.resources;
  if (!rawResources || typeof rawResources !== 'object') return { resources: {}, localTracing };
  const resources: Record<string, ObservabilityResourceConfig> = {};
  for (const [key, val] of Object.entries(rawResources as Record<string, unknown>)) {
    if (val && typeof val === 'object') {
      const v = val as Record<string, unknown>;
      if (typeof v.projectId === 'string' && VALID_PROJECT_ID.test(v.projectId)) {
        resources[key] = {
          projectId: v.projectId,
          configuredAt: typeof v.configuredAt === 'string' ? v.configuredAt : new Date().toISOString(),
        };
      }
    }
  }
  return { resources, localTracing };
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
        shellPassthrough: parseShellPassthroughSettings(raw.shellPassthrough),
        voice: parseVoiceSettings(raw.voice),
        signals: parseSignalSettings(raw.signals),
        observability: parseObservabilitySettings(raw.observability),
      };
      applyQuietModePreferenceRollout(settings, raw.onboarding);
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

  if (!existsSync(filePath)) return rememberLoadedSettings(getNewInstallDefaults());
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
      shellPassthrough: parseShellPassthroughSettings(raw.shellPassthrough),
      voice: parseVoiceSettings(raw.voice),
      signals: parseSignalSettings(raw.signals),
      observability: parseObservabilitySettings(raw.observability),
    };

    // Migrate legacy omModelId → omModelOverride
    let settingsChanged = false;
    if (!hasQuietModePreferenceSelected(raw.onboarding)) {
      applyQuietModePreferenceRollout(settings, raw.onboarding);
      settingsChanged = true;
    }
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

    return rememberLoadedSettings(settings);
  } catch {
    return rememberLoadedSettings(structuredClone(DEFAULTS));
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
 * Resolve the effective model ID for one of the two OM roles.
 *
 * Lookup order:
 *   1. The role-specific override (`observerModelOverride` /
 *      `reflectorModelOverride`) if set.
 *   2. If `activeOmPackId` points at a built-in pack, that pack's model.
 *   3. The shared `omModelOverride` fallback.
 *
 * @param settings  The loaded global settings.
 * @param role      Which OM role to resolve (`'observer'` or `'reflector'`).
 * @param builtinOmPacks  Built-in OM packs for the current provider access
 *                        (from `getAvailableOmPacks`). Pass `[]` if unavailable.
 */
export function resolveOmRoleModel(
  settings: GlobalSettings,
  role: 'observer' | 'reflector',
  builtinOmPacks: Array<{ id: string; modelId: string }>,
): string | null {
  const { activeOmPackId, omModelOverride, observerModelOverride, reflectorModelOverride } = settings.models;
  const roleOverride = role === 'observer' ? observerModelOverride : reflectorModelOverride;
  if (roleOverride) return roleOverride;

  if (!activeOmPackId) return omModelOverride;
  if (activeOmPackId === 'custom') return omModelOverride;

  const pack = builtinOmPacks.find(p => p.id === activeOmPackId);
  if (pack) return pack.modelId;

  return omModelOverride;
}

/**
 * @deprecated Use `resolveOmRoleModel(settings, 'observer' | 'reflector', ...)`.
 * Equivalent to resolving the observer role (existing callers set both observer
 * and reflector to the same value).
 */
export function resolveOmModel(
  settings: GlobalSettings,
  builtinOmPacks: Array<{ id: string; modelId: string }>,
): string | null {
  return resolveOmRoleModel(settings, 'observer', builtinOmPacks);
}

function getSignalSettingsForSave(settings: GlobalSettings, filePath: string): SignalSettings {
  const loadedSignals = loadedSignalSettings.get(settings);
  if (!loadedSignals || !signalSettingsEqual(settings.signals, loadedSignals) || !existsSync(filePath)) {
    return settings.signals;
  }

  try {
    const currentRaw = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    const currentSignals = parseSignalSettings(currentRaw.signals);
    if (!signalSettingsEqual(currentSignals, loadedSignals)) {
      return currentSignals;
    }
  } catch {
    // If the current file is unreadable, fall back to the caller's settings.
  }

  return settings.signals;
}

export function saveSettings(settings: GlobalSettings, filePath: string = getSettingsPath()): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const signals = getSignalSettingsForSave(settings, filePath);
  settings.signals = signals;
  loadedSignalSettings.set(settings, cloneSignalSettings(signals));
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}

/** Marker file name to track which provider last used a profile. */
const PROFILE_PROVIDER_MARKER = '.mastra-provider';

/**
 * Check which provider last used a profile directory.
 * Returns the provider name if the marker exists, undefined otherwise.
 */
export function getProfileProvider(profilePath: string): BrowserProvider | undefined {
  const markerPath = join(profilePath, PROFILE_PROVIDER_MARKER);
  if (!existsSync(markerPath)) {
    return undefined;
  }
  try {
    const content = readFileSync(markerPath, 'utf-8').trim();
    if (content === 'stagehand' || content === 'agent-browser') {
      return content;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Write the provider marker to a profile directory.
 * Creates the directory if it doesn't exist.
 */
export function setProfileProvider(profilePath: string, provider: BrowserProvider): void {
  const markerPath = join(profilePath, PROFILE_PROVIDER_MARKER);
  if (!existsSync(profilePath)) {
    mkdirSync(profilePath, { recursive: true });
  }
  writeFileSync(markerPath, provider, 'utf-8');
}

/**
 * Check if a profile has a provider mismatch.
 * Returns the existing provider if there's a mismatch, undefined otherwise.
 */
export function checkProfileProviderMismatch(
  profilePath: string | undefined,
  targetProvider: BrowserProvider,
): BrowserProvider | undefined {
  if (!profilePath) {
    return undefined;
  }
  const existingProvider = getProfileProvider(profilePath);
  if (existingProvider && existingProvider !== targetProvider) {
    return existingProvider;
  }
  return undefined;
}

function browserRecordingOptions() {
  return { outputDir: join(getAppDataDir(), 'browser-recordings') };
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

  const { provider, headless, viewport, cdpUrl, profile, executablePath, stagehand, agentBrowser } = settings;

  // Chrome only allows one process per profile directory, so force 'shared' scope
  // when a profile is set. Otherwise use the user's setting (or provider default).
  const scope = profile ? ('shared' as const) : settings.scope;

  // Common launch options (no CDP)
  const launchConfig = { headless, viewport, profile, executablePath, scope } as const;

  if (provider === 'stagehand') {
    const { StagehandBrowser } = await import('@mastra/stagehand');
    const stagehandOpts: Record<string, unknown> = {
      env: stagehand?.env ?? 'LOCAL',
      apiKey: stagehand?.apiKey ?? process.env.BROWSERBASE_API_KEY,
      projectId: stagehand?.projectId ?? process.env.BROWSERBASE_PROJECT_ID,
      preserveUserDataDir: stagehand?.preserveUserDataDir,
      recording: browserRecordingOptions(),
    };

    // When the user has an active OpenAI Codex (ChatGPT) subscription, route
    // Stagehand through the Codex endpoint. We use the AI SDK provider's
    // standard hooks (baseURL, headers, fetch, and middleware) instead of a
    // URL-rewriting fetch:
    //   - baseURL: target Codex's Responses API directly (no URL rewriting).
    //   - headers: static Codex identifiers (originator, UA, account id).
    //   - fetch: a tiny refresher that injects the live OAuth bearer per call,
    //     since AI SDK takes `apiKey` as a static string.
    //   - middleware: createCodexMiddleware() sets `store: false`, which Codex
    //     requires on every request.
    // Model is `gpt-5.4-mini`, the current ChatGPT-sign-in Codex whitelist
    // pick suited to Stagehand's vision + structured-output workload.
    const authStorage = new AuthStorage();
    const cred = authStorage.get('openai-codex');
    if (cred?.type === 'oauth') {
      const accountId = (cred as any).accountId as string | undefined;
      stagehandOpts.model = {
        modelName: 'openai/gpt-5.4-mini',
        apiKey: 'codex-oauth',
        baseURL: 'https://chatgpt.com/backend-api/codex',
        headers: {
          originator: 'mastracode',
          'User-Agent': 'mastracode',
          ...(accountId ? { 'ChatGPT-Account-ID': accountId } : {}),
        },
        fetch: buildCodexStagehandFetch(authStorage),
        middleware: createCodexMiddleware(),
      } as any;
    }

    return cdpUrl
      ? new StagehandBrowser({ ...launchConfig, cdpUrl, scope: 'shared', ...stagehandOpts })
      : new StagehandBrowser({ ...launchConfig, ...stagehandOpts });
  } else if (provider === 'agent-browser') {
    const { AgentBrowser } = await import('@mastra/agent-browser');
    const agentBrowserOpts = {
      storageState: agentBrowser?.storageState,
      recording: browserRecordingOptions(),
    };
    return cdpUrl
      ? new AgentBrowser({ ...launchConfig, cdpUrl, scope: 'shared', ...agentBrowserOpts })
      : new AgentBrowser({ ...launchConfig, ...agentBrowserOpts, scope });
  }

  throw new Error(`Unsupported browser provider: ${provider}`);
}
