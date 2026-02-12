/**
 * LocalSkillSource - Read-only skill source backed by local filesystem.
 *
 * Uses Node.js fs/promises to read skills directly from disk.
 * This allows skills to be loaded without requiring a full WorkspaceFilesystem.
 *
 * @example
 * ```typescript
 * const source = new LocalSkillSource({
 *   basePath: process.cwd(),
 * });
 *
 * // skills paths are relative to basePath
 * const skillsImpl = new WorkspaceSkillsImpl({
 *   source,
 *   skills: ['./skills', './node_modules/@company/skills'],
 * });
 * ```
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { fsExists, fsStat, isTextFile } from '../filesystem';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from './skill-source';

/**
 * Configuration for LocalSkillSource.
 */
export interface LocalSkillSourceOptions {
  /**
   * Base path for resolving relative skill paths.
   * Defaults to process.cwd().
   */
  basePath?: string;
}

/**
 * Read-only skill source that loads skills from the local filesystem.
 *
 * Unlike WorkspaceFilesystem, this doesn't provide write operations.
 * Skills loaded from this source are read-only.
 */
export class LocalSkillSource implements SkillSource {
  readonly #basePath: string;

  constructor(options: LocalSkillSourceOptions = {}) {
    this.#basePath = options.basePath ?? process.cwd();
  }

  /**
   * Resolve a path relative to the base path.
   * Handles both absolute and relative paths.
   */
  #resolvePath(skillPath: string): string {
    if (path.isAbsolute(skillPath)) {
      return skillPath;
    }
    return path.resolve(this.#basePath, skillPath);
  }

  async exists(skillPath: string): Promise<boolean> {
    return fsExists(this.#resolvePath(skillPath));
  }

  async stat(skillPath: string): Promise<SkillSourceStat> {
    return fsStat(this.#resolvePath(skillPath), skillPath);
  }

  async readFile(skillPath: string): Promise<string | Buffer> {
    const resolved = this.#resolvePath(skillPath);
    const content = await fs.readFile(resolved);
    // Convert to string for text files
    if (isTextFile(skillPath)) {
      return content.toString('utf-8');
    }
    return content;
  }

  async readdir(skillPath: string): Promise<SkillSourceEntry[]> {
    const resolved = this.#resolvePath(skillPath);
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    // Note: Dirent.isDirectory() returns false for symlinks pointing to directories,
    // so symlinked directories appear as { type: 'file', isSymlink: true }. This is
    // intentional — #walkForDirectories skips symlinks to prevent cycles, and treating
    // them as files ensures they're never recursed into by other consumers either.
    return entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      isSymlink: entry.isSymbolicLink() || undefined,
    }));
  }
}
