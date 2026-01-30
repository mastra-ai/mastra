/**
 * Validation for scraped skills data
 * Ensures we don't overwrite good data with bad/empty data
 */

import type { ScrapedData } from '../registry/types.js';
import type { EnrichedSkill } from './scrape.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    skillCount: number;
    sourceCount: number;
    ownerCount: number;
    avgInstalls: number;
  };
}

export interface ValidationOptions {
  /** Minimum number of skills required (default: 1000) */
  minSkillCount?: number;
  /** Minimum number of sources required (default: 100) */
  minSourceCount?: number;
  /** Maximum percentage drop from previous data allowed (default: 50%) */
  maxDropPercentage?: number;
  /** Previous data for comparison */
  previousData?: ScrapedData | null;
}

/**
 * Validate scraped skills data before saving
 */
export function validateScrapedData(
  skills: EnrichedSkill[],
  options: ValidationOptions = {}
): ValidationResult {
  const {
    minSkillCount = 1000,
    minSourceCount = 100,
    maxDropPercentage = 50,
    previousData,
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Calculate stats
  const sources = new Set(skills.map(s => s.source));
  const owners = new Set(skills.map(s => s.owner));
  const totalInstalls = skills.reduce((sum, s) => sum + s.installs, 0);
  const avgInstalls = skills.length > 0 ? totalInstalls / skills.length : 0;

  const stats = {
    skillCount: skills.length,
    sourceCount: sources.size,
    ownerCount: owners.size,
    avgInstalls: Math.round(avgInstalls),
  };

  // Check minimum skill count
  if (skills.length < minSkillCount) {
    errors.push(
      `Skill count (${skills.length}) below minimum threshold (${minSkillCount}). ` +
      `This likely indicates a scraping failure.`
    );
  }

  // Check minimum source count
  if (sources.size < minSourceCount) {
    errors.push(
      `Source count (${sources.size}) below minimum threshold (${minSourceCount}). ` +
      `This likely indicates incomplete data.`
    );
  }

  // Check for empty skills array
  if (skills.length === 0) {
    errors.push('No skills scraped. The page structure may have changed.');
  }

  // Validate skill structure (sample check)
  const sampleSize = Math.min(100, skills.length);
  let malformedCount = 0;
  
  for (let i = 0; i < sampleSize; i++) {
    const skill = skills[i];
    if (!skill || !skill.source || !skill.skillId || !skill.name) {
      malformedCount++;
    }
  }

  if (malformedCount > sampleSize * 0.1) {
    errors.push(
      `${malformedCount}/${sampleSize} sampled skills have missing required fields. ` +
      `Data structure may have changed.`
    );
  }

  // Compare with previous data if available
  if (previousData && previousData.skills.length > 0) {
    const dropPercentage = 
      ((previousData.skills.length - skills.length) / previousData.skills.length) * 100;

    if (dropPercentage > maxDropPercentage) {
      errors.push(
        `Skill count dropped by ${dropPercentage.toFixed(1)}% ` +
        `(${previousData.skills.length} → ${skills.length}). ` +
        `This exceeds the maximum allowed drop of ${maxDropPercentage}%.`
      );
    } else if (dropPercentage > 10) {
      warnings.push(
        `Skill count dropped by ${dropPercentage.toFixed(1)}% ` +
        `(${previousData.skills.length} → ${skills.length}).`
      );
    }

    // Check if install counts make sense (shouldn't drop dramatically)
    const prevTotalInstalls = previousData.skills.reduce((sum, s) => sum + s.installs, 0);
    if (totalInstalls < prevTotalInstalls * 0.5) {
      warnings.push(
        `Total installs dropped significantly. This may indicate data issues.`
      );
    }
  }

  // Check for suspicious patterns
  const uniqueNames = new Set(skills.map(s => s.name));
  if (uniqueNames.size < skills.length * 0.9) {
    warnings.push(
      `High duplicate name ratio detected (${uniqueNames.size} unique / ${skills.length} total).`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

/**
 * Quick validation for emergency checks
 */
export function isDataUsable(skills: EnrichedSkill[]): boolean {
  // Absolute minimum - we need SOME data
  if (skills.length < 100) return false;
  
  // Check basic structure
  const sample = skills.slice(0, 10);
  return sample.every(s => s.source && s.skillId && s.name);
}
