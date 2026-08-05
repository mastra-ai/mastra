/**
 * InlineSkillSource — in-memory SkillSource for code-defined skills.
 *
 * Serves skills created via `createSkill()` without any filesystem dependency.
 * Implements the SkillSource interface so it can be used with WorkspaceSkillsImpl.
 *
 * Directory layout emulation:
 * Each inline skill appears as a directory at `inline/<name>/` with:
 * - SKILL.md (generated from the skill's metadata + instructions)
 * - references/<file> (from the skill's `references` map)
 */

import matter from 'gray-matter';

import type { SkillSource, SkillSourceEntry, SkillSourceStat } from '../workspace/skills/skill-source';
import type { InlineSkill } from './types';

export class InlineSkillSource implements SkillSource {
  readonly #skills: Map<string, InlineSkill>;
  /** Pre-built SKILL.md content per skill name */
  readonly #skillMdCache: Map<string, string>;

  constructor(skills: InlineSkill[]) {
    this.#skills = new Map(skills.map(s => [s.name, s]));
    this.#skillMdCache = new Map();

    for (const skill of skills) {
      this.#skillMdCache.set(skill.name, this.#buildSkillMd(skill));
    }
  }

  /**
   * Build a synthetic SKILL.md from an inline skill's metadata and instructions.
   */
  #buildSkillMd(skill: InlineSkill): string {
    const frontmatter: Record<string, unknown> = {
      name: skill.name,
      description: skill.description,
    };
    if (skill.license) frontmatter.license = skill.license;
    if (skill.compatibility) frontmatter.compatibility = skill.compatibility;
    if (skill['user-invocable'] !== undefined) frontmatter['user-invocable'] = skill['user-invocable'];
    if (skill.metadata) frontmatter.metadata = skill.metadata;

    return matter.stringify(skill.instructions, frontmatter);
  }

  /**
   * Parse a path into skill name and relative sub-path.
   * Paths look like `inline/<name>`, `inline/<name>/SKILL.md`, `inline/<name>/references/file.md`
   */
  #parsePath(inputPath: string): { skillName: string; subPath: string } | null {
    const prefix = 'inline/';
    if (!inputPath.startsWith(prefix)) return null;

    const rest = inputPath.slice(prefix.length);
    const slashIdx = rest.indexOf('/');
    if (slashIdx === -1) {
      return { skillName: rest, subPath: '' };
    }
    return { skillName: rest.slice(0, slashIdx), subPath: rest.slice(slashIdx + 1) };
  }

  #getSkill(inputPath: string): { skill: InlineSkill; subPath: string } | null {
    const parsed = this.#parsePath(inputPath);
    if (!parsed) return null;
    const skill = this.#skills.get(parsed.skillName);
    if (!skill) return null;
    return { skill, subPath: parsed.subPath };
  }

  async exists(path: string): Promise<boolean> {
    const result = this.#getSkill(path);
    if (!result) return false;

    const { skill, subPath } = result;

    // Root skill directory
    if (subPath === '') return true;
    // SKILL.md
    if (subPath === 'SKILL.md') return true;
    // references/ directory
    if (subPath === 'references') return (skill.references?.length ?? 0) > 0;
    // references/<file>
    if (subPath.startsWith('references/')) {
      const refPath = subPath.slice('references/'.length);
      return skill.references.includes(refPath);
    }
    return false;
  }

  async stat(path: string): Promise<SkillSourceStat> {
    const result = this.#getSkill(path);
    if (!result) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }

    const { skill, subPath } = result;
    const now = new Date();

    // Root skill directory
    if (subPath === '') {
      return { name: skill.name, type: 'directory', size: 0, createdAt: now, modifiedAt: now };
    }
    // SKILL.md
    if (subPath === 'SKILL.md') {
      const content = this.#skillMdCache.get(skill.name) ?? '';
      return {
        name: 'SKILL.md',
        type: 'file',
        size: Buffer.byteLength(content, 'utf-8'),
        createdAt: now,
        modifiedAt: now,
        mimeType: 'text/markdown',
      };
    }
    // references/ directory
    if (subPath === 'references') {
      return { name: 'references', type: 'directory', size: 0, createdAt: now, modifiedAt: now };
    }

    throw new Error(`ENOENT: no such file or directory: ${path}`);
  }

  async readFile(path: string): Promise<string | Buffer> {
    const result = this.#getSkill(path);
    if (!result) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }

    const { skill, subPath } = result;

    // SKILL.md
    if (subPath === 'SKILL.md') {
      return this.#skillMdCache.get(skill.name) ?? '';
    }

    // references/<file> — look up in the inline skill's bundled reference contents
    if (subPath.startsWith('references/')) {
      const refPath = subPath.slice('references/'.length);
      const content = skill.__referenceContents[refPath];
      if (content !== undefined) return content;
    }

    throw new Error(`ENOENT: no such file or directory: ${path}`);
  }

  async readdir(path: string): Promise<SkillSourceEntry[]> {
    const parsed = this.#parsePath(path);

    // Listing the root of all inline skills (when path is just the prefix base)
    // This shouldn't normally be called, but handle it gracefully
    if (!parsed) return [];

    const { skillName, subPath } = parsed;
    const skill = this.#skills.get(skillName);
    if (!skill) return [];

    // Root skill directory
    if (subPath === '') {
      const entries: SkillSourceEntry[] = [{ name: 'SKILL.md', type: 'file' }];
      if (skill.references.length > 0) {
        entries.push({ name: 'references', type: 'directory' });
      }
      return entries;
    }

    // references/ directory
    if (subPath === 'references') {
      return skill.references.map(ref => ({ name: ref, type: 'file' as const }));
    }

    return [];
  }
}
