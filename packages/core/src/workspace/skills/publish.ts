import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import type { BlobStore } from '../../storage/domains/blobs/base';
import type {
  SkillVersionTree,
  SkillVersionTreeEntry,
  StorageBlobEntry,
  StorageSkillSnapshotType,
} from '../../storage/types';
import type { SkillSource, SkillSourceEntry } from './skill-source';

/**
 * Result of collecting a skill's filesystem tree.
 * Contains the tree manifest, the blob entries to store, and parsed SKILL.md fields.
 */
export interface SkillPublishResult {
  /** Denormalized snapshot fields parsed from SKILL.md frontmatter */
  snapshot: Omit<StorageSkillSnapshotType, 'tree'>;
  /** Content-addressable file tree manifest */
  tree: SkillVersionTree;
  /** Blob entries to store (already deduplicated by hash) */
  blobs: StorageBlobEntry[];
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Compute SHA-256 hex hash of content.
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Simple extension-based MIME type detection.
 */
function detectMimeType(filename: string): string | undefined {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.sh': 'text/x-shellscript',
    '.py': 'text/x-python',
    '.js': 'text/javascript',
    '.ts': 'text/typescript',
    '.html': 'text/html',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  return mimeTypes[ext];
}

/**
 * Recursively walk a directory in a SkillSource, returning all files
 * with their relative paths and content.
 */
async function walkSkillDirectory(
  source: SkillSource,
  basePath: string,
  currentPath: string = basePath,
): Promise<{ path: string; content: string }[]> {
  const entries: SkillSourceEntry[] = await source.readdir(currentPath);
  const files: { path: string; content: string }[] = [];

  for (const entry of entries) {
    const entryPath = joinPath(currentPath, entry.name);

    if (entry.type === 'directory') {
      const subFiles = await walkSkillDirectory(source, basePath, entryPath);
      files.push(...subFiles);
    } else {
      const rawContent = await source.readFile(entryPath);
      const content = typeof rawContent === 'string' ? rawContent : rawContent.toString('utf-8');
      // Compute relative path from basePath
      const relativePath = entryPath.substring(basePath.length + 1);
      files.push({ path: relativePath, content });
    }
  }

  return files;
}

/**
 * Join path segments using forward slashes.
 */
function joinPath(...segments: string[]): string {
  return segments
    .map((seg, i) => {
      if (i === 0) return seg.replace(/\/+$/, '');
      return seg.replace(/^\/+|\/+$/g, '');
    })
    .filter(Boolean)
    .join('/');
}

/**
 * Collect file paths under a specific subdirectory prefix.
 */
function collectSubdirPaths(allPaths: string[], subdir: string): string[] {
  const prefix = subdir + '/';
  return allPaths.filter(p => p.startsWith(prefix)).map(p => p.substring(prefix.length));
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Collect a skill from a SkillSource for publishing.
 * Walks the skill directory, hashes all files, parses SKILL.md frontmatter,
 * and returns everything needed to create a new version.
 *
 * @param source - The SkillSource to read from (live filesystem or any other source)
 * @param skillPath - Path to the skill directory (containing SKILL.md)
 */
export async function collectSkillForPublish(source: SkillSource, skillPath: string): Promise<SkillPublishResult> {
  // 1. Walk the skill directory recursively, reading all files
  const files = await walkSkillDirectory(source, skillPath);

  // 2. Build tree entries and blob entries, deduplicating blobs by hash
  const treeEntries: Record<string, SkillVersionTreeEntry> = {};
  const blobMap = new Map<string, StorageBlobEntry>();
  const now = new Date();

  for (const file of files) {
    const hash = hashContent(file.content);
    const mimeType = detectMimeType(file.path);
    const size = Buffer.byteLength(file.content, 'utf-8');

    treeEntries[file.path] = {
      blobHash: hash,
      size,
      mimeType,
    };

    if (!blobMap.has(hash)) {
      blobMap.set(hash, {
        hash,
        content: file.content,
        size,
        mimeType,
        createdAt: now,
      });
    }
  }

  const tree: SkillVersionTree = { entries: treeEntries };
  const blobs = Array.from(blobMap.values());

  // 3. Parse SKILL.md with gray-matter for denormalized fields
  const skillMdFile = files.find(f => f.path === 'SKILL.md');
  if (!skillMdFile) {
    throw new Error(`SKILL.md not found in ${skillPath}`);
  }

  const parsed = matter(skillMdFile.content);
  const frontmatter = parsed.data;
  const instructions = parsed.content.trim();

  // 4. Discover references/, scripts/, assets/ subdirectories for the path arrays
  const allPaths = files.map(f => f.path);
  const references = collectSubdirPaths(allPaths, 'references');
  const scripts = collectSubdirPaths(allPaths, 'scripts');
  const assets = collectSubdirPaths(allPaths, 'assets');

  // 5. Build snapshot
  const snapshot: Omit<StorageSkillSnapshotType, 'tree'> = {
    name: frontmatter.name,
    description: frontmatter.description,
    instructions,
    license: frontmatter.license,
    compatibility: frontmatter.compatibility,
    metadata: frontmatter.metadata,
    ...(references.length > 0 ? { references } : {}),
    ...(scripts.length > 0 ? { scripts } : {}),
    ...(assets.length > 0 ? { assets } : {}),
  };

  return { snapshot, tree, blobs };
}

/**
 * Publish a skill: collect files, store blobs, create version.
 * This is the full publish flow.
 *
 * @param source - The SkillSource to read from
 * @param skillPath - Path to the skill directory
 * @param blobStore - Where to store file blobs
 */
export async function publishSkillFromSource(
  source: SkillSource,
  skillPath: string,
  blobStore: BlobStore,
): Promise<SkillPublishResult> {
  const result = await collectSkillForPublish(source, skillPath);
  // Store blobs in batch
  await blobStore.putMany(result.blobs);
  return result;
}
