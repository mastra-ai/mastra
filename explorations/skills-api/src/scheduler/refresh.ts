/**
 * Scheduled refresh for skills data
 * Periodically scrapes skills.sh to keep the registry up to date
 */

import { scrapeSkills, enrichSkills, getUniqueSources, getUniqueOwners } from '../scraper/scrape.js';
import { validateScrapedData, type ValidationResult } from '../scraper/validate.js';
import { saveSkillsDataAsync, getStorageInfo, getActiveStorageType, loadSkillsData } from '../storage/index.js';
import { reloadDataAsync } from '../registry/data.js';

export interface RefreshResult {
  success: boolean;
  timestamp: string;
  skillCount?: number;
  sourceCount?: number;
  ownerCount?: number;
  error?: string;
  durationMs?: number;
  storageType?: string;
  savedTo?: { s3: boolean; filesystem: boolean };
  validation?: ValidationResult;
  skipped?: boolean;
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
  const storageType = getActiveStorageType();

  try {
    console.info('[Scheduler] Starting skills refresh...');

    // Load current data for comparison
    let previousData = null;
    try {
      previousData = loadSkillsData();
    } catch {
      console.info('[Scheduler] No previous data to compare against');
    }

    const scrapedSkills = await scrapeSkills();
    const enriched = enrichSkills(scrapedSkills);

    // Validate scraped data before saving
    const validation = validateScrapedData(enriched, {
      minSkillCount: 1000,
      minSourceCount: 100,
      maxDropPercentage: 50,
      previousData,
    });

    // Log validation results
    if (validation.warnings.length > 0) {
      console.warn('[Scheduler] Validation warnings:');
      validation.warnings.forEach(w => console.warn(`  - ${w}`));
    }

    if (!validation.valid) {
      console.error('[Scheduler] Validation FAILED - not saving data:');
      validation.errors.forEach(e => console.error(`  - ${e}`));

      const result: RefreshResult = {
        success: false,
        timestamp: new Date().toISOString(),
        error: `Validation failed: ${validation.errors.join('; ')}`,
        durationMs: Date.now() - startTime,
        storageType,
        validation,
        skipped: true,
        skillCount: enriched.length,
        sourceCount: getUniqueSources(scrapedSkills).length,
      };

      lastRefreshResult = result;
      return result;
    }

    console.info(`[Scheduler] Validation passed: ${validation.stats.skillCount} skills, ${validation.stats.sourceCount} sources`);

    const output = {
      scrapedAt: new Date().toISOString(),
      totalSkills: enriched.length,
      totalSources: getUniqueSources(scrapedSkills).length,
      totalOwners: getUniqueOwners(scrapedSkills).length,
      skills: enriched,
    };

    // Save to storage (S3 + filesystem)
    const savedTo = await saveSkillsDataAsync(output);

    // Reload the in-memory cache
    await reloadDataAsync();

    const result: RefreshResult = {
      success: true,
      timestamp: output.scrapedAt,
      skillCount: output.totalSkills,
      sourceCount: output.totalSources,
      ownerCount: output.totalOwners,
      durationMs: Date.now() - startTime,
      storageType,
      savedTo,
      validation,
    };

    lastRefreshResult = result;
    console.info(
      `[Scheduler] Refresh complete: ${result.skillCount} skills, ${result.sourceCount} sources in ${result.durationMs}ms`,
    );
    if (savedTo.s3) console.info('[Scheduler] Data saved to S3');
    if (savedTo.filesystem) console.info('[Scheduler] Data saved to filesystem');

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

  const storageType = getActiveStorageType();
  const storageInfo = getStorageInfo();
  console.info(`[Scheduler] Starting scheduler with ${intervalMs / 1000 / 60} minute interval`);
  console.info(`[Scheduler] Storage type: ${storageType}`);
  if (storageInfo.s3.configured) {
    console.info(`[Scheduler] S3: s3://${storageInfo.s3.bucket}/${storageInfo.s3.key}`);
  }

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
