/**
 * Skills Registry Data
 * Loaded from scraped skills.sh data with support for dynamic reloading
 */

import { loadSkillsData, loadSkillsDataAsync } from '../storage/index.js';
import type { RegistrySkill, ScrapedData, Source } from './types.js';

// Cache for skills data
let cachedData: ScrapedData | null = null;

/**
 * Get the current scraped data, loading if necessary
 */
function getData(): ScrapedData {
  if (!cachedData) {
    cachedData = loadSkillsData();
  }
  return cachedData;
}

/**
 * Reload data from storage (called after refresh)
 */
export function reloadData(): void {
  cachedData = loadSkillsData();
}

/**
 * Reload data from storage async (supports S3)
 */
export async function reloadDataAsync(): Promise<void> {
  cachedData = await loadSkillsDataAsync();
}

/**
 * Initialize data async (for startup with S3)
 */
export async function initializeData(): Promise<void> {
  if (!cachedData) {
    cachedData = await loadSkillsDataAsync();
  }
}

/**
 * All skills from the registry
 */
export function getSkills(): RegistrySkill[] {
  return getData().skills;
}

/**
 * Legacy export for backwards compatibility
 */
export const skills: RegistrySkill[] = new Proxy([] as RegistrySkill[], {
  get(_, prop) {
    const data = getSkills();
    if (prop === 'length') return data.length;
    if (typeof prop === 'string' && !isNaN(Number(prop))) {
      return data[Number(prop)];
    }
    if (prop === Symbol.iterator) {
      return data[Symbol.iterator].bind(data);
    }
    // @ts-expect-error - dynamic property access
    return typeof data[prop] === 'function' ? data[prop].bind(data) : data[prop];
  },
});

/**
 * Metadata about when the data was scraped
 */
export function getMetadata() {
  const data = getData();
  return {
    scrapedAt: data.scrapedAt,
    totalSkills: data.totalSkills,
    totalSources: data.totalSources,
    totalOwners: data.totalOwners,
  };
}

/**
 * Legacy export for backwards compatibility
 */
export const metadata = new Proxy({} as ReturnType<typeof getMetadata>, {
  get(_, prop) {
    return getMetadata()[prop as keyof ReturnType<typeof getMetadata>];
  },
});

/**
 * Get all unique sources (repositories) with counts
 */
export function getSources(): Source[] {
  const sourceMap = new Map<string, Source>();
  const skillsData = getSkills();

  for (const skill of skillsData) {
    const existing = sourceMap.get(skill.source);
    if (existing) {
      existing.skillCount++;
      existing.totalInstalls += skill.installs;
    } else {
      sourceMap.set(skill.source, {
        source: skill.source,
        owner: skill.owner,
        repo: skill.repo,
        skillCount: 1,
        totalInstalls: skill.installs,
      });
    }
  }

  return Array.from(sourceMap.values()).sort((a, b) => b.totalInstalls - a.totalInstalls);
}

/**
 * Get all unique owners with counts
 */
export function getOwners(): Array<{ owner: string; skillCount: number; totalInstalls: number }> {
  const ownerMap = new Map<string, { owner: string; skillCount: number; totalInstalls: number }>();
  const skillsData = getSkills();

  for (const skill of skillsData) {
    const existing = ownerMap.get(skill.owner);
    if (existing) {
      existing.skillCount++;
      existing.totalInstalls += skill.installs;
    } else {
      ownerMap.set(skill.owner, {
        owner: skill.owner,
        skillCount: 1,
        totalInstalls: skill.installs,
      });
    }
  }

  return Array.from(ownerMap.values()).sort((a, b) => b.totalInstalls - a.totalInstalls);
}

/**
 * Get top skills by installs
 */
export function getTopSkills(limit = 100): RegistrySkill[] {
  return [...getSkills()].sort((a, b) => b.installs - a.installs).slice(0, limit);
}

/**
 * Get top sources by total installs
 */
export function getTopSources(limit = 50): Source[] {
  return getSources().slice(0, limit);
}
