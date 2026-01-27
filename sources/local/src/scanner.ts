import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { LocalProjectSourceConfig } from './types';

export class DirectoryScanner {
  #config: LocalProjectSourceConfig;
  #exclude: Set<string>;

  constructor(config: LocalProjectSourceConfig) {
    this.#config = config;
    this.#exclude = new Set(config.exclude ?? ['node_modules', '.git', 'dist', '.next', '.mastra']);
  }

  /**
   * Scan a base path for potential project directories
   */
  async scan(basePath: string, depth: number = 0): Promise<string[]> {
    const maxDepth = this.#config.maxDepth ?? 3;
    if (depth >= maxDepth) {
      return [];
    }

    const directories: string[] = [];

    try {
      const entries = await readdir(basePath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (this.#exclude.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue; // Skip hidden directories

        const fullPath = join(basePath, entry.name);

        // Add this directory as a potential project
        directories.push(fullPath);

        // Recursively scan subdirectories
        if (depth + 1 < maxDepth) {
          const subDirs = await this.scan(fullPath, depth + 1);
          directories.push(...subDirs);
        }
      }
    } catch (error) {
      // Silently ignore permission errors or non-existent directories
    }

    return directories;
  }
}
