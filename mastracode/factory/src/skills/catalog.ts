/**
 * Read-only catalog of the Factory skills.
 *
 * Lists every skill the Factory skill mount serves — the built-in skills the
 * pipeline invokes at each stage (triage, plan, review, …) and the app's own
 * skills from `MastraFactory({ skills })` or its `factory-skills/` folder. It
 * reads them through the same `FactorySkillSource` sessions use, so the
 * settings UI shows exactly what each skill instructs the agent to do — and
 * whether the runtime can load it.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { InlineSkill } from '@mastra/core/skills';
import { validateSkillContent } from '@mastra/core/skills';
import type { SkillSource } from '@mastra/core/workspace';

import {
  FACTORY_SKILL_NAMES,
  FACTORY_SKILLS_MOUNT,
  FactorySkillSource,
  resolveLocalFactorySkillsPath,
} from '../workspace.js';

/** Where a skill comes from: shipped with Factory, the app's `factory-skills/` folder, or `MastraFactory({ skills })`. */
export type FactorySkillOrigin = 'bundled' | 'folder' | 'code';

export interface FactorySkillInfo {
  name: string;
  description: string;
  /** SKILL.md body with the frontmatter block removed. */
  content: string;
  origin: FactorySkillOrigin;
  /** True for the skills Factory ships, including when the app overrides one. */
  builtIn: boolean;
  /** Set when the SKILL.md fails the runtime's parsing/validation, so the agent will not be able to load it. */
  error?: string;
}

function parseSkillMarkdown(name: string, raw: string): Pick<FactorySkillInfo, 'description' | 'content' | 'error'> {
  // Use the same parser and validation the runtime applies when loading skills,
  // so the catalog never shows a skill as healthy that the agent will drop.
  const result = validateSkillContent({ content: raw, directoryName: name });
  const description = typeof result.metadata?.description === 'string' ? result.metadata.description : '';
  const content = result.instructions ?? stripFrontmatter(raw);
  if (!result.valid) return { description, content, error: result.errors.join('\n') };
  return { description, content };
}

/** Best-effort body extraction when the frontmatter cannot be parsed, so users can still read the file they need to fix. */
function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return (match ? raw.slice(match[0].length) : raw).trim();
}

const NO_REPOSITORY_SKILLS: SkillSource = {
  exists: async () => false,
  stat: async path => {
    throw new Error(`ENOENT: no such file or directory, '${path}'`);
  },
  readFile: async path => {
    throw new Error(`ENOENT: no such file or directory, '${path}'`);
  },
  readdir: async () => [],
};

/**
 * List the skills the Factory skill mount serves, sorted by name. Code skills
 * win over folder skills, which win over bundled skills of the same name.
 */
export async function listFactorySkills(codeSkills: readonly InlineSkill[] = []): Promise<FactorySkillInfo[]> {
  const localRoot = resolveLocalFactorySkillsPath();
  const source = new FactorySkillSource(NO_REPOSITORY_SKILLS, [], localRoot, async () => true, codeSkills);
  const codeNames = new Set(codeSkills.map(skill => skill.name));
  const entries = (await source.readdir(FACTORY_SKILLS_MOUNT)).filter(entry => entry.type === 'directory');
  const skills: FactorySkillInfo[] = [];
  for (const name of entries.map(entry => entry.name).sort()) {
    let raw: string;
    try {
      raw = String(await source.readFile(join(FACTORY_SKILLS_MOUNT, name, 'SKILL.md')));
    } catch {
      continue;
    }
    const origin: FactorySkillOrigin = codeNames.has(name)
      ? 'code'
      : localRoot && existsSync(join(localRoot, name, 'SKILL.md'))
        ? 'folder'
        : 'bundled';
    skills.push({ name, ...parseSkillMarkdown(name, raw), origin, builtIn: FACTORY_SKILL_NAMES.has(name) });
  }
  return skills;
}
