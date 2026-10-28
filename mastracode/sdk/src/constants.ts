import * as path from 'node:path';

// Default config directory name used for all project-level and global config paths.
export const DEFAULT_CONFIG_DIR = '.mastracode';

/**
 * Validate that a configDirName is a safe single directory name.
 * Rejects absolute paths, path separators, and traversal components.
 */
export function validateConfigDirName(configDirName: string): void {
  if (configDirName.trim().length === 0) {
    throw new Error('configDirName must be a non-empty directory name');
  }

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

// Model routes are persisted host input and eagerly resolved per request.
export const MODEL_ROUTE_MAX_ENTRIES = 32;
export const MODEL_ROUTE_MAX_FIELD_LENGTH = 512;

// Default OM model - using gemini-3.5-flash for efficiency
export const DEFAULT_OM_MODEL_ID = process.env.DEFAULT_OM_MODEL_ID ?? 'google/gemini-3.5-flash';

// Default OM thresholds — per-thread overrides are loaded from thread metadata
export const DEFAULT_OBS_THRESHOLD = 30_000;
export const DEFAULT_REF_THRESHOLD = 40_000;

/**
 * Absolute token retention of the observation activation buffer
 * (`observation.bufferActivation`) for non-resource OM. `@mastra/memory` requires
 * the buffer to stay below `observation.messageTokens`, so a stored observation
 * threshold at or below this value fails the next memory init.
 */
export const OBSERVATION_ACTIVATION_TOKENS = 2000;

/**
 * Smallest observation threshold the observer can actually run with: the
 * activation buffer above must stay strictly below `observation.messageTokens`.
 * A row saved before the settings route enforced that can hold a lower value, and
 * `@mastra/memory` rejects the config at init — so reads take the value up to this
 * floor rather than trusting the stored one.
 */
export const MIN_OBSERVATION_THRESHOLD = OBSERVATION_ACTIVATION_TOKENS + 1;
