/**
 * Skills Data Storage
 * Supports S3, local filesystem, and bundled data fallback
 *
 * Priority: S3 > Local filesystem > Bundled data
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ScrapedData } from '../registry/types.js';
import { isS3Configured, loadFromS3, saveToS3, getS3Info } from './s3.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLED_DATA_PATH = join(__dirname, '..', 'registry', 'scraped-skills.json');
const DATA_FILENAME = 'skills-data.json';

export type StorageType = 's3' | 'filesystem' | 'bundled';

/**
 * Get the local data directory from environment
 */
function getLocalDataDir(): string | null {
  return process.env.SKILLS_DATA_DIR || null;
}

/**
 * Get the path to the local data file
 */
function getLocalDataPath(): string | null {
  const dataDir = getLocalDataDir();
  if (!dataDir) return null;
  return join(dataDir, DATA_FILENAME);
}

/**
 * Load from local filesystem
 */
function loadFromFilesystem(): ScrapedData | null {
  const localPath = getLocalDataPath();
  if (localPath && existsSync(localPath)) {
    try {
      const content = readFileSync(localPath, 'utf-8');
      console.info(`[Storage] Loaded data from ${localPath}`);
      return JSON.parse(content) as ScrapedData;
    } catch (error) {
      console.error(`[Storage] Failed to load from ${localPath}:`, error);
    }
  }
  return null;
}

/**
 * Load from bundled data
 */
function loadFromBundled(): ScrapedData {
  if (existsSync(BUNDLED_DATA_PATH)) {
    const content = readFileSync(BUNDLED_DATA_PATH, 'utf-8');
    console.info('[Storage] Loaded bundled data');
    return JSON.parse(content) as ScrapedData;
  }

  console.warn('[Storage] No data found, returning empty dataset');
  return {
    scrapedAt: new Date().toISOString(),
    totalSkills: 0,
    totalSources: 0,
    totalOwners: 0,
    skills: [],
  };
}

/**
 * Save to local filesystem
 */
function saveToFilesystem(data: ScrapedData): boolean {
  const localPath = getLocalDataPath();
  if (!localPath) return false;

  try {
    const dir = dirname(localPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(localPath, JSON.stringify(data, null, 2));
    console.info(`[Storage] Saved data to ${localPath}`);
    return true;
  } catch (error) {
    console.error(`[Storage] Failed to save to ${localPath}:`, error);
    return false;
  }
}

/**
 * Load skills data from storage (async for S3 support)
 * Priority: S3 > Filesystem > Bundled
 */
export async function loadSkillsDataAsync(): Promise<ScrapedData> {
  // Try S3 first
  if (isS3Configured()) {
    const s3Data = await loadFromS3();
    if (s3Data) return s3Data;
  }

  // Try local filesystem
  const fsData = loadFromFilesystem();
  if (fsData) return fsData;

  // Fall back to bundled
  return loadFromBundled();
}

/**
 * Load skills data synchronously (for backwards compatibility)
 * Only checks filesystem and bundled data
 */
export function loadSkillsData(): ScrapedData {
  // Try local filesystem
  const fsData = loadFromFilesystem();
  if (fsData) return fsData;

  // Fall back to bundled
  return loadFromBundled();
}

/**
 * Save skills data to storage (async for S3 support)
 * Saves to S3 if configured, also saves to filesystem as backup
 */
export async function saveSkillsDataAsync(data: ScrapedData): Promise<{ s3: boolean; filesystem: boolean }> {
  const results = { s3: false, filesystem: false };

  // Save to S3 if configured
  if (isS3Configured()) {
    results.s3 = await saveToS3(data);
  }

  // Also save to filesystem if configured (as backup)
  if (getLocalDataDir()) {
    results.filesystem = saveToFilesystem(data);
  } else {
    // Development: save to bundled location
    try {
      writeFileSync(BUNDLED_DATA_PATH, JSON.stringify(data, null, 2));
      console.info('[Storage] Saved data to bundled location');
      results.filesystem = true;
    } catch (error) {
      console.error('[Storage] Failed to save to bundled location:', error);
    }
  }

  return results;
}

/**
 * Save skills data synchronously (legacy)
 */
export function saveSkillsData(data: ScrapedData): void {
  if (getLocalDataDir()) {
    saveToFilesystem(data);
  } else {
    writeFileSync(BUNDLED_DATA_PATH, JSON.stringify(data, null, 2));
    console.info('[Storage] Saved data to bundled location');
  }
}

/**
 * Get the current data file path being used
 */
export function getDataFilePath(): string {
  const localPath = getLocalDataPath();
  if (localPath && existsSync(localPath)) {
    return localPath;
  }
  return BUNDLED_DATA_PATH;
}

/**
 * Check if using external storage
 */
export function isUsingExternalStorage(): boolean {
  return isS3Configured() || getLocalDataDir() !== null;
}

/**
 * Get the active storage type
 */
export function getActiveStorageType(): StorageType {
  if (isS3Configured()) return 's3';
  if (getLocalDataDir()) return 'filesystem';
  return 'bundled';
}

/**
 * Get storage info for debugging
 */
export function getStorageInfo(): {
  type: StorageType;
  s3: ReturnType<typeof getS3Info>;
  filesystem: {
    dataDir: string | null;
    dataFile: string;
    exists: boolean;
  };
  bundled: {
    path: string;
    exists: boolean;
  };
} {
  const localPath = getLocalDataPath();

  return {
    type: getActiveStorageType(),
    s3: getS3Info(),
    filesystem: {
      dataDir: getLocalDataDir(),
      dataFile: localPath || '',
      exists: localPath ? existsSync(localPath) : false,
    },
    bundled: {
      path: BUNDLED_DATA_PATH,
      exists: existsSync(BUNDLED_DATA_PATH),
    },
  };
}

// Re-export S3 functions for direct access
export { isS3Configured, loadFromS3, saveToS3, getS3Info } from './s3.js';
