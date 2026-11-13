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
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { InlineSkill } from '@mastra/core/skills';
import { validateSkillContent } from '@mastra/core/skills';
import type { SkillSource } from '@mastra/core/workspace';

import type { SkillOverrideRecord } from '../storage/domains/skill-overrides/base.js';
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
  /** Frontmatter fields besides `name` and `description` (license, user-invocable, …), so an editor can keep them. */
  frontmatter?: Record<string, unknown>;
  origin: FactorySkillOrigin;
  /** True for the skills Factory ships, including when the app overrides one. */
  builtIn: boolean;
  /** Set when the SKILL.md fails the runtime's parsing/validation, so the agent will not be able to load it. */
  error?: string;
  /** Set when the project has an edited copy; `description` and `content` then come from the edit. */
  edited?: { updatedBy: string; updatedAt: string };
  /** True when the code, folder, or bundled SKILL.md changed since the project's edit was made. */
  originalChanged?: boolean;
}

/** The SKILL.md a skill resolves to without any project edit, and where it came from. */
export interface FactorySkillOriginal {
  raw: string;
  origin: FactorySkillOrigin;
}

/** Fingerprint of an original SKILL.md, stored with an edit so the catalog can tell when the original moved on. */
export function hashSkillContent(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function parseSkillMarkdown(
  name: string,
  raw: string,
): Pick<FactorySkillInfo, 'description' | 'content' | 'frontmatter' | 'error'> {
  // Use the same parser and validation the runtime applies when loading skills,
  // so the catalog never shows a skill as healthy that the agent will drop.
  const result = validateSkillContent({ content: raw, directoryName: name });
  const description = typeof result.metadata?.description === 'string' ? result.metadata.description : '';
  const content = result.instructions ?? stripFrontmatter(raw);
  const extra = Object.entries(result.metadata ?? {}).filter(
    ([key, value]) => key !== 'name' && key !== 'description' && value !== undefined,
  );
  const frontmatter = extra.length > 0 ? { frontmatter: Object.fromEntries(extra) } : {};
  if (!result.valid) return { description, content, ...frontmatter, error: result.errors.join('\n') };
  return { description, content, ...frontmatter };
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
 * Read the original SKILL.md of every skill the Factory skill mount serves,
 * keyed by name. Code skills win over folder skills, which win over bundled
 * skills of the same name.
 */
export async function readFactorySkillOriginals(
  codeSkills: readonly InlineSkill[] = [],
): Promise<Map<string, FactorySkillOriginal>> {
  const localRoot = resolveLocalFactorySkillsPath();
  const source = new FactorySkillSource(NO_REPOSITORY_SKILLS, [], localRoot, async () => true, codeSkills);
  const codeNames = new Set(codeSkills.map(skill => skill.name));
  const entries = (await source.readdir(FACTORY_SKILLS_MOUNT)).filter(entry => entry.type === 'directory');
  const originals = new Map<string, FactorySkillOriginal>();
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
    originals.set(name, { raw, origin });
  }
  return originals;
}

/**
 * List the skills the Factory skill mount serves, sorted by name. With a
 * project's `overrides`, edited skills show the edited text, who edited them,
 * and whether the original changed since. Edits of skills that no longer
 * exist are not listed, matching what sessions load.
 */
export async function listFactorySkills(
  codeSkills: readonly InlineSkill[] = [],
  overrides: readonly SkillOverrideRecord[] = [],
): Promise<FactorySkillInfo[]> {
  const edits = new Map(overrides.map(override => [override.skillName, override]));
  const skills: FactorySkillInfo[] = [];
  for (const [name, { raw, origin }] of await readFactorySkillOriginals(codeSkills)) {
    const edit = edits.get(name);
    const builtIn = FACTORY_SKILL_NAMES.has(name);
    if (!edit) {
      skills.push({ name, ...parseSkillMarkdown(name, raw), origin, builtIn });
      continue;
    }
    skills.push({
      name,
      ...parseSkillMarkdown(name, edit.content),
      origin,
      builtIn,
      edited: { updatedBy: edit.updatedBy, updatedAt: edit.updatedAt.toISOString() },
      originalChanged: hashSkillContent(raw) !== edit.baseHash,
    });
  }
  return skills;
}
