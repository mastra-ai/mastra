/**
 * Glob tool — fast file pattern matching.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createTool } from '@mastra/core/tools';
import { execa } from 'execa';
import { z } from 'zod/v3';
import { truncateStringForTokenEstimate } from '../utils/token-estimator.js';
import { assertPathAllowed, getAllowedPathsFromContext } from './utils.js';

const MAX_GLOB_TOKENS = 2_000;

/**
 * Simple glob matching using `find` + `git ls-files` for .gitignore respect.
 * We prefer git ls-files when inside a git repo since it respects .gitignore.
 */
async function matchGlob(pattern: string, searchPath: string, root: string): Promise<string[]> {
  // Check if we're in a git repo
  let isGit = false;
  try {
    await execa('git', ['rev-parse', '--git-dir'], { cwd: root });
    isGit = true;
  } catch {
    // Not a git repo
  }

  if (isGit) {
    // Use git ls-files which respects .gitignore
    // --cached = tracked files, --others --exclude-standard = untracked but not ignored
    const args = ['ls-files', '--cached', '--others', '--exclude-standard'];

    const result = await execa('git', args, {
      cwd: searchPath,
      reject: false,
      timeout: 10_000,
    });

    if (result.exitCode !== 0) {
      // Fall back to find
      return matchGlobWithFind(pattern, searchPath);
    }

    const allFiles = result.stdout
      .split('\n')
      .filter(f => f.trim())
      .map(f => path.resolve(searchPath, f));

    // Apply the glob pattern as a simple filter
    return filterByGlob(allFiles, pattern, searchPath);
  }

  return matchGlobWithFind(pattern, searchPath);
}

/**
 * Fallback: use find command for non-git directories.
 */
async function matchGlobWithFind(pattern: string, searchPath: string): Promise<string[]> {
  // Convert common glob patterns to find arguments
  // For simple patterns like "*.ts", use -name
  // For path patterns like "src/**/*.ts", we'll list all and filter
  const result = await execa(
    'find',
    [
      searchPath,
      '-type',
      'f',
      '-not',
      '-path',
      '*/node_modules/*',
      '-not',
      '-path',
      '*/.git/*',
      '-not',
      '-path',
      '*/dist/*',
      '-not',
      '-path',
      '*/.next/*',
    ],
    { reject: false, timeout: 10_000 },
  );

  if (result.exitCode !== 0) return [];

  const allFiles = result.stdout.split('\n').filter(f => f.trim());
  return filterByGlob(allFiles, pattern, searchPath);
}

/**
 * Filter file paths by a glob-like pattern.
 * Supports: *, **, ?, and {a,b} alternatives.
 */
function filterByGlob(files: string[], pattern: string, basePath: string): string[] {
  const regex = globToRegex(pattern);

  return files.filter(file => {
    // Test against relative path from basePath
    const rel = path.relative(basePath, file);
    return regex.test(rel);
  });
}

/**
 * Convert a glob pattern to a regex.
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = '';
  let i = 0;

  while (i < pattern.length) {
    const c = pattern[i];

    if (c === '*') {
      if (pattern[i + 1] === '*') {
        // ** matches any number of path segments
        if (pattern[i + 2] === '/') {
          regexStr += '(?:.+/)?';
          i += 3;
        } else {
          regexStr += '.*';
          i += 2;
        }
      } else {
        // * matches anything except /
        regexStr += '[^/]*';
        i++;
      }
    } else if (c === '?') {
      regexStr += '[^/]';
      i++;
    } else if (c === '{') {
      // {a,b,c} alternatives
      const end = pattern.indexOf('}', i);
      if (end !== -1) {
        const alternatives = pattern.slice(i + 1, end).split(',');
        regexStr += '(?:' + alternatives.map(escapeRegex).join('|') + ')';
        i = end + 1;
      } else {
        regexStr += escapeRegex(c);
        i++;
      }
    } else if (c === '[') {
      // Character classes - pass through
      const end = pattern.indexOf(']', i);
      if (end !== -1) {
        regexStr += pattern.slice(i, end + 1);
        i = end + 1;
      } else {
        regexStr += escapeRegex(c!);
        i++;
      }
    } else {
      regexStr += escapeRegex(c!);
      i++;
    }
  }

  return new RegExp('^' + regexStr + '$');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get file modification time for sorting.
 */
async function getModTime(filePath: string): Promise<number> {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Create the glob tool for finding files by name pattern.
 */
export function createGlobTool(projectRoot?: string) {
  return createTool({
    id: 'find_files',
    description: `Find files matching a glob pattern. Returns file paths sorted by modification time (most recent first).

Usage notes:
- Use this to find files by name or path pattern. NEVER use execute_command with find or ls for file search.
- Supports standard glob syntax: * (any chars), ** (any path segments), ? (single char), {a,b} (alternatives)
- Automatically respects .gitignore in git repositories
- Common patterns:
  - "**/*.ts" — all TypeScript files
  - "src/**/*.test.*" — all test files under src/
  - "*.{js,ts}" — JS and TS files in the root
  - "**/package.json" — all package.json files
  - "src/components/**" — everything under src/components/`,
    inputSchema: z.object({
      pattern: z.string().describe('Glob pattern to match files (e.g., "**/*.ts", "src/**/*.test.*")'),
      path: z
        .string()
        .optional()
        .describe('Directory to search in (relative to project root). Defaults to project root.'),
    }),
    execute: async (context, toolContext) => {
      try {
        const root = projectRoot || process.cwd();
        const searchPath = context.path ? path.resolve(root, context.path) : root;

        // Security: ensure the search path is within the project root or allowed paths
        const allowedPaths = getAllowedPathsFromContext(toolContext);
        assertPathAllowed(searchPath, root, allowedPaths);

        const matches = await matchGlob(context.pattern, searchPath, root);

        if (matches.length === 0) {
          return {
            content: `No files found matching pattern: ${context.pattern}`,
            isError: false,
          };
        }

        // Get modification times for sorting
        const withTimes = await Promise.all(
          matches.map(async f => ({
            path: f,
            mtime: await getModTime(f),
          })),
        );

        // Sort by modification time, most recent first
        withTimes.sort((a, b) => b.mtime - a.mtime);

        // Make paths relative to project root
        const relativePaths = withTimes.map(f => path.relative(root, f.path));

        const header = `Found ${relativePaths.length} file${relativePaths.length !== 1 ? 's' : ''} matching "${context.pattern}":\n\n`;
        const listing = relativePaths.join('\n');

        return {
          content: truncateStringForTokenEstimate(header + listing, MAX_GLOB_TOKENS, false),
          isError: false,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: `glob failed: ${msg}`,
          isError: true,
        };
      }
    },
  });
}
