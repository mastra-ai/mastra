import { readFile, writeFile, mkdir, readdir, unlink, rm, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';

import { KnowledgeStorage } from '@mastra/core/knowledge';
import type { CreateNamespaceStorageOptions, AnyArtifact, KnowledgeNamespaceInfo } from '@mastra/core/knowledge';

/**
 * Filesystem-based knowledge storage.
 * Stores artifacts as files on disk, with namespaces as subdirectories.
 */
export class FilesystemStorage extends KnowledgeStorage {
  constructor({ basePath }: { basePath: string }) {
    super({ basePath });
  }

  // ============================================================================
  // Namespace Management
  // ============================================================================

  async listNamespaces(): Promise<KnowledgeNamespaceInfo[]> {
    const namespaces: KnowledgeNamespaceInfo[] = [];

    try {
      const entries = await readdir(this.basePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const info = await this.getNamespaceInfo(entry.name);
          if (info) {
            namespaces.push(info);
          }
        }
      }
    } catch {
      // Base path doesn't exist yet, return empty
    }

    return namespaces;
  }

  async createNamespace(options: CreateNamespaceStorageOptions): Promise<KnowledgeNamespaceInfo> {
    const namespacePath = join(this.basePath, options.namespace);

    // Create the namespace directory
    await mkdir(namespacePath, { recursive: true });

    // Store metadata
    const metadataPath = join(namespacePath, '.metadata.json');
    const now = new Date().toISOString();
    const metadata = {
      namespace: options.namespace,
      description: options.description,
      createdAt: now,
      updatedAt: now,
    };
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return {
      namespace: options.namespace,
      description: options.description,
      artifactCount: 0,
      hasBM25: false, // Storage doesn't know about BM25 - Knowledge class tracks this
      hasVector: false, // Storage doesn't know about vector - Knowledge class tracks this
      createdAt: now,
      updatedAt: now,
    };
  }

  async deleteNamespace(namespace: string): Promise<void> {
    const namespacePath = join(this.basePath, namespace);
    await rm(namespacePath, { recursive: true, force: true });
  }

  async hasNamespace(namespace: string): Promise<boolean> {
    const namespacePath = join(this.basePath, namespace);
    try {
      const stats = await stat(namespacePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async getNamespaceInfo(namespace: string): Promise<KnowledgeNamespaceInfo | null> {
    const namespacePath = join(this.basePath, namespace);

    try {
      const stats = await stat(namespacePath);
      if (!stats.isDirectory()) {
        return null;
      }

      // Try to read metadata
      let metadata: { description?: string; createdAt?: string; updatedAt?: string } = {};
      try {
        const metadataPath = join(namespacePath, '.metadata.json');
        const content = await readFile(metadataPath, 'utf8');
        metadata = JSON.parse(content);
      } catch {
        // No metadata file, use directory stats
      }

      // Count artifacts (excluding metadata file)
      const keys = await this.list(namespace);

      return {
        namespace,
        description: metadata.description,
        artifactCount: keys.length,
        hasBM25: false, // Storage doesn't track this
        hasVector: false, // Storage doesn't track this
        createdAt: metadata.createdAt || stats.birthtime.toISOString(),
        updatedAt: metadata.updatedAt || stats.mtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Artifact Operations
  // ============================================================================

  async get(namespace: string, key: string): Promise<string> {
    const filePath = join(this.basePath, namespace, key);
    return readFile(filePath, 'utf8');
  }

  async add(namespace: string, artifact: AnyArtifact): Promise<void> {
    const filePath = join(this.basePath, namespace, artifact.key);

    // Ensure the directory exists
    await mkdir(dirname(filePath), { recursive: true });

    const content = typeof artifact.content === 'string' ? artifact.content : artifact.content;

    await writeFile(filePath, content);

    // Update namespace metadata
    await this.#updateNamespaceTimestamp(namespace);
  }

  async delete(namespace: string, key: string): Promise<void> {
    const filePath = join(this.basePath, namespace, key);
    await unlink(filePath);
    await this.#updateNamespaceTimestamp(namespace);
  }

  async list(namespace: string, prefix?: string): Promise<string[]> {
    const dir = prefix ? join(this.basePath, namespace, prefix) : join(this.basePath, namespace);

    try {
      const entries = await this.#listRecursive(dir);
      // Return paths relative to namespace, excluding metadata files
      return entries
        .map(entry => relative(join(this.basePath, namespace), entry))
        .filter(key => !key.startsWith('.metadata'));
    } catch {
      return [];
    }
  }

  async clear(namespace: string): Promise<void> {
    const namespacePath = join(this.basePath, namespace);

    try {
      // Get all entries
      const entries = await readdir(namespacePath, { withFileTypes: true });

      // Delete all except metadata
      for (const entry of entries) {
        if (entry.name !== '.metadata.json') {
          const entryPath = join(namespacePath, entry.name);
          await rm(entryPath, { recursive: true, force: true });
        }
      }

      await this.#updateNamespaceTimestamp(namespace);
    } catch {
      // Namespace may not exist, which is fine
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

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

  /**
   * Update the namespace's updatedAt timestamp
   */
  async #updateNamespaceTimestamp(namespace: string): Promise<void> {
    const metadataPath = join(this.basePath, namespace, '.metadata.json');

    try {
      const content = await readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(content);
      metadata.updatedAt = new Date().toISOString();
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch {
      // Metadata file may not exist for legacy namespaces
    }
  }
}
