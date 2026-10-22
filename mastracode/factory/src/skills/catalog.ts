/**
 * Read-only catalog of the Factory skills.
 *
 * These are the built-in skills the Factory pipeline invokes at each stage
 * (triage, plan, review, …). The catalog reads each `SKILL.md` (repo-local
 * override first, then bundled) so the settings UI can show users exactly what
 * each skill instructs the agent to do — and whether the runtime can load it.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { validateSkillContent } from '@mastra/core/skills';

import { BUNDLED_FACTORY_SKILLS_PATH, FACTORY_SKILL_NAMES, resolveLocalFactorySkillsPath } from '../workspace.js';

export interface FactorySkillInfo {
  name: string;
  description: string;
  /** SKILL.md body with the frontmatter block removed. */
  content: string;
  /** Set when the SKILL.md fails the runtime's parsing/validation, so the agent will not be able to load it. */
  error?: string;
}

function parseSkillMarkdown(name: string, raw: string): FactorySkillInfo {
  // Use the same parser and validation the runtime applies when loading skills,
  // so the catalog never shows a skill as healthy that the agent will drop.
  const result = validateSkillContent({ content: raw, directoryName: name });
  const description = typeof result.metadata?.description === 'string' ? result.metadata.description : '';
  const content = result.instructions ?? stripFrontmatter(raw);
  if (!result.valid) return { name, description, content, error: result.errors.join('\n') };
  return { name, description, content };
}

/** Best-effort body extraction when the frontmatter cannot be parsed, so users can still read the file they need to fix. */
function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return (match ? raw.slice(match[0].length) : raw).trim();
}

/**
 * List the Factory skills, preferring repo-local versions over bundled ones and
 * skipping any skill missing from both roots.
 */
export async function listFactorySkills(): Promise<FactorySkillInfo[]> {
  const skills: FactorySkillInfo[] = [];
  const localRoot = resolveLocalFactorySkillsPath();
  const roots = localRoot ? [localRoot, BUNDLED_FACTORY_SKILLS_PATH] : [BUNDLED_FACTORY_SKILLS_PATH];
  for (const name of [...FACTORY_SKILL_NAMES].sort()) {
    let raw: string | undefined;
    // Repo-local skills override the bundled versions, matching runtime resolution.
    for (const root of roots) {
      try {
        raw = await readFile(join(root, name, 'SKILL.md'), 'utf8');
        break;
      } catch {
        continue;
      }
    }
    if (raw === undefined) continue;
    skills.push(parseSkillMarkdown(name, raw));
  }
  return skills;
}
