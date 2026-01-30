/**
 * Skills.sh Scraper
 * Extracts skills data from the skills.sh website
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ScrapedSkill {
  source: string;
  skillId: string;
  name: string;
  installs: number;
}

export interface EnrichedSkill extends ScrapedSkill {
  /** GitHub owner */
  owner: string;
  /** GitHub repo */
  repo: string;
  /** Full GitHub URL */
  githubUrl: string;
  /** Display name (formatted from name) */
  displayName: string;
}

/**
 * Scrape skills from skills.sh
 */
export async function scrapeSkills(): Promise<ScrapedSkill[]> {
  const response = await fetch('https://skills.sh');
  const html = await response.text();

  // Find the allTimeSkills array in the escaped JSON
  const match = html.match(/allTimeSkills\\":\[(.*?)\]/);
  if (!match) {
    throw new Error('Could not find allTimeSkills in page');
  }

  // Unescape the JSON
  let jsonStr = '[' + match[1] + ']';
  jsonStr = jsonStr.replace(/\\"/g, '"');

  const skills: ScrapedSkill[] = JSON.parse(jsonStr);
  return skills;
}

/**
 * Enrich skills with additional computed fields
 */
export function enrichSkills(skills: ScrapedSkill[]): EnrichedSkill[] {
  return skills.map(skill => {
    const parts = skill.source.split('/');
    const owner = parts[0] ?? '';
    const repo = parts[1] ?? '';
    return {
      ...skill,
      owner,
      repo,
      githubUrl: `https://github.com/${skill.source}`,
      displayName: formatDisplayName(skill.name),
    };
  });
}

/**
 * Format skill name as display name
 */
function formatDisplayName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get unique sources (repositories) from skills
 */
export function getUniqueSources(skills: ScrapedSkill[]): string[] {
  const sources = new Set<string>();
  for (const skill of skills) {
    sources.add(skill.source);
  }
  return Array.from(sources).sort();
}

/**
 * Get unique owners from skills
 */
export function getUniqueOwners(skills: ScrapedSkill[]): string[] {
  const owners = new Set<string>();
  for (const skill of skills) {
    const owner = skill.source.split('/')[0];
    if (owner) {
      owners.add(owner);
    }
  }
  return Array.from(owners).sort();
}

/**
 * Main scraper function - scrapes and saves to JSON file
 */
export async function scrapeAndSave(outputPath?: string): Promise<void> {
  console.info('Scraping skills from skills.sh...');

  const scrapedSkills = await scrapeSkills();
  console.info(`Found ${scrapedSkills.length} skills`);

  const enriched = enrichSkills(scrapedSkills);

  const output = {
    scrapedAt: new Date().toISOString(),
    totalSkills: enriched.length,
    totalSources: getUniqueSources(scrapedSkills).length,
    totalOwners: getUniqueOwners(scrapedSkills).length,
    skills: enriched,
  };

  const defaultPath = join(__dirname, '..', 'registry', 'scraped-skills.json');
  const filePath = outputPath ?? defaultPath;
  writeFileSync(filePath, JSON.stringify(output, null, 2));
  console.info(`Saved to ${filePath}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeAndSave().catch(console.error);
}
