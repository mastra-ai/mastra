import * as path from 'node:path';

// Default config directory name used for all project-level and global config paths.
export const DEFAULT_CONFIG_DIR = '.mastracode';

/**
 * Validate that a configDirName is a safe single directory name.
 * Rejects absolute paths, path separators, and traversal components.
 */
export function validateConfigDirName(configDirName: string): void {
  if (
    path.isAbsolute(configDirName) ||
    configDirName.includes('/') ||
    configDirName.includes('\\') ||
    configDirName === '..' ||
    configDirName === '.'
  ) {
    throw new Error(
      `configDirName must be a single directory name without path separators or traversal components, got: "${configDirName}"`,
    );
  }
}

// Default OM model - using gemini-2.5-flash for efficiency
export const DEFAULT_OM_MODEL_ID = process.env.DEFAULT_OM_MODEL_ID ?? 'google/gemini-2.5-flash';

// Default OM thresholds — per-thread overrides are loaded from thread metadata
export const DEFAULT_OBS_THRESHOLD = 30_000;
export const DEFAULT_REF_THRESHOLD = 40_000;
