import { readFile, writeFile, mkdir, readdir, unlink, rm } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';

import { KnowledgeStorage } from '@mastra/core/knowledge';
import type { AnyArtifact } from '@mastra/core/knowledge';

export class FilesystemStorage extends KnowledgeStorage {
  constructor({ namespace }: { namespace: string }) {
    super({ namespace });
  }

  get(key: string): Promise<string> {
    return readFile(join(this.namespace, key), 'utf8');
  }

  async add(artifact: AnyArtifact): Promise<void> {
    const filePath = join(this.namespace, artifact.key);

    // Ensure the directory exists
    await mkdir(dirname(filePath), { recursive: true });

    const content = typeof artifact.content === 'string' ? artifact.content : artifact.content;

    await writeFile(filePath, content);
  }

  async delete(key: string): Promise<void> {
    await unlink(join(this.namespace, key));
  }

  async list(prefix?: string): Promise<string[]> {
    const dir = prefix ? join(this.namespace, prefix) : this.namespace;

    try {
      const entries = await this.#listRecursive(dir);
      // Return paths relative to namespace
      return entries.map(entry => relative(this.namespace, entry));
    } catch {
      return [];
    }
  }

  /**
   * Recursively list all files in a directory
   */
  async #listRecursive(dir: string): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          const subEntries = await this.#listRecursive(fullPath);
          results.push(...subEntries);
        } else {
          results.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or not readable
    }

    return results;
  }

  async clear(): Promise<void> {
    try {
      await rm(this.namespace, { recursive: true, force: true });
      await mkdir(this.namespace, { recursive: true });
    } catch {
      // Directory may not exist, which is fine
    }
  }
}
