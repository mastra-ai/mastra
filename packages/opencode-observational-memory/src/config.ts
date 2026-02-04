import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ObservationalMemoryPluginConfig } from './types/index.js';

const CONFIG_DIR = join(homedir(), '.config', 'opencode');
const CONFIG_FILES = [
  join(CONFIG_DIR, 'observational-memory.jsonc'),
  join(CONFIG_DIR, 'observational-memory.json'),
];

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

const DEFAULTS: Required<Omit<ObservationalMemoryPluginConfig, 'mastraUrl' | 'apiKey' | 'agentId' | 'resourceId'>> = {
  maxObservations: 5,
  maxSearchResults: 10,
  injectWorkingMemory: true,
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

function getMastraUrl(): string | undefined {
  // Priority: env var > config file
  if (process.env.MASTRA_URL) return process.env.MASTRA_URL;
  return fileConfig.mastraUrl;
}

function getApiKey(): string | undefined {
  // Priority: env var > config file
  if (process.env.MASTRA_API_KEY) return process.env.MASTRA_API_KEY;
  return fileConfig.apiKey;
}

function getAgentId(): string | undefined {
  // Priority: env var > config file
  if (process.env.MASTRA_AGENT_ID) return process.env.MASTRA_AGENT_ID;
  return fileConfig.agentId;
}

function getResourceId(): string | undefined {
  // Priority: env var > config file
  if (process.env.MASTRA_RESOURCE_ID) return process.env.MASTRA_RESOURCE_ID;
  return fileConfig.resourceId;
}

export const MASTRA_URL = getMastraUrl();
export const MASTRA_API_KEY = getApiKey();
export const MASTRA_AGENT_ID = getAgentId();
export const MASTRA_RESOURCE_ID = getResourceId();

export const CONFIG = {
  maxObservations: fileConfig.maxObservations ?? DEFAULTS.maxObservations,
  maxSearchResults: fileConfig.maxSearchResults ?? DEFAULTS.maxSearchResults,
  injectWorkingMemory: fileConfig.injectWorkingMemory ?? DEFAULTS.injectWorkingMemory,
  injectObservations: fileConfig.injectObservations ?? DEFAULTS.injectObservations,
  containerTagPrefix: fileConfig.containerTagPrefix ?? DEFAULTS.containerTagPrefix,
  keywordPatterns: [
    ...DEFAULT_KEYWORD_PATTERNS,
    ...(fileConfig.keywordPatterns ?? []).filter(isValidRegex),
  ],
  compactionThreshold: validateCompactionThreshold(fileConfig.compactionThreshold),
};

export function isConfigured(): boolean {
  return !!(MASTRA_URL && MASTRA_AGENT_ID);
}

export { CONFIG_DIR };
