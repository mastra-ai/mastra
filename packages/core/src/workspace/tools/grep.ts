import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { isTextFile } from '../filesystem/fs-utils';
import { loadGitignore } from '../gitignore';
import type { GlobMatcher } from '../glob';
import { createGlobMatcher, extractGlobBase, isGlobPattern } from '../glob';
import { emitWorkspaceMetadata, requireFilesystem } from './helpers';
import { applyTokenLimit } from './output-helpers';
import { startWorkspaceSpan } from './tracing';

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
  outputSchema: z.string(),
  inputSchema: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z
      .string()
      .optional()
      .default('.')
      .describe(
        'File, directory, or glob pattern to search within (default: "."). ' +
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
    { pattern, path: inputPath = '.', contextLines = 0, maxCount, caseSensitive = true, includeHidden = false },
    context,
  ) => {
    const { workspace, filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.GREP);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'filesystem',
      operation: 'grep',
      input: { pattern, path: inputPath, contextLines, maxCount },
      attributes: { filesystemProvider: filesystem.provider },
    });

    try {
      // Guard against excessively long patterns as a cheap ReDoS heuristic
      const MAX_PATTERN_LENGTH = 1000;
      if (pattern.length > MAX_PATTERN_LENGTH) {
        span.end({ success: false });
        return `Error: Pattern too long (${pattern.length} chars, max ${MAX_PATTERN_LENGTH}). Use a shorter pattern.`;
      }

      // Validate regex
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      } catch (e) {
        span.end({ success: false });
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

      // Load gitignore filter.
      // If the user explicitly targets a gitignored path (e.g. "./dist"), skip
      // filtering so they can still search there. Otherwise apply as normal.
      const rawIgnoreFilter = await loadGitignore(filesystem);
      const searchPathNormalized = searchPath.replace(/^\.\//, '').replace(/\/$/, '');
      const targetIsIgnored = rawIgnoreFilter && searchPathNormalized && rawIgnoreFilter(searchPathNormalized + '/');
      const ignoreFilter = targetIsIgnored ? undefined : rawIgnoreFilter;

      // Collect files to search
      let filePaths: string[];

      // Never search inside .git even when explicitly targeted
      const normalizedSearch = searchPath.replace(/\/$/, '');
      if (normalizedSearch === '.git' || normalizedSearch.endsWith('/.git')) {
        filePaths = [];
      } else {
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
                // Always skip .git directory — its internals are never useful and waste tokens
                if (entry.type === 'directory' && entry.name === '.git') continue;

                // Skip hidden files/dirs unless includeHidden is set
                if (!includeHidden && entry.name.startsWith('.')) continue;

                const fullPath = dir.endsWith('/') ? `${dir}${entry.name}` : `${dir}/${entry.name}`;

                // Skip gitignored paths
                if (ignoreFilter) {
                  const relativePath = fullPath.replace(/^\.\//, '');
                  const checkPath = entry.type === 'directory' ? `${relativePath}/` : relativePath;
                  if (ignoreFilter(checkPath)) continue;
                }

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
      }

      const outputLines: string[] = [];
      const filesWithMatches = new Set<string>();
      let totalMatchCount = 0;
      let truncated = false;
      const MAX_LINE_LENGTH = 500;
      const GLOBAL_CAP = 1000;
      const normalizedContextLines = Math.max(0, Math.floor(contextLines));
      let emittedContextHunk = false;

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
        const fileMatches: Array<{ lineIndex: number; columnIndex: number }> = [];

        for (let i = 0; i < lines.length; i++) {
          const currentLine = lines[i]!;
          // Reset regex lastIndex for each line since we use 'g' flag
          regex.lastIndex = 0;
          const lineMatch = regex.exec(currentLine);
          if (!lineMatch) continue;

          filesWithMatches.add(filePath);

          fileMatches.push({ lineIndex: i, columnIndex: lineMatch.index });

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

        if (normalizedContextLines > 0) {
          const hunks: Array<{
            start: number;
            end: number;
            matchesByLine: Map<number, number>;
          }> = [];

          for (const match of fileMatches) {
            const start = Math.max(0, match.lineIndex - normalizedContextLines);
            const end = Math.min(lines.length - 1, match.lineIndex + normalizedContextLines);
            const previousHunk = hunks[hunks.length - 1];

            if (previousHunk && start <= previousHunk.end + 1) {
              previousHunk.end = Math.max(previousHunk.end, end);
              previousHunk.matchesByLine.set(match.lineIndex, match.columnIndex);
            } else {
              hunks.push({
                start,
                end,
                matchesByLine: new Map([[match.lineIndex, match.columnIndex]]),
              });
            }
          }

          for (const hunk of hunks) {
            if (emittedContextHunk) {
              outputLines.push('--');
            }
            emittedContextHunk = true;

            for (let i = hunk.start; i <= hunk.end; i++) {
              const columnIndex = hunk.matchesByLine.get(i);

              if (columnIndex !== undefined) {
                let lineContent = lines[i]!;
                if (lineContent.length > MAX_LINE_LENGTH) {
                  lineContent = lineContent.slice(0, MAX_LINE_LENGTH) + '...';
                }
                outputLines.push(`${filePath}:${i + 1}:${columnIndex + 1}: ${lineContent}`);
              } else {
                outputLines.push(`${filePath}:${i + 1}- ${lines[i]}`);
              }
            }
          }
        } else {
          for (const match of fileMatches) {
            let lineContent = lines[match.lineIndex]!;
            if (lineContent.length > MAX_LINE_LENGTH) {
              lineContent = lineContent.slice(0, MAX_LINE_LENGTH) + '...';
            }
            outputLines.push(`${filePath}:${match.lineIndex + 1}:${match.columnIndex + 1}: ${lineContent}`);
          }
        }
      }

      // Summary line — placed at the top so it's always visible after truncation
      const summaryParts = [`${totalMatchCount} match${totalMatchCount !== 1 ? 'es' : ''}`];
      summaryParts.push(`across ${filesWithMatches.size} file${filesWithMatches.size !== 1 ? 's' : ''}`);
      if (truncated) {
        summaryParts.push(`(truncated at ${GLOBAL_CAP})`);
      }
      const summary = summaryParts.join(' ');
      outputLines.unshift(summary, '---');

      const output = await applyTokenLimit(
        outputLines.join('\n'),
        workspace.getToolsConfig()?.[WORKSPACE_TOOLS.FILESYSTEM.GREP]?.maxOutputTokens,
        'end',
      );
      span.end({ success: true }, { resultCount: totalMatchCount });
      return output;
    } catch (err) {
      span.error(err);
      throw err;
    }
  },
});
