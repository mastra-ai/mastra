/**
 * Headless config file loading — discovery, parsing, and validation.
 *
 * Discovery order (first-file-wins, no deep merge):
 *   1. Explicit --config <path> (error if not found)
 *   2. .mastracode/headless.json (project-level)
 *   3. ~/.mastracode/headless.json (global-level)
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const VALID_MODES = ['build', 'plan', 'fast'] as const;
export const VALID_THINKING_LEVELS = ['off', 'low', 'medium', 'high', 'xhigh'] as const;

export type HeadlessMode = (typeof VALID_MODES)[number];
export type ThinkingLevel = (typeof VALID_THINKING_LEVELS)[number];

export type HeadlessProfileConfig = {
  models?: {
    activeModelPackId?: string;
    modeDefaults?: Partial<Record<HeadlessMode, string>>;
    activeOmPackId?: string;
    omModelOverride?: string;
    subagentModels?: Record<string, string>;
    omObservationThreshold?: number | null;
    omReflectionThreshold?: number | null;
  };
  preferences?: {
    thinkingLevel?: ThinkingLevel;
    yolo?: boolean;
  };
};

export interface HeadlessConfig extends HeadlessProfileConfig {
  profiles?: Record<string, HeadlessProfileConfig>;
}

export function getProjectHeadlessConfigPath(projectDir: string): string {
  return path.join(projectDir, '.mastracode', 'headless.json');
}

export function getGlobalHeadlessConfigPath(globalDir?: string): string {
  const base = globalDir ?? os.homedir();
  return path.join(base, '.mastracode', 'headless.json');
}

export interface LoadOptions {
  configPath?: string;
  projectDir?: string;
  globalDir?: string;
}

/**
 * Load and validate headless config.
 *
 * - If configPath is provided, load only that file. Throws on missing/invalid.
 * - Otherwise auto-discover: project → global. Returns {} if none found.
 *   Auto-discovered files with parse errors are silently ignored.
 */
export function loadHeadlessConfig(opts: LoadOptions = {}): HeadlessConfig {
  if (opts.configPath) {
    return loadExplicit(opts.configPath);
  }
  return loadAutoDiscover(opts.projectDir, opts.globalDir);
}

function loadExplicit(filePath: string): HeadlessConfig {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read config file: ${(err as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse config file: ${(err as Error).message}`);
  }
  return validate(parsed);
}

function loadAutoDiscover(projectDir?: string, globalDir?: string): HeadlessConfig {
  const paths: string[] = [];
  if (projectDir) paths.push(getProjectHeadlessConfigPath(projectDir));
  paths.push(getGlobalHeadlessConfigPath(globalDir));

  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf-8');
      const parsed = JSON.parse(raw);
      return validate(parsed);
    } catch {
      // Silent fail-through for auto-discovered files
      continue;
    }
  }
  return {};
}

const KNOWN_TOP_LEVEL_KEYS = new Set(['models', 'preferences', 'profiles']);

/**
 * Validate models and preferences from an object (used for both top-level and profile entries).
 */
function validateProfileBody(obj: Record<string, unknown>): HeadlessProfileConfig {
  const result: HeadlessProfileConfig = {};

  // Validate models
  if (obj.models && typeof obj.models === 'object') {
    const models = obj.models as Record<string, unknown>;
    const resultModels: HeadlessProfileConfig['models'] = {};

    // activeModelPackId
    if (typeof models.activeModelPackId === 'string') {
      resultModels.activeModelPackId = models.activeModelPackId;
    }

    // modeDefaults
    if (models.modeDefaults && typeof models.modeDefaults === 'object') {
      const defaults = models.modeDefaults as Record<string, unknown>;
      const modeDefaults: Partial<Record<HeadlessMode, string>> = {};
      for (const [key, value] of Object.entries(defaults)) {
        if ((VALID_MODES as readonly string[]).includes(key)) {
          if (typeof value === 'string') {
            modeDefaults[key as HeadlessMode] = value;
          }
        } else {
          process.stderr.write(`Warning: unknown mode "${key}" in headless.json models.modeDefaults, ignoring\n`);
        }
      }
      if (Object.keys(modeDefaults).length > 0) {
        resultModels.modeDefaults = modeDefaults;
      }
    }

    // activeOmPackId
    if (typeof models.activeOmPackId === 'string') {
      resultModels.activeOmPackId = models.activeOmPackId;
    }

    // omModelOverride — only meaningful as a string; null/undefined means "no override"
    if (typeof models.omModelOverride === 'string') {
      resultModels.omModelOverride = models.omModelOverride;
    }

    // subagentModels
    if (models.subagentModels && typeof models.subagentModels === 'object') {
      const raw = models.subagentModels as Record<string, unknown>;
      const subagentModels: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === 'string') {
          subagentModels[key] = value;
        } else {
          process.stderr.write(`Warning: subagentModels["${key}"] is not a string in headless.json, ignoring\n`);
        }
      }
      if (Object.keys(subagentModels).length > 0) {
        resultModels.subagentModels = subagentModels;
      }
    }

    // omObservationThreshold (number or null)
    if (typeof models.omObservationThreshold === 'number') {
      resultModels.omObservationThreshold = models.omObservationThreshold;
    } else if (models.omObservationThreshold === null) {
      resultModels.omObservationThreshold = null;
    }

    // omReflectionThreshold (number or null)
    if (typeof models.omReflectionThreshold === 'number') {
      resultModels.omReflectionThreshold = models.omReflectionThreshold;
    } else if (models.omReflectionThreshold === null) {
      resultModels.omReflectionThreshold = null;
    }

    if (Object.keys(resultModels).length > 0) {
      result.models = resultModels;
    }
  }

  // Validate preferences
  if (obj.preferences && typeof obj.preferences === 'object') {
    const prefs = obj.preferences as Record<string, unknown>;
    const preferences: HeadlessProfileConfig['preferences'] = {};
    if (typeof prefs.thinkingLevel === 'string') {
      if ((VALID_THINKING_LEVELS as readonly string[]).includes(prefs.thinkingLevel)) {
        preferences.thinkingLevel = prefs.thinkingLevel as ThinkingLevel;
      } else {
        process.stderr.write(`Warning: invalid thinkingLevel "${prefs.thinkingLevel}" in headless.json, ignoring\n`);
      }
    }
    if (typeof prefs.yolo === 'boolean') {
      preferences.yolo = prefs.yolo;
    }
    if (Object.keys(preferences).length > 0) {
      result.preferences = preferences;
    }
  }

  return result;
}

function validate(raw: unknown): HeadlessConfig {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;

  // Warn on unknown top-level keys
  for (const key of Object.keys(obj)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      process.stderr.write(`Warning: unknown config key "${key}" in headless.json, ignoring\n`);
    }
  }

  const config: HeadlessConfig = validateProfileBody(obj);

  // Validate profiles
  if (obj.profiles && typeof obj.profiles === 'object') {
    const rawProfiles = obj.profiles as Record<string, unknown>;
    const profiles: Record<string, HeadlessProfileConfig> = {};
    for (const [name, entry] of Object.entries(rawProfiles)) {
      if (!entry || typeof entry !== 'object') {
        process.stderr.write(`Warning: profile "${name}" is not an object in headless.json, ignoring\n`);
        continue;
      }
      profiles[name] = validateProfileBody(entry as Record<string, unknown>);
    }
    if (Object.keys(profiles).length > 0) {
      config.profiles = profiles;
    }
  }

  return config;
}

/**
 * Resolve a named profile from config. Throws if the profile doesn't exist.
 */
export function resolveProfile(config: HeadlessConfig, profileName: string): HeadlessProfileConfig {
  if (!config.profiles || !(profileName in config.profiles)) {
    const available = Object.keys(config.profiles ?? {}).join(', ') || '(none)';
    throw new Error(`Profile "${profileName}" not found in config. Available: ${available}`);
  }
  return config.profiles[profileName]!;
}
