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
 * // skillsPaths are relative to basePath
 * const skills = new WorkspaceSkillsImpl({
 *   source,
 *   skillsPaths: ['./skills', './node_modules/@company/skills'],
 * });
 * ```
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

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
    try {
      await fs.access(this.#resolvePath(skillPath));
      return true;
    } catch {
      return false;
    }
  }

  async stat(skillPath: string): Promise<SkillSourceStat> {
    const stats = await fs.stat(this.#resolvePath(skillPath));
    return {
      modifiedAt: stats.mtime,
    };
  }

  async readFile(skillPath: string): Promise<string | Buffer> {
    const resolved = this.#resolvePath(skillPath);
    // Read as buffer first, then convert to string for text files
    const content = await fs.readFile(resolved);
    // Try to detect if it's a text file by checking for common text extensions
    const ext = path.extname(skillPath).toLowerCase();
    const textExtensions = ['.md', '.txt', '.json', '.yaml', '.yml', '.js', '.ts', '.py', '.sh'];
    if (textExtensions.includes(ext)) {
      return content.toString('utf-8');
    }
    return content;
  }

  async readdir(skillPath: string): Promise<SkillSourceEntry[]> {
    const resolved = this.#resolvePath(skillPath);
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
    }));
  }
}
