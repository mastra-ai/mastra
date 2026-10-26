/**
 * Factory skills written in code, beside the boards whose phases run them.
 *
 * Served as the top layer of the Factory skill mount: above the app's
 * `factory-skills/` folder and the bundled skills, so a code skill named after
 * a bundled one replaces it.
 */
import path from 'node:path';

import { validateSkillContent } from '@mastra/core/skills';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from '@mastra/core/workspace';

/** A skill a board phase can run by name (`runner.skill`). */
export interface FactorySkill {
  /** Lowercase letters, digits and hyphens; what `runner.skill` names. */
  name: string;
  /** One line telling the agent when the skill applies. */
  description: string;
  /** The skill body: the instructions the agent follows, in Markdown. */
  instructions: string;
}

function skillMarkdown(skill: FactorySkill): string {
  // JSON strings are valid YAML double-quoted scalars, so any description round-trips.
  return `---\nname: ${skill.name}\ndescription: ${JSON.stringify(skill.description)}\n---\n\n${skill.instructions.trim()}\n`;
}

function enoent(skillPath: string): Error {
  const error = new Error(`ENOENT: no such file or directory, '${skillPath}'`) as Error & { code: string };
  error.code = 'ENOENT';
  return error;
}

/**
 * Read-only skill source over code skills, addressed by mount-relative paths
 * (`''`, `<name>`, `<name>/SKILL.md`). Throws on construction when a skill
 * would not load, so a typo fails at boot instead of on a card's first run.
 */
export class CodeSkillSource implements SkillSource {
  readonly #files = new Map<string, string>();
  readonly #loadedAt = new Date();

  constructor(skills: readonly FactorySkill[]) {
    for (const skill of skills) {
      if (this.#files.has(skill.name)) throw new Error(`Factory skill "${skill.name}" is defined twice.`);
      const content = skillMarkdown(skill);
      const result = validateSkillContent({ content, directoryName: skill.name });
      if (!result.valid) throw new Error(`Factory skill "${skill.name}" is invalid: ${result.errors.join('; ')}`);
      this.#files.set(skill.name, content);
    }
  }

  get names(): string[] {
    return [...this.#files.keys()];
  }

  /** The skill's `SKILL.md`, as the agent reads it. */
  markdown(name: string): string | undefined {
    return this.#files.get(name);
  }

  #resolve(relativePath: string): { type: 'directory'; name: string } | { type: 'file'; content: string } | null {
    const parts = path
      .normalize(relativePath)
      .split(path.sep)
      .filter(part => part && part !== '.');
    if (parts.length === 0) return { type: 'directory', name: '' };
    const content = this.#files.get(parts[0]!);
    if (content === undefined) return null;
    if (parts.length === 1) return { type: 'directory', name: parts[0]! };
    if (parts.length === 2 && parts[1] === 'SKILL.md') return { type: 'file', content };
    return null;
  }

  async exists(relativePath: string): Promise<boolean> {
    return this.#resolve(relativePath) !== null;
  }

  async stat(relativePath: string): Promise<SkillSourceStat> {
    const entry = this.#resolve(relativePath);
    if (!entry) throw enoent(relativePath);
    return {
      name: path.basename(relativePath),
      type: entry.type,
      size: entry.type === 'file' ? Buffer.byteLength(entry.content) : 0,
      createdAt: this.#loadedAt,
      modifiedAt: this.#loadedAt,
      ...(entry.type === 'file' ? { mimeType: 'text/markdown' } : {}),
    };
  }

  async readFile(relativePath: string): Promise<string> {
    const entry = this.#resolve(relativePath);
    if (entry?.type !== 'file') throw enoent(relativePath);
    return entry.content;
  }

  async readdir(relativePath: string): Promise<SkillSourceEntry[]> {
    const entry = this.#resolve(relativePath);
    if (entry?.type !== 'directory') throw enoent(relativePath);
    if (entry.name === '') return this.names.map(name => ({ name, type: 'directory' }));
    return [{ name: 'SKILL.md', type: 'file' }];
  }

  async realpath(relativePath: string): Promise<string> {
    return relativePath;
  }
}
