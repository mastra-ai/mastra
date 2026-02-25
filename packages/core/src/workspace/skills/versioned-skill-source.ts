import type { BlobStore } from '../../storage/domains/blobs/base';
import type { SkillVersionTree } from '../../storage/types';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from './skill-source';

/**
 * A SkillSource implementation that reads skill files from a versioned
 * content-addressable blob store, using a SkillVersionTree manifest.
 *
 * This is used by production agents to read from published skill versions
 * rather than the live filesystem. The SkillVersionTree maps file paths
 * to blob hashes, and the BlobStore provides the actual content.
 */
export class VersionedSkillSource implements SkillSource {
  readonly #tree: SkillVersionTree;
  readonly #blobStore: BlobStore;
  readonly #versionCreatedAt: Date;

  /** Computed set of directory paths from the tree entries */
  readonly #directories: Set<string>;

  constructor(tree: SkillVersionTree, blobStore: BlobStore, versionCreatedAt: Date) {
    this.#tree = tree;
    this.#blobStore = blobStore;
    this.#versionCreatedAt = versionCreatedAt;
    this.#directories = this.#computeDirectories();
  }

  /**
   * Compute all directory paths implied by the file tree.
   * For a file at "references/api.md", this adds "" (root), "references".
   */
  #computeDirectories(): Set<string> {
    const dirs = new Set<string>();
    dirs.add(''); // root
    dirs.add('.'); // root alias

    for (const filePath of Object.keys(this.#tree.entries)) {
      const parts = filePath.split('/');
      // Add all parent directories
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'));
      }
    }
    return dirs;
  }

  /**
   * Normalize a path by stripping leading/trailing slashes and dots.
   */
  #normalizePath(path: string): string {
    let normalized = path.replace(/^[./\\]+|[/\\]+$/g, '');
    if (normalized === '') return '';
    return normalized;
  }

  async exists(path: string): Promise<boolean> {
    const normalized = this.#normalizePath(path);
    // Check if it's a file
    if (this.#tree.entries[normalized]) return true;
    // Check if it's a directory
    return this.#directories.has(normalized);
  }

  async stat(path: string): Promise<SkillSourceStat> {
    const normalized = this.#normalizePath(path);
    const name = normalized.split('/').pop() || normalized || '.';

    // Check if it's a file in the tree
    const entry = this.#tree.entries[normalized];
    if (entry) {
      return {
        name,
        type: 'file',
        size: entry.size,
        createdAt: this.#versionCreatedAt,
        modifiedAt: this.#versionCreatedAt,
        mimeType: entry.mimeType,
      };
    }

    // Check if it's a directory
    if (this.#directories.has(normalized)) {
      return {
        name,
        type: 'directory',
        size: 0,
        createdAt: this.#versionCreatedAt,
        modifiedAt: this.#versionCreatedAt,
      };
    }

    throw new Error(`Path not found in skill version tree: ${path}`);
  }

  async readFile(path: string): Promise<string | Buffer> {
    const normalized = this.#normalizePath(path);
    const entry = this.#tree.entries[normalized];

    if (!entry) {
      throw new Error(`File not found in skill version tree: ${path}`);
    }

    const blob = await this.#blobStore.get(entry.blobHash);
    if (!blob) {
      throw new Error(`Blob not found for hash ${entry.blobHash} (file: ${path})`);
    }

    // Decode base64-encoded binary content back to Buffer
    if (entry.encoding === 'base64') {
      return Buffer.from(blob.content, 'base64');
    }

    return blob.content;
  }

  async readdir(path: string): Promise<SkillSourceEntry[]> {
    const normalized = this.#normalizePath(path);

    if (!this.#directories.has(normalized)) {
      throw new Error(`Directory not found in skill version tree: ${path}`);
    }

    const prefix = normalized === '' ? '' : normalized + '/';
    const seen = new Set<string>();
    const entries: SkillSourceEntry[] = [];

    for (const filePath of Object.keys(this.#tree.entries)) {
      if (!filePath.startsWith(prefix)) continue;

      // Get the next segment after the prefix
      const remaining = filePath.slice(prefix.length);
      const nextSegment = remaining.split('/')[0];
      if (!nextSegment || seen.has(nextSegment)) continue;
      seen.add(nextSegment);

      // If there's more after the next segment, it's a directory
      const isDirectory = remaining.includes('/');
      entries.push({
        name: nextSegment,
        type: isDirectory ? 'directory' : 'file',
      });
    }

    return entries;
  }
}
