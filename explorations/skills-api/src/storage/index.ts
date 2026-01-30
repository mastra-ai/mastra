/**
 * Skills Data Storage
 * Supports configurable storage location with bundled fallback
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ScrapedData } from '../registry/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLED_DATA_PATH = join(__dirname, '..', 'registry', 'scraped-skills.json');
const DATA_FILENAME = 'skills-data.json';

/**
 * Get the data directory from environment or use default
 */
function getDataDir(): string | null {
  return process.env.SKILLS_DATA_DIR || null;
}

/**
 * Get the path to the external data file
 */
function getExternalDataPath(): string | null {
  const dataDir = getDataDir();
  if (!dataDir) return null;
  return join(dataDir, DATA_FILENAME);
}

/**
 * Load skills data from storage
 * Priority: External file > Bundled file
 */
export function loadSkillsData(): ScrapedData {
  const externalPath = getExternalDataPath();

  // Try external storage first
  if (externalPath && existsSync(externalPath)) {
    try {
      const content = readFileSync(externalPath, 'utf-8');
      console.info(`[Storage] Loaded data from ${externalPath}`);
      return JSON.parse(content) as ScrapedData;
    } catch (error) {
      console.error(`[Storage] Failed to load from ${externalPath}:`, error);
    }
  }

  // Fall back to bundled data
  if (existsSync(BUNDLED_DATA_PATH)) {
    const content = readFileSync(BUNDLED_DATA_PATH, 'utf-8');
    console.info('[Storage] Loaded bundled data');
    return JSON.parse(content) as ScrapedData;
  }

  // Return empty data if nothing exists
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
 * Save skills data to storage
 * Writes to external path if configured, otherwise bundled location
 */
export function saveSkillsData(data: ScrapedData): void {
  const externalPath = getExternalDataPath();

  if (externalPath) {
    // Ensure directory exists
    const dir = dirname(externalPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(externalPath, JSON.stringify(data, null, 2));
    console.info(`[Storage] Saved data to ${externalPath}`);
  } else {
    // Fall back to bundled location (development only)
    writeFileSync(BUNDLED_DATA_PATH, JSON.stringify(data, null, 2));
    console.info('[Storage] Saved data to bundled location');
  }
}

/**
 * Get the current data file path being used
 */
export function getDataFilePath(): string {
  const externalPath = getExternalDataPath();
  if (externalPath && existsSync(externalPath)) {
    return externalPath;
  }
  return BUNDLED_DATA_PATH;
}

/**
 * Check if using external storage
 */
export function isUsingExternalStorage(): boolean {
  return getDataDir() !== null;
}

/**
 * Get storage info for debugging
 */
export function getStorageInfo(): {
  dataDir: string | null;
  dataFile: string;
  isExternal: boolean;
  exists: boolean;
} {
  const externalPath = getExternalDataPath();
  const dataFile = externalPath && existsSync(externalPath) ? externalPath : BUNDLED_DATA_PATH;

  return {
    dataDir: getDataDir(),
    dataFile,
    isExternal: externalPath !== null && existsSync(externalPath),
    exists: existsSync(dataFile),
  };
}
