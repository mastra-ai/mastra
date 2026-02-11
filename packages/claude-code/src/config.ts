import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { OMConfig, ResolvedConfig } from './types.js';

const DEFAULTS: ResolvedConfig = {
  memoryDir: '.mastra/memory',
  observationThreshold: 80_000,
  reflectionThreshold: 40_000,
  model: 'claude-sonnet-4-20250514',
  debug: false,
};

/**
 * Resolve configuration from defaults, config file, and environment.
 * Priority: env vars > config file > defaults
 */
export function resolveConfig(overrides?: OMConfig): ResolvedConfig {
  // Try loading from config file
  const fileConfig = loadConfigFile();

  const merged: ResolvedConfig = {
    memoryDir:
      process.env.MASTRA_OM_MEMORY_DIR ||
      overrides?.memoryDir ||
      fileConfig?.memoryDir ||
      DEFAULTS.memoryDir,
    observationThreshold:
      parseIntEnv('MASTRA_OM_OBSERVATION_THRESHOLD') ??
      overrides?.observationThreshold ??
      fileConfig?.observationThreshold ??
      DEFAULTS.observationThreshold,
    reflectionThreshold:
      parseIntEnv('MASTRA_OM_REFLECTION_THRESHOLD') ??
      overrides?.reflectionThreshold ??
      fileConfig?.reflectionThreshold ??
      DEFAULTS.reflectionThreshold,
    model:
      process.env.MASTRA_OM_MODEL ||
      overrides?.model ||
      fileConfig?.model ||
      DEFAULTS.model,
    debug:
      process.env.MASTRA_OM_DEBUG === '1' ||
      process.env.MASTRA_OM_DEBUG === 'true' ||
      overrides?.debug ||
      fileConfig?.debug ||
      DEFAULTS.debug,
  };

  return merged;
}

/**
 * Try to load config from .mastra/memory/config.json
 */
function loadConfigFile(): OMConfig | null {
  const configPaths = [
    join(process.cwd(), '.mastra', 'memory', 'config.json'),
    join(process.cwd(), '.mastra', 'om-config.json'),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const raw = readFileSync(configPath, 'utf-8');
        return JSON.parse(raw) as OMConfig;
      } catch {
        // Ignore malformed config
      }
    }
  }

  return null;
}

function parseIntEnv(name: string): number | undefined {
  const val = process.env[name];
  if (!val) return undefined;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Get the absolute path to the memory directory.
 */
export function getMemoryDir(config: ResolvedConfig): string {
  return resolve(process.cwd(), config.memoryDir);
}
