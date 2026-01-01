import { readFile, writeFile, mkdir, readdir, unlink, rm, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';

import { KnowledgeStorage } from '@mastra/core/knowledge';
import type {
  CreateNamespaceStorageOptions,
  ListNamespacesOptions,
  AnyArtifact,
  KnowledgeNamespaceInfo,
  KnowledgeSource,
} from '@mastra/core/knowledge';

/**
 * Filesystem-based knowledge storage.
 * Stores artifacts as files on disk, with namespaces as subdirectories.
 *
 * Supports multiple paths for different source types:
 * - External (node_modules) - read-only
 * - Local (./src/knowledge) - read-write
 * - Managed (.mastra/knowledge) - read-write
 */
export class FilesystemStorage extends KnowledgeStorage {
  constructor({ paths }: { paths: string | string[] }) {
    super({ paths });
  }

  /**
   * Determine the source type for a given path.
   * This is a heuristic based on path patterns.
   */
  #getSourceForPath(path: string): KnowledgeSource {
    if (path.includes('node_modules')) {
      return { type: 'external', packagePath: path };
    } else if (path.includes('.mastra')) {
      return { type: 'managed', mastraPath: path };
    } else {
      return { type: 'local', projectPath: path };
    }
  }

  /**
   * Check if a source is writable (not external)
   */
  #isWritableSource(source: KnowledgeSource): boolean {
    return source.type !== 'external';
  }

  /**
   * Get the first writable path (for creating new namespaces)
   */
  #getWritablePath(): string | null {
    for (const path of this.paths) {
      const source = this.#getSourceForPath(path);
      if (this.#isWritableSource(source)) {
        return path;
      }
    }
    return null;
  }

  /**
   * Find which path contains a namespace
   */
  async #findNamespacePath(namespace: string): Promise<{ path: string; source: KnowledgeSource } | null> {
    for (const path of this.paths) {
      const namespacePath = join(path, namespace);
      try {
        const stats = await stat(namespacePath);
        if (stats.isDirectory()) {
          return { path, source: this.#getSourceForPath(path) };
        }
      } catch {
        // Not found in this path
      }
    }
    return null;
  }

  async refresh(): Promise<void> {
    // For filesystem storage, refresh is a no-op since we read directly from disk
    // Other implementations (like cached/in-memory) might need to re-scan
  }

  // ============================================================================
  // Namespace Management
  // ============================================================================

  async listNamespaces(options?: ListNamespacesOptions): Promise<KnowledgeNamespaceInfo[]> {
    const namespaces: KnowledgeNamespaceInfo[] = [];
    const seenNamespaces = new Set<string>();

    for (const basePath of this.paths) {
      const source = this.#getSourceForPath(basePath);

      // Filter by source type if specified
      if (options?.sourceTypes && !options.sourceTypes.includes(source.type)) {
        continue;
      }

      try {
        const entries = await readdir(basePath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            // Skip if we've already seen this namespace (first path wins)
            if (seenNamespaces.has(entry.name)) {
              continue;
            }
            seenNamespaces.add(entry.name);

            const info = await this.#getNamespaceInfoFromPath(basePath, entry.name, source);
            if (info) {
              namespaces.push(info);
            }
          }
        }
      } catch {
        // Path doesn't exist yet, skip it
      }
    }

    return namespaces;
  }

  async createNamespace(options: CreateNamespaceStorageOptions): Promise<KnowledgeNamespaceInfo> {
    const writablePath = this.#getWritablePath();
    if (!writablePath) {
      throw new Error('No writable path available for creating namespaces');
    }

    const namespacePath = join(writablePath, options.namespace);

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

    const source = this.#getSourceForPath(writablePath);

    return {
      namespace: options.namespace,
      description: options.description,
      source,
      artifactCount: 0,
      hasBM25: false, // Storage doesn't know about BM25 - Knowledge class tracks this
      hasVector: false, // Storage doesn't know about vector - Knowledge class tracks this
      createdAt: now,
      updatedAt: now,
    };
  }

  async deleteNamespace(namespace: string): Promise<void> {
    const found = await this.#findNamespacePath(namespace);
    if (!found) {
      return; // Namespace doesn't exist, nothing to delete
    }

    if (!this.#isWritableSource(found.source)) {
      throw new Error(`Cannot delete namespace '${namespace}' from read-only source`);
    }

    const namespacePath = join(found.path, namespace);
    await rm(namespacePath, { recursive: true, force: true });
  }

  async hasNamespace(namespace: string): Promise<boolean> {
    const found = await this.#findNamespacePath(namespace);
    return found !== null;
  }

  async getNamespaceInfo(namespace: string): Promise<KnowledgeNamespaceInfo | null> {
    const found = await this.#findNamespacePath(namespace);
    if (!found) {
      return null;
    }

    return this.#getNamespaceInfoFromPath(found.path, namespace, found.source);
  }

  /**
   * Get namespace info from a specific path
   */
  async #getNamespaceInfoFromPath(
    basePath: string,
    namespace: string,
    source: KnowledgeSource,
  ): Promise<KnowledgeNamespaceInfo | null> {
    const namespacePath = join(basePath, namespace);

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
      const keys = await this.#listFromPath(basePath, namespace);

      return {
        namespace,
        description: metadata.description,
        source,
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
    const found = await this.#findNamespacePath(namespace);
    if (!found) {
      throw new Error(`Namespace '${namespace}' not found`);
    }

    const filePath = join(found.path, namespace, key);
    return readFile(filePath, 'utf8');
  }

  async add(namespace: string, artifact: AnyArtifact): Promise<void> {
    const found = await this.#findNamespacePath(namespace);
    if (!found) {
      throw new Error(`Namespace '${namespace}' not found`);
    }

    if (!this.#isWritableSource(found.source)) {
      throw new Error(`Cannot add artifacts to read-only namespace '${namespace}'`);
    }

    const filePath = join(found.path, namespace, artifact.key);

    // Ensure the directory exists
    await mkdir(dirname(filePath), { recursive: true });

    const content = typeof artifact.content === 'string' ? artifact.content : artifact.content;

    await writeFile(filePath, content);

    // Update namespace metadata
    await this.#updateNamespaceTimestamp(found.path, namespace);
  }

  async delete(namespace: string, key: string): Promise<void> {
    const found = await this.#findNamespacePath(namespace);
    if (!found) {
      throw new Error(`Namespace '${namespace}' not found`);
    }

    if (!this.#isWritableSource(found.source)) {
      throw new Error(`Cannot delete artifacts from read-only namespace '${namespace}'`);
    }

    const filePath = join(found.path, namespace, key);
    await unlink(filePath);
    await this.#updateNamespaceTimestamp(found.path, namespace);
  }

  async list(namespace: string, prefix?: string): Promise<string[]> {
    const found = await this.#findNamespacePath(namespace);
    if (!found) {
      return [];
    }

    return this.#listFromPath(found.path, namespace, prefix);
  }

  async clear(namespace: string): Promise<void> {
    const found = await this.#findNamespacePath(namespace);
    if (!found) {
      return; // Namespace doesn't exist, nothing to clear
    }

    if (!this.#isWritableSource(found.source)) {
      throw new Error(`Cannot clear read-only namespace '${namespace}'`);
    }

    const namespacePath = join(found.path, namespace);

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

      await this.#updateNamespaceTimestamp(found.path, namespace);
    } catch {
      // Namespace may not exist, which is fine
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * List artifacts from a specific path
   */
  async #listFromPath(basePath: string, namespace: string, prefix?: string): Promise<string[]> {
    const dir = prefix ? join(basePath, namespace, prefix) : join(basePath, namespace);

    try {
      const entries = await this.#listRecursive(dir);
      // Return paths relative to namespace, excluding metadata files
      return entries
        .map(entry => relative(join(basePath, namespace), entry))
        .filter(key => !key.startsWith('.metadata'));
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

  /**
   * Update the namespace's updatedAt timestamp
   */
  async #updateNamespaceTimestamp(basePath: string, namespace: string): Promise<void> {
    const metadataPath = join(basePath, namespace, '.metadata.json');

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
