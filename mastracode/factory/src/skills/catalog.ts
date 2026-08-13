/**
 * Catalog of the Factory skills bundled with the server.
 *
 * These are the built-in skills the Factory pipeline invokes at each stage
 * (triage, plan, review, …). The catalog reads the bundled `SKILL.md` files
 * so the settings UI can show users exactly what each skill instructs the
 * agent to do. When a stored override exists for a skill, its description
 * and content replace the bundled defaults and the entry is marked
 * `isCustomized`.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SkillOverrideRecord } from '../storage/domains/skill-overrides/base.js';
import { FACTORY_SKILL_NAMES, FACTORY_SKILLS_SOURCE_PATH } from '../workspace.js';

export interface FactorySkillInfo {
  name: string;
  description: string;
  /** SKILL.md body with the frontmatter block removed. */
  content: string;
  /** Whether a stored user override replaces the bundled default. */
  isCustomized: boolean;
}

function parseSkillMarkdown(name: string, raw: string): FactorySkillInfo {
  const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  let description = '';
  let content = raw;
  if (frontmatterMatch?.[1] !== undefined) {
    content = raw.slice(frontmatterMatch[0].length);
    const descriptionLine = frontmatterMatch[1].match(/^description:\s*(.+)$/m);
    if (descriptionLine?.[1]) description = descriptionLine[1].trim();
  }
  return { name, description, content: content.trim(), isCustomized: false };
}

/**
 * List the bundled Factory skills, skipping any missing from the bundle.
 * Entries with a matching override return the customized description/content.
 */
export async function listFactorySkills(
  overrides: Pick<SkillOverrideRecord, 'name' | 'description' | 'content'>[] = [],
): Promise<FactorySkillInfo[]> {
  const overrideByName = new Map(overrides.map(override => [override.name, override]));
  const skills: FactorySkillInfo[] = [];
  for (const name of [...FACTORY_SKILL_NAMES].sort()) {
    let raw: string;
    try {
      raw = await readFile(join(FACTORY_SKILLS_SOURCE_PATH, name, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }
    const parsed = parseSkillMarkdown(name, raw);
    const override = overrideByName.get(name);
    skills.push(
      override ? { name, description: override.description, content: override.content, isCustomized: true } : parsed,
    );
  }
  return skills;
}
