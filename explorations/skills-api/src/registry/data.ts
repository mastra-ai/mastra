/**
 * Skills Registry Data
 * Loaded from scraped skills.sh data
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RegistrySkill, ScrapedData, Source } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load scraped skills data from JSON file
 */
function loadScrapedData(): ScrapedData {
  const filePath = join(__dirname, 'scraped-skills.json');
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as ScrapedData;
}

// Load data once at module initialization
const scrapedData = loadScrapedData();

/**
 * All skills from the registry
 */
export const skills: RegistrySkill[] = scrapedData.skills;

/**
 * Metadata about when the data was scraped
 */
export const metadata = {
  scrapedAt: scrapedData.scrapedAt,
  totalSkills: scrapedData.totalSkills,
  totalSources: scrapedData.totalSources,
  totalOwners: scrapedData.totalOwners,
};

/**
 * Get all unique sources (repositories) with counts
 */
export function getSources(): Source[] {
  const sourceMap = new Map<string, Source>();

  for (const skill of skills) {
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

  for (const skill of skills) {
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
  return [...skills].sort((a, b) => b.installs - a.installs).slice(0, limit);
}

/**
 * Get top sources by total installs
 */
export function getTopSources(limit = 50): Source[] {
  return getSources().slice(0, limit);
}
