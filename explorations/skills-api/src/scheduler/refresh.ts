/**
 * Scheduled refresh for skills data
 * Periodically scrapes skills.sh to keep the registry up to date
 */

import { scrapeSkills, enrichSkills, getUniqueSources, getUniqueOwners } from '../scraper/scrape.js';
import { saveSkillsData, loadSkillsData, getStorageInfo } from '../storage/index.js';
import { reloadData } from '../registry/data.js';

export interface RefreshResult {
  success: boolean;
  timestamp: string;
  skillCount?: number;
  sourceCount?: number;
  ownerCount?: number;
  error?: string;
  durationMs?: number;
  storagePath?: string;
}

export interface RefreshSchedulerOptions {
  /** Refresh interval in milliseconds (default: 30 minutes) */
  intervalMs?: number;
  /** Callback when refresh completes */
  onRefresh?: (result: RefreshResult) => void;
  /** Callback on refresh error */
  onError?: (error: Error) => void;
  /** Whether to refresh immediately on start */
  refreshOnStart?: boolean;
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let isRefreshing = false;
let lastRefreshResult: RefreshResult | null = null;

/**
 * Perform a single refresh of the skills data
 */
export async function refreshSkillsData(): Promise<RefreshResult> {
  if (isRefreshing) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: 'Refresh already in progress',
    };
  }

  isRefreshing = true;
  const startTime = Date.now();
  const storageInfo = getStorageInfo();

  try {
    console.info('[Scheduler] Starting skills refresh...');

    const scrapedSkills = await scrapeSkills();
    const enriched = enrichSkills(scrapedSkills);

    const output = {
      scrapedAt: new Date().toISOString(),
      totalSkills: enriched.length,
      totalSources: getUniqueSources(scrapedSkills).length,
      totalOwners: getUniqueOwners(scrapedSkills).length,
      skills: enriched,
    };

    // Save to storage
    saveSkillsData(output);

    // Reload the in-memory cache
    reloadData();

    const result: RefreshResult = {
      success: true,
      timestamp: output.scrapedAt,
      skillCount: output.totalSkills,
      sourceCount: output.totalSources,
      ownerCount: output.totalOwners,
      durationMs: Date.now() - startTime,
      storagePath: storageInfo.dataFile,
    };

    lastRefreshResult = result;
    console.info(
      `[Scheduler] Refresh complete: ${result.skillCount} skills, ${result.sourceCount} sources in ${result.durationMs}ms`,
    );

    return result;
  } catch (error) {
    const result: RefreshResult = {
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    };

    lastRefreshResult = result;
    console.error('[Scheduler] Refresh failed:', result.error);

    return result;
  } finally {
    isRefreshing = false;
  }
}

/**
 * Start the refresh scheduler
 */
export function startRefreshScheduler(options: RefreshSchedulerOptions = {}): void {
  const { intervalMs = 30 * 60 * 1000, onRefresh, onError, refreshOnStart = false } = options;

  if (refreshTimer) {
    console.info('[Scheduler] Scheduler already running');
    return;
  }

  const storageInfo = getStorageInfo();
  console.info(`[Scheduler] Starting scheduler with ${intervalMs / 1000 / 60} minute interval`);
  console.info(`[Scheduler] Data storage: ${storageInfo.dataFile} (external: ${storageInfo.isExternal})`);

  // Optionally refresh immediately
  if (refreshOnStart) {
    refreshSkillsData()
      .then(result => onRefresh?.(result))
      .catch(error => onError?.(error));
  }

  // Schedule periodic refresh
  refreshTimer = setInterval(async () => {
    try {
      const result = await refreshSkillsData();
      onRefresh?.(result);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, intervalMs);

  // Don't block process exit
  refreshTimer.unref();
}

/**
 * Stop the refresh scheduler
 */
export function stopRefreshScheduler(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    console.info('[Scheduler] Scheduler stopped');
  }
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return refreshTimer !== null;
}

/**
 * Check if a refresh is currently in progress
 */
export function isRefreshInProgress(): boolean {
  return isRefreshing;
}

/**
 * Get the last refresh result
 */
export function getLastRefreshResult(): RefreshResult | null {
  return lastRefreshResult;
}

/**
 * Get the timestamp of the current data
 */
export function getCurrentDataTimestamp(): string | null {
  try {
    const data = loadSkillsData();
    return data.scrapedAt || null;
  } catch {
    return null;
  }
}
