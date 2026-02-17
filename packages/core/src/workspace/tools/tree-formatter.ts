/**
 * Tree Formatter
 *
 * Formats directory structures as ASCII tree output.
 * Works with any WorkspaceFilesystem implementation.
 *
 * @example
 * ```typescript
 * import { formatAsTree } from './tree-formatter';
 *
 * const result = await formatAsTree(filesystem, '/', { maxDepth: 3 });
 * console.log(result.tree);
 * // .
 * // ├── src
 * // │   ├── index.ts
 * // │   └── utils
 * // │       └── helpers.ts
 * // └── package.json
 * console.log(result.summary);
 * // "2 directories, 3 files"
 * ```
 */

import type { WorkspaceFilesystem, FileEntry } from '../filesystem';
import { createGlobMatcher } from '../glob';
import type { GlobMatcher } from '../glob';

// =============================================================================
// Types
// =============================================================================

export interface TreeOptions {
  /** Maximum recursion depth (default: Infinity). Similar to tree's -L flag. */
  maxDepth?: number;
  /** Show hidden files/directories starting with '.' (default: false). Similar to tree's -a flag. */
  showHidden?: boolean;
  /** List directories only, no files (default: false). Similar to tree's -d flag. */
  dirsOnly?: boolean;
  /** Pattern to exclude from listing (e.g., 'node_modules'). Similar to tree's -I flag. */
  exclude?: string | string[];
  /** Filter by file extension (e.g., '.ts'). Similar to tree's -P flag. */
  extension?: string | string[];
  /** Glob pattern(s) to filter files. Matches against paths relative to the listed directory. Directories always pass through so their contents can be checked. */
  pattern?: string | string[];
}

export interface TreeResult {
  /** ASCII tree representation */
  tree: string;
  /** Human-readable summary (e.g., "3 directories, 12 files") */
  summary: string;
  /** Number of directories found */
  dirCount: number;
  /** Number of files found */
  fileCount: number;
  /** Whether output was truncated due to maxDepth */
  truncated: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const BRANCH = '├── ';
const LAST_BRANCH = '└── ';
const VERTICAL = '│   ';
const SPACE = '    ';

// =============================================================================
// Tree Formatting
// =============================================================================

/**
 * Format a directory as an ASCII tree.
 *
 * @param fs - WorkspaceFilesystem implementation
 * @param path - Root path to format
 * @param options - Formatting options
 * @returns Tree result with formatted string and counts
 */
export async function formatAsTree(fs: WorkspaceFilesystem, path: string, options?: TreeOptions): Promise<TreeResult> {
  const maxDepth = options?.maxDepth ?? Infinity;
  const showHidden = options?.showHidden ?? false;
  const dirsOnly = options?.dirsOnly ?? false;
  const exclude = options?.exclude;
  const extension = options?.extension;
  const pattern = options?.pattern;

  // Compile glob matcher once before the walk (if pattern provided)
  let globMatcher: GlobMatcher | undefined;
  if (pattern) {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    globMatcher = createGlobMatcher(patterns, { dot: showHidden });
  }

  const lines: string[] = ['.'];
  let dirCount = 0;
  let fileCount = 0;
  let truncated = false;

  /**
   * Build tree recursively
   */
  async function buildTree(currentPath: string, prefix: string, depth: number): Promise<void> {
    if (depth >= maxDepth) {
      truncated = true;
      return;
    }

    let entries: FileEntry[];
    try {
      entries = await fs.readdir(currentPath);
    } catch (error) {
      // At root level (depth 0), propagate errors so users see auth/access issues
      // For subdirectories, silently skip (permission issues on nested dirs are common)
      if (depth === 0) {
        throw error;
      }
      return;
    }

    // Filter entries
    let filtered = entries;

    // Filter hidden files unless showHidden
    if (!showHidden) {
      filtered = filtered.filter(e => !e.name.startsWith('.'));
    }

    // Filter by exclude pattern (like tree's -I flag)
    if (exclude) {
      const patterns = Array.isArray(exclude) ? exclude : [exclude];
      filtered = filtered.filter(e => {
        return !patterns.some(pattern => e.name.includes(pattern));
      });
    }

    // Filter to directories only (like tree's -d flag)
    if (dirsOnly) {
      filtered = filtered.filter(e => e.type === 'directory');
    }

    // Filter by extension (only affects files, directories always pass)
    if (extension && !dirsOnly) {
      const extensions = Array.isArray(extension) ? extension : [extension];
      filtered = filtered.filter(e => {
        if (e.type === 'directory') return true;
        return extensions.some(ext => {
          // Support both '.ts' and 'ts' formats
          const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
          return e.name.endsWith(normalizedExt);
        });
      });
    }

    // Filter by glob pattern (only affects files, directories always pass)
    if (globMatcher && !dirsOnly) {
      filtered = filtered.filter(e => {
        if (e.type === 'directory') return true;
        // Build relative path from the root of the tree walk
        const entryPath = currentPath === path ? e.name : `${currentPath === '/' ? '' : currentPath}/${e.name}`;
        // Strip the root path prefix to make it relative
        let relativePath: string;
        if (path === '/' || path === '') {
          relativePath = entryPath.startsWith('/') ? entryPath.slice(1) : entryPath;
        } else {
          relativePath = entryPath.startsWith(path + '/') ? entryPath.slice(path.length + 1) : entryPath;
          // If entryPath starts with path but no slash (shouldn't happen), fall back
          if (!relativePath) relativePath = entryPath;
        }
        return globMatcher!(relativePath);
      });
    }

    // Sort: directories first, then alphabetically (ASCII order to match native tree's strcmp)
    filtered.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });

    for (let i = 0; i < filtered.length; i++) {
      const entry = filtered[i]!;
      const isLast = i === filtered.length - 1;
      const connector = isLast ? LAST_BRANCH : BRANCH;
      const childPrefix = prefix + (isLast ? SPACE : VERTICAL);

      // Format entry name, including symlink target if present
      const displayName =
        entry.isSymlink && entry.symlinkTarget ? `${entry.name} -> ${entry.symlinkTarget}` : entry.name;

      lines.push(prefix + connector + displayName);

      if (entry.type === 'directory') {
        dirCount++;
        // Don't recurse into symlinks (matches native tree behavior)
        // This also prevents infinite loops from circular symlinks
        if (!entry.isSymlink) {
          const childPath = joinPath(currentPath, entry.name);
          await buildTree(childPath, childPrefix, depth + 1);
        }
      } else {
        fileCount++;
      }
    }
  }

  await buildTree(path, '', 0);

  // Build summary
  const dirPart = dirCount === 1 ? '1 directory' : `${dirCount} directories`;
  const filePart = fileCount === 1 ? '1 file' : `${fileCount} files`;
  let summary = `${dirPart}, ${filePart}`;
  if (truncated) {
    summary += ` (truncated at depth ${maxDepth})`;
  }

  return {
    tree: lines.join('\n'),
    summary,
    dirCount,
    fileCount,
    truncated,
  };
}

/**
 * Format entries directly (without filesystem access).
 * Useful when you already have the entries and want tree output.
 *
 * @param entries - Flat list of entries with path-like names (e.g., "dir/subdir/file.txt")
 * @returns Formatted tree string
 */
export function formatEntriesAsTree(entries: Array<{ name: string; type: 'file' | 'directory' }>): string {
  // Build a nested structure from flat paths
  interface TreeNode {
    name: string;
    type: 'file' | 'directory';
    children: Map<string, TreeNode>;
  }

  const root: TreeNode = { name: '.', type: 'directory', children: new Map() };

  for (const entry of entries) {
    const parts = entry.name.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLastPart = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          type: isLastPart ? entry.type : 'directory',
          children: new Map(),
        });
      }
      current = current.children.get(part)!;
    }
  }

  // Render tree
  const lines: string[] = ['.'];

  function renderNode(node: TreeNode, prefix: string): void {
    const children = Array.from(node.children.values());
    // Sort: directories first, then alphabetically (ASCII order to match native tree's strcmp)
    children.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });

    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const isLast = i === children.length - 1;
      const connector = isLast ? LAST_BRANCH : BRANCH;
      const childPrefix = prefix + (isLast ? SPACE : VERTICAL);

      lines.push(prefix + connector + child.name);

      if (child.children.size > 0) {
        renderNode(child, childPrefix);
      }
    }
  }

  renderNode(root, '');
  return lines.join('\n');
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Join path segments, handling root paths correctly
 */
function joinPath(base: string, name: string): string {
  if (base === '/' || base === '') {
    return `/${name}`;
  }
  return `${base}/${name}`;
}
