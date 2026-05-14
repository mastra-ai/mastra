import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import type { BlobStore } from '../../storage/domains/blobs/base';
import type {
  SkillVersionTree,
  SkillVersionTreeEntry,
  StorageBlobEntry,
  StorageSkillFileNode,
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
  /** UI-facing nested file tree (folders + files with content) for the stored skill record */
  files: StorageSkillFileNode[];
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Compute SHA-256 hex hash of content (string or Buffer).
 */
function hashContent(content: string | Buffer): string {
  if (Buffer.isBuffer(content)) {
    return createHash('sha256').update(content).digest('hex');
  }
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
 * Whether a MIME type represents binary content that cannot be safely stored as UTF-8 text.
 */
function isBinaryMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  // Text-based types are safe for UTF-8
  if (mimeType.startsWith('text/')) return false;
  // JSON and YAML are text-safe
  if (mimeType === 'application/json') return false;
  // SVG is XML-based text
  if (mimeType === 'image/svg+xml') return false;
  // Everything else (image/png, image/jpeg, application/octet-stream, etc.) is binary
  return true;
}

interface WalkedFile {
  path: string;
  /** Text content (UTF-8) or raw binary content (Buffer) */
  content: string | Buffer;
  /** Whether this file is binary */
  isBinary: boolean;
}

/**
 * Recursively walk a directory in a SkillSource, returning all files
 * with their relative paths and content. Binary files are returned as Buffers.
 */
async function walkSkillDirectory(
  source: SkillSource,
  basePath: string,
  currentPath: string = basePath,
): Promise<WalkedFile[]> {
  const entries: SkillSourceEntry[] = await source.readdir(currentPath);
  const files: WalkedFile[] = [];

  for (const entry of entries) {
    const entryPath = joinPath(currentPath, entry.name);

    if (entry.type === 'directory') {
      const subFiles = await walkSkillDirectory(source, basePath, entryPath);
      files.push(...subFiles);
    } else {
      const rawContent = await source.readFile(entryPath);
      const relativePath = entryPath.substring(basePath.length + 1);
      const mimeType = detectMimeType(entry.name);
      const isBinary = isBinaryMimeType(mimeType);

      if (isBinary) {
        // Keep binary content as Buffer
        const buf = Buffer.isBuffer(rawContent) ? rawContent : Buffer.from(rawContent, 'utf-8');
        files.push({ path: relativePath, content: buf, isBinary: true });
      } else {
        // Text content as string
        const content = typeof rawContent === 'string' ? rawContent : rawContent.toString('utf-8');
        files.push({ path: relativePath, content, isBinary: false });
      }
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

/**
 * Build a nested folder/file tree from a flat list of walked files for the
 * UI-facing `files` column on the stored skill record. Binary file content is
 * base64-encoded so it can round-trip through the string-typed `content` field.
 */
function buildSkillFileNodes(files: WalkedFile[]): StorageSkillFileNode[] {
  const root: StorageSkillFileNode[] = [];

  for (const file of files) {
    const segments = file.path.split('/').filter(Boolean);
    if (segments.length === 0) continue;

    let cursor = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]!;
      let folder = cursor.find(node => node.type === 'folder' && node.name === segment);
      if (!folder) {
        folder = { name: segment, type: 'folder', children: [] };
        cursor.push(folder);
      }
      if (!folder.children) folder.children = [];
      cursor = folder.children;
    }

    const fileName = segments[segments.length - 1]!;
    const content = file.isBinary
      ? (Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content as string)).toString('base64')
      : (file.content as string);
    cursor.push({ name: fileName, type: 'file', content });
  }

  return root;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * A flat file entry used by snapshot parsing helpers.
 * Path is the skill-relative path (e.g. `SKILL.md`, `references/foo.md`).
 */
export interface SkillSnapshotFile {
  path: string;
  content: string | Buffer;
}

/**
 * Parse a flat array of skill files into a denormalized snapshot.
 *
 * Finds `SKILL.md`, parses its YAML frontmatter into structured fields
 * (name, description, license, compatibility, metadata), and uses the
 * markdown body as `instructions`. Discovers `references/`, `scripts/`,
 * and `assets/` subdirectory paths from the file list.
 *
 * Used by both the publish flow (which has files from a SkillSource walk)
 * and the registry install flow (which has files fetched from an external
 * registry like skills.sh). The Agent Skills spec puts metadata in
 * frontmatter and agent-facing prose in the body — this helper enforces
 * that split so frontmatter never leaks into the runtime instructions.
 *
 * @throws if `SKILL.md` is missing from the file list
 */
export function parseSkillSnapshotFromFiles(files: SkillSnapshotFile[]): Omit<StorageSkillSnapshotType, 'tree'> {
  const skillMdFile = files.find(f => f.path === 'SKILL.md');
  if (!skillMdFile) {
    throw new Error('SKILL.md not found in skill files');
  }

  const skillMdContent =
    typeof skillMdFile.content === 'string' ? skillMdFile.content : skillMdFile.content.toString('utf-8');
  const parsed = matter(skillMdContent);
  const frontmatter = parsed.data;
  const instructions = parsed.content.trim();

  const allPaths = files.map(f => f.path);
  const references = collectSubdirPaths(allPaths, 'references');
  const scripts = collectSubdirPaths(allPaths, 'scripts');
  const assets = collectSubdirPaths(allPaths, 'assets');

  return {
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
}

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

    if (file.isBinary) {
      // Binary file: store as base64-encoded string
      const buf = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content as string);
      const size = buf.length;
      const base64Content = buf.toString('base64');

      treeEntries[file.path] = {
        blobHash: hash,
        size,
        mimeType,
        encoding: 'base64',
      };

      if (!blobMap.has(hash)) {
        blobMap.set(hash, {
          hash,
          content: base64Content,
          size,
          mimeType,
          createdAt: now,
        });
      }
    } else {
      // Text file: store as UTF-8 string
      const content = file.content as string;
      const size = Buffer.byteLength(content, 'utf-8');

      treeEntries[file.path] = {
        blobHash: hash,
        size,
        mimeType,
      };

      if (!blobMap.has(hash)) {
        blobMap.set(hash, {
          hash,
          content,
          size,
          mimeType,
          createdAt: now,
        });
      }
    }
  }

  const tree: SkillVersionTree = { entries: treeEntries };
  const blobs = Array.from(blobMap.values());
  const fileNodes = buildSkillFileNodes(files);

  // 3. Parse SKILL.md frontmatter and discover references/scripts/assets paths
  let snapshot: Omit<StorageSkillSnapshotType, 'tree'>;
  try {
    snapshot = parseSkillSnapshotFromFiles(files);
  } catch (err) {
    // Surface the skill path to make the error easier to debug
    if (err instanceof Error && err.message.includes('SKILL.md not found')) {
      throw new Error(`SKILL.md not found in ${skillPath}`);
    }
    throw err;
  }

  return { snapshot, tree, blobs, files: fileNodes };
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
