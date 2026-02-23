/**
 * Grep tool — fast content search using ripgrep (rg) with Node.js fallback.
 */
import * as path from 'node:path';
import { createTool } from '@mastra/core/tools';
import { execa } from 'execa';
import { z } from 'zod';
import { truncateStringForTokenEstimate } from '../utils/token-estimator.js';
import { assertPathAllowed, getAllowedPathsFromContext } from './utils.js';

const MAX_GREP_TOKENS = 2_000;

/**
 * Check if ripgrep is available on the system.
 */
let rgAvailable: boolean | null = null;
async function hasRipgrep(): Promise<boolean> {
  if (rgAvailable !== null) return rgAvailable;
  try {
    await execa('rg', ['--version']);
    rgAvailable = true;
  } catch {
    rgAvailable = false;
  }
  return rgAvailable;
}

/**
 * Create the grep tool for searching file contents.
 */
export function createGrepTool(projectRoot?: string) {
  return createTool({
    id: 'search_content',
    // requireApproval: true,
    description: `Search file contents using regex patterns. Returns matching lines with file paths and line numbers.

Usage notes:
- Use this for ALL content search (finding functions, variables, error messages, imports, etc.)
- NEVER use execute_command with grep, rg, or ag. Always use this tool instead.
- Supports full regex syntax (e.g., "function\\s+\\w+", "import.*from")
- Use the \`glob\` parameter to filter by file type (e.g., "*.ts", "*.py")
- Use \`contextLines\` to see surrounding code for each match
- Results are sorted by file path for readability
- Output is truncated if too large — narrow your search with a more specific pattern or glob filter`,
    inputSchema: z.object({
      pattern: z.string().describe('Regex pattern to search for in file contents'),
      path: z
        .string()
        .optional()
        .describe('Directory or file to search in (relative to project root). Defaults to project root.'),
      glob: z.string().optional().describe('Glob pattern to filter files (e.g., "*.ts", "*.{js,jsx}", "test/**")'),
      contextLines: z.number().optional().describe('Number of lines to show before and after each match (default: 0)'),
      maxResults: z.number().optional().describe('Maximum number of matching lines to return (default: 100)'),
      caseSensitive: z.boolean().optional().describe('Whether the search is case-sensitive (default: true)'),
    }),
    execute: async (context, toolContext) => {
      try {
        const root = projectRoot || process.cwd();
        const searchPath = context.path ? path.resolve(root, context.path) : root;

        // Security: ensure the search path is within the project root or allowed paths
        const allowedPaths = getAllowedPathsFromContext(toolContext);
        assertPathAllowed(searchPath, root, allowedPaths);
        const maxResults = context.maxResults ?? 100;
        const contextLines = context.contextLines ?? 0;
        const caseSensitive = context.caseSensitive ?? true;

        const useRg = await hasRipgrep();

        let output: string;

        if (useRg) {
          // Build ripgrep command
          const args: string[] = ['--line-number', '--no-heading', '--color=never', '--max-count', String(maxResults)];

          if (!caseSensitive) args.push('--ignore-case');
          if (contextLines > 0) {
            args.push('--context', String(contextLines));
          }
          if (context.glob) {
            args.push('--glob', context.glob);
          }

          args.push('--', context.pattern, searchPath);

          const result = await execa('rg', args, {
            reject: false,
            timeout: 15_000,
            cwd: root,
          });

          if (result.exitCode === 1) {
            // No matches found
            return {
              content: `No matches found for pattern: ${context.pattern}`,
              isError: false,
            };
          }
          if (result.exitCode !== 0 && result.exitCode !== 1) {
            return {
              content: `grep error: ${result.stderr || 'Unknown error'}`,
              isError: true,
            };
          }

          output = result.stdout || '';
        } else {
          // Fallback to grep
          const args: string[] = ['-r', '-n', '--color=never'];

          if (!caseSensitive) args.push('-i');
          if (contextLines > 0) {
            args.push(`-C${contextLines}`);
          }
          if (context.glob) {
            args.push(`--include=${context.glob}`);
          }

          args.push('--', context.pattern, searchPath);

          const result = await execa('grep', args, {
            reject: false,
            timeout: 15_000,
            cwd: root,
          });

          if (result.exitCode === 1) {
            return {
              content: `No matches found for pattern: ${context.pattern}`,
              isError: false,
            };
          }
          if (result.exitCode !== 0 && result.exitCode !== 1) {
            return {
              content: `grep error: ${result.stderr || 'Unknown error'}`,
              isError: true,
            };
          }

          output = result.stdout || '';

          // Truncate to maxResults lines (grep doesn't have --max-count for recursive)
          const lines = output.split('\n');
          if (lines.length > maxResults) {
            output =
              lines.slice(0, maxResults).join('\n') +
              `\n... (${lines.length - maxResults} more matches, narrow your search)`;
          }
        }

        // Make paths relative to project root for readability
        const relativized = output
          .split('\n')
          .map(line => {
            if (line.startsWith(root + '/')) {
              return line.slice(root.length + 1);
            }
            if (line.startsWith(root)) {
              return line.slice(root.length);
            }
            return line;
          })
          .join('\n');

        const matchCount = relativized.split('\n').filter(l => l.trim() && !l.startsWith('--')).length;

        const header = `Found ${matchCount} match${matchCount !== 1 ? 'es' : ''} for "${context.pattern}":\n\n`;

        return {
          content: truncateStringForTokenEstimate(header + relativized, MAX_GREP_TOKENS, false),
          isError: false,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: `grep failed: ${msg}`,
          isError: true,
        };
      }
    },
  });
}
