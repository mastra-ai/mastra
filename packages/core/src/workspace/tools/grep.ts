import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { isTextFile } from '../filesystem/fs-utils';
import type { GlobMatcher } from '../glob';
import { createGlobMatcher, extractGlobBase, isGlobPattern } from '../glob';
import { emitWorkspaceMetadata, requireFilesystem } from './helpers';

export const grepTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.GREP,
  description: `Search file contents using a regex pattern. Walks the filesystem and returns matching lines with file paths and line numbers.

Usage:
- Basic search: { pattern: "TODO" }
- Regex: { pattern: "function\\s+\\w+\\(" }
- Multiple terms: { pattern: "TODO|FIXME|HACK" }
- Case-insensitive: { pattern: "error", caseSensitive: false }
- Search in directory: { pattern: "import", path: "./src" }
- Filter by glob: { pattern: "import", path: "**/*.ts" }
- Combined path + glob: { pattern: "import", path: "src/**/*.ts" }
- Multiple file types: { pattern: "import", path: "**/*.{ts,tsx,js}" }
- Multiple directories: { pattern: "TODO", path: "{src,lib}/**/*.ts" }
- With context: { pattern: "function", contextLines: 2 }`,
  inputSchema: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z
      .string()
      .optional()
      .default('./')
      .describe(
        'File, directory, or glob pattern to search within (default: "./"). ' +
          'A plain path searches that file or directory. ' +
          'A glob pattern (e.g., "**/*.ts", "src/**/*.test.ts") filters which files to search.',
      ),
    contextLines: z
      .number()
      .optional()
      .default(0)
      .describe('Number of lines of context to include before and after each match (default: 0)'),
    maxCount: z
      .number()
      .optional()
      .describe(
        'Maximum matches per file. Moves on to the next file after this many matches. Similar to grep -m flag.',
      ),
    caseSensitive: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether the search is case-sensitive (default: true)'),
    includeHidden: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include hidden files and directories (names starting with ".") in the search (default: false)'),
  }),
  execute: async (
    { pattern, path: inputPath = './', contextLines = 0, maxCount, caseSensitive = true, includeHidden = false },
    context,
  ) => {
    const { filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.GREP);

    // Guard against excessively long patterns as a cheap ReDoS heuristic
    const MAX_PATTERN_LENGTH = 1000;
    if (pattern.length > MAX_PATTERN_LENGTH) {
      return `Error: Pattern too long (${pattern.length} chars, max ${MAX_PATTERN_LENGTH}). Use a shorter pattern.`;
    }

    // Validate regex
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    } catch (e) {
      return `Error: Invalid regex pattern: ${(e as Error).message}`;
    }

    // Determine search root and glob filter from the combined path parameter
    let searchPath: string;
    let globMatcher: GlobMatcher | undefined;

    if (isGlobPattern(inputPath)) {
      // Path contains glob characters — extract the static base as search root
      searchPath = extractGlobBase(inputPath);
      globMatcher = createGlobMatcher(inputPath, { dot: includeHidden });
    } else {
      searchPath = inputPath;
    }

    // Collect files to search
    let filePaths: string[];

    // Check if searchPath is a file or directory
    try {
      const stat = await filesystem.stat(searchPath);
      if (stat.type === 'file') {
        // Single file — search it directly
        filePaths = isTextFile(searchPath) ? [searchPath] : [];
      } else {
        // Directory — walk recursively
        const collectFiles = async (dir: string): Promise<string[]> => {
          const files: string[] = [];
          let entries;
          try {
            entries = await filesystem.readdir(dir);
          } catch {
            return files;
          }

          for (const entry of entries) {
            // Skip hidden files/dirs unless includeHidden is set
            if (!includeHidden && entry.name.startsWith('.')) continue;

            const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
            if (entry.type === 'file') {
              // Skip non-text files
              if (!isTextFile(entry.name)) continue;
              // Apply glob filter (createGlobMatcher normalizes leading slashes)
              if (globMatcher && !globMatcher(fullPath)) continue;
              files.push(fullPath);
            } else if (entry.type === 'directory' && !entry.isSymlink) {
              files.push(...(await collectFiles(fullPath)));
            }
          }
          return files;
        };
        filePaths = await collectFiles(searchPath);
      }
    } catch {
      // Path doesn't exist
      filePaths = [];
    }

    const outputLines: string[] = [];
    const filesWithMatches = new Set<string>();
    let totalMatchCount = 0;
    let truncated = false;
    const MAX_LINE_LENGTH = 500;
    const GLOBAL_CAP = 1000;

    for (const filePath of filePaths) {
      if (truncated) break;

      let content: string;
      try {
        const raw = await filesystem.readFile(filePath, { encoding: 'utf-8' });
        if (typeof raw !== 'string') continue;
        content = raw;
      } catch {
        continue;
      }

      const lines = content.split('\n');
      let fileMatchCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i]!;
        // Reset regex lastIndex for each line since we use 'g' flag
        regex.lastIndex = 0;
        const lineMatch = regex.exec(currentLine);
        if (!lineMatch) continue;

        filesWithMatches.add(filePath);

        let lineContent = currentLine;
        if (lineContent.length > MAX_LINE_LENGTH) {
          lineContent = lineContent.slice(0, MAX_LINE_LENGTH) + '...';
        }

        // Add context lines before the match
        if (contextLines > 0) {
          const beforeStart = Math.max(0, i - contextLines);
          for (let b = beforeStart; b < i; b++) {
            outputLines.push(`${filePath}:${b + 1}- ${lines[b]}`);
          }
        }

        // Add the matching line
        outputLines.push(`${filePath}:${i + 1}:${lineMatch.index + 1}: ${lineContent}`);

        // Add context lines after the match
        if (contextLines > 0) {
          const afterEnd = Math.min(lines.length - 1, i + contextLines);
          for (let a = i + 1; a <= afterEnd; a++) {
            outputLines.push(`${filePath}:${a + 1}- ${lines[a]}`);
          }
          // Separator between context groups
          outputLines.push('--');
        }

        totalMatchCount++;
        fileMatchCount++;

        // Per-file limit (like grep -m)
        if (maxCount !== undefined && fileMatchCount >= maxCount) break;

        // Global cap to protect context window
        if (totalMatchCount >= GLOBAL_CAP) {
          truncated = true;
          break;
        }
      }
    }

    // Summary line
    outputLines.push('---');
    const parts = [`${totalMatchCount} match${totalMatchCount !== 1 ? 'es' : ''}`];
    parts.push(`across ${filesWithMatches.size} file${filesWithMatches.size !== 1 ? 's' : ''}`);
    if (truncated) {
      parts.push(`(truncated at ${GLOBAL_CAP})`);
    }
    outputLines.push(parts.join(' '));

    return outputLines.join('\n');
  },
});
