import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ObservationalMemoryPluginConfig } from './types/index.js';

const CONFIG_DIR = join(homedir(), '.config', 'opencode');
const CONFIG_FILES = [
  join(CONFIG_DIR, 'observational-memory.jsonc'),
  join(CONFIG_DIR, 'observational-memory.json'),
];

// Default database location
const DEFAULT_DB_PATH = join(homedir(), '.opencode', 'observational-memory.db');

/**
 * Strip JSONC comments from a string
 */
function stripJsoncComments(content: string): string {
  // Remove single-line comments
  let result = content.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return result;
}

const DEFAULT_KEYWORD_PATTERNS = [
  'remember',
  'memorize',
  'save\\s+this',
  'note\\s+this',
  'keep\\s+in\\s+mind',
  "don'?t\\s+forget",
  'learn\\s+this',
  'store\\s+this',
  'record\\s+this',
  'make\\s+a\\s+note',
  'take\\s+note',
  'jot\\s+down',
  'commit\\s+to\\s+memory',
  'remember\\s+that',
  'never\\s+forget',
  'always\\s+remember',
];

const DEFAULTS: Required<
  Omit<ObservationalMemoryPluginConfig, 'model' | 'observerModel' | 'reflectorModel'>
> & {
  model: string;
} = {
  dbPath: DEFAULT_DB_PATH,
  model: 'google/gemini-2.0-flash',
  scope: 'resource',
  messageTokenThreshold: 30000,
  observationTokenThreshold: 40000,
  injectObservations: true,
  containerTagPrefix: 'opencode',
  keywordPatterns: [],
  compactionThreshold: 0.8,
};

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function validateCompactionThreshold(value: number | undefined): number {
  if (value === undefined || typeof value !== 'number' || isNaN(value)) {
    return DEFAULTS.compactionThreshold;
  }
  if (value <= 0 || value > 1) return DEFAULTS.compactionThreshold;
  return value;
}

function loadConfig(): ObservationalMemoryPluginConfig {
  for (const path of CONFIG_FILES) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        const json = stripJsoncComments(content);
        return JSON.parse(json) as ObservationalMemoryPluginConfig;
      } catch {
        // Invalid config, use defaults
      }
    }
  }
  return {};
}

const fileConfig = loadConfig();

function getDbPath(): string {
  if (process.env.OM_DB_PATH) return process.env.OM_DB_PATH;
  return fileConfig.dbPath ?? DEFAULTS.dbPath;
}

function getModel(): string {
  if (process.env.OM_MODEL) return process.env.OM_MODEL;
  return fileConfig.model ?? DEFAULTS.model;
}

function getObserverModel(): string | undefined {
  if (process.env.OM_OBSERVER_MODEL) return process.env.OM_OBSERVER_MODEL;
  return fileConfig.observerModel;
}

function getReflectorModel(): string | undefined {
  if (process.env.OM_REFLECTOR_MODEL) return process.env.OM_REFLECTOR_MODEL;
  return fileConfig.reflectorModel;
}

export const CONFIG = {
  dbPath: getDbPath(),
  model: getModel(),
  observerModel: getObserverModel(),
  reflectorModel: getReflectorModel(),
  scope: (fileConfig.scope ?? DEFAULTS.scope) as 'thread' | 'resource',
  messageTokenThreshold: fileConfig.messageTokenThreshold ?? DEFAULTS.messageTokenThreshold,
  observationTokenThreshold: fileConfig.observationTokenThreshold ?? DEFAULTS.observationTokenThreshold,
  injectObservations: fileConfig.injectObservations ?? DEFAULTS.injectObservations,
  containerTagPrefix: fileConfig.containerTagPrefix ?? DEFAULTS.containerTagPrefix,
  keywordPatterns: [
    ...DEFAULT_KEYWORD_PATTERNS,
    ...(fileConfig.keywordPatterns ?? []).filter(isValidRegex),
  ],
  compactionThreshold: validateCompactionThreshold(fileConfig.compactionThreshold),
};

export function isConfigured(): boolean {
  // The plugin is always "configured" since we use local storage
  // We just need the model to be available
  return !!CONFIG.model;
}

export { CONFIG_DIR, DEFAULT_DB_PATH };
