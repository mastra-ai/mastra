/**
 * Read-only catalog of the Factory skills bundled with the server.
 *
 * These are the built-in skills the Factory pipeline invokes at each stage
 * (triage, plan, review, …). The catalog reads the bundled `SKILL.md` files
 * so the settings UI can show users exactly what each skill instructs the
 * agent to do.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { FACTORY_SKILL_NAMES, FACTORY_SKILLS_SOURCE_PATH } from '../workspace.js';

export interface FactorySkillInfo {
  name: string;
  description: string;
  /** SKILL.md body with the frontmatter block removed. */
  content: string;
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
  return { name, description, content: content.trim() };
}

/** Internal skills that configure Factory itself rather than describe a pipeline stage. */
const INTERNAL_SKILL_NAMES = new Set(['configure-factory-rules']);

/** List the bundled Factory stage skills, skipping any missing from the bundle. */
export async function listFactorySkills(): Promise<FactorySkillInfo[]> {
  const skills: FactorySkillInfo[] = [];
  for (const name of [...FACTORY_SKILL_NAMES].filter(name => !INTERNAL_SKILL_NAMES.has(name)).sort()) {
    let raw: string;
    try {
      raw = await readFile(join(FACTORY_SKILLS_SOURCE_PATH, name, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }
    skills.push(parseSkillMarkdown(name, raw));
  }
  return skills;
}
