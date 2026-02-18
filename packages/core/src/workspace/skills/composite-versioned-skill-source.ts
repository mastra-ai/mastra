import type { BlobStore } from '../../storage/domains/blobs/base';
import type { SkillVersionTree } from '../../storage/types';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from './skill-source';
import { VersionedSkillSource } from './versioned-skill-source';

/**
 * A skill entry for the composite source.
 * Each entry represents one skill's versioned tree, mounted under a directory name.
 */
export interface VersionedSkillEntry {
  /** Directory name for this skill (used as the subdirectory under the root) */
  dirName: string;
  /** The skill version's file tree manifest */
  tree: SkillVersionTree;
  /** When this version was created */
  versionCreatedAt: Date;
}

/**
 * A SkillSource that composes multiple versioned skill trees into a virtual directory.
 *
 * Each skill is mounted under a directory name, so the composite source looks like:
 *   /                           (root - virtual)
 *   /brand-guidelines/          (skill 1 root)
 *   /brand-guidelines/SKILL.md  (skill 1 files from blob store)
 *   /tone-of-voice/             (skill 2 root)
 *   /tone-of-voice/SKILL.md     (skill 2 files from blob store)
 *
 * This allows WorkspaceSkillsImpl to discover skills normally by scanning the root
 * for subdirectories containing SKILL.md.
 *
 * Can also include a fallback source for "live" skills that read from the filesystem.
 */
export class CompositeVersionedSkillSource implements SkillSource {
  readonly #sources: Map<string, VersionedSkillSource> = new Map();
  readonly #fallback?: SkillSource;
  readonly #fallbackSkills: Set<string>;

  constructor(
    entries: VersionedSkillEntry[],
    blobStore: BlobStore,
    options?: {
      /** Fallback source for "live" skills that read from the filesystem */
      fallback?: SkillSource;
      /** Skill directory names that should be served from the fallback source */
      fallbackSkills?: string[];
    },
  ) {
    for (const entry of entries) {
      this.#sources.set(entry.dirName, new VersionedSkillSource(entry.tree, blobStore, entry.versionCreatedAt));
    }
    this.#fallback = options?.fallback;
    this.#fallbackSkills = new Set(options?.fallbackSkills ?? []);
  }

  #normalizePath(path: string): string {
    return path.replace(/^[./\\]+|[/\\]+$/g, '');
  }

  /**
   * Route a path to the correct source.
   * Returns the source and the remaining path within that source.
   */
  #routePath(path: string): { source: SkillSource; subPath: string } | null {
    const normalized = this.#normalizePath(path);

    // Root: handled by this source directly
    if (normalized === '') return null;

    const segments = normalized.split('/');
    const skillDir = segments[0]!;
    const subPath = segments.slice(1).join('/');

    // Check if this skill should use the fallback source
    if (this.#fallbackSkills.has(skillDir) && this.#fallback) {
      return { source: this.#fallback, subPath: normalized };
    }

    // Check if this skill has a versioned source
    const versionedSource = this.#sources.get(skillDir);
    if (versionedSource) {
      return { source: versionedSource, subPath };
    }

    // Try the fallback for unknown paths
    if (this.#fallback) {
      return { source: this.#fallback, subPath: normalized };
    }

    return null;
  }

  async exists(path: string): Promise<boolean> {
    const normalized = this.#normalizePath(path);

    // Root always exists
    if (normalized === '') return true;

    const route = this.#routePath(path);
    if (!route) return false;

    return route.source.exists(route.subPath);
  }

  async stat(path: string): Promise<SkillSourceStat> {
    const normalized = this.#normalizePath(path);

    // Root directory
    if (normalized === '') {
      return {
        name: '.',
        type: 'directory',
        size: 0,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
    }

    const route = this.#routePath(path);
    if (!route) {
      throw new Error(`Path not found in composite skill source: ${path}`);
    }

    return route.source.stat(route.subPath);
  }

  async readFile(path: string): Promise<string | Buffer> {
    const route = this.#routePath(path);
    if (!route) {
      throw new Error(`File not found in composite skill source: ${path}`);
    }

    return route.source.readFile(route.subPath);
  }

  async readdir(path: string): Promise<SkillSourceEntry[]> {
    const normalized = this.#normalizePath(path);

    // Root: list all mounted skill directories
    if (normalized === '') {
      const entries: SkillSourceEntry[] = [];
      const seen = new Set<string>();

      for (const dirName of this.#sources.keys()) {
        entries.push({ name: dirName, type: 'directory' });
        seen.add(dirName);
      }

      // Also list fallback skills
      for (const dirName of this.#fallbackSkills) {
        if (!seen.has(dirName)) {
          entries.push({ name: dirName, type: 'directory' });
          seen.add(dirName);
        }
      }

      return entries;
    }

    const route = this.#routePath(path);
    if (!route) {
      throw new Error(`Directory not found in composite skill source: ${path}`);
    }

    return route.source.readdir(route.subPath);
  }
}
