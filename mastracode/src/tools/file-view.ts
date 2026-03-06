import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { truncateStringForTokenEstimate } from '../utils/token-estimator';
import { assertPathAllowed, getAllowedPathsFromContext } from './utils.js';

const execAsync = promisify(exec);

// Maximum tokens for view tool output
const MAX_VIEW_TOKENS = 2_000;

/**
 * Shorten an absolute path for display to save tokens
 * Priority: relative to cwd > ~/path > absolute
 */
function shortenPath(absolutePath: string, cwd: string): string {
  // If path is under cwd, make it relative
  if (absolutePath.startsWith(cwd + '/')) {
    return absolutePath.slice(cwd.length + 1);
  }
  if (absolutePath === cwd) {
    return '.';
  }

  // If path is under home, use ~/
  const home = homedir();
  if (absolutePath.startsWith(home + '/')) {
    return '~' + absolutePath.slice(home.length);
  }
  if (absolutePath === home) {
    return '~';
  }

  // Otherwise return as-is
  return absolutePath;
}

/**
 * Format file content with line numbers (like `cat -n`)
 */
function makeOutput(fileContent: string, fileDescriptor: string, initLine = 1, expandTabs = true): string {
  if (expandTabs) {
    fileContent = fileContent.replace(/\t/g, '    ');
  }
  const lines = fileContent.split('\n');
  const numberedLines = lines.map((line, i) => `${(i + initLine).toString().padStart(6)}\t${line}`).join('\n');
  return `Here's the result of running \`cat -n\` on ${fileDescriptor}:\n${numberedLines}\n`;
}

/**
 * Read file content
 */
async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (e) {
    const error = e instanceof Error ? e : new Error('Unknown error');
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
}

/**
 * Check if path is a directory
 */
async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Validate path exists and is accessible
 */
async function validatePath(command: string, filePath: string): Promise<void> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  if (!path.isAbsolute(filePath)) {
    filePath = absolutePath;
  }

  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory() && command !== 'view') {
      throw new Error(`The path ${filePath} is a directory and only the \`view\` command can be used on directories`);
    }
  } catch (e) {
    const error = e instanceof Error ? e : new Error('Unknown error');
    if ('code' in error && error.code === 'ENOENT') {
      throw new Error(`The path ${filePath} does not exist. Please provide a valid path.`);
    }
    throw error;
  }
}

/**
 * Create the view tool for viewing file contents or directory listings
 */
export function createViewTool(projectRoot?: string) {
  return createTool({
    id: 'view',
    description: `Read file contents with line numbers, or list directory contents. Paths are relative to the project root.

Usage notes:
- Use this to read files BEFORE editing them. Never modify code you haven't read.
- Use view_range for large files to read specific line ranges (e.g., [1, 50] for first 50 lines).
- For directories, shows files up to 2 levels deep (excluding hidden files).
- Output includes line numbers (like cat -n) for easy reference.
- When NOT to use this tool: for searching file contents (use grep), for finding files by name (use glob).
- Output is truncated if the file is very large. Use view_range to see specific sections.`,
    inputSchema: z.object({
      path: z.string().describe('Path to the file or directory (relative to project root)'),
      view_range: z
        .array(z.number().nullable())
        .length(2)
        .optional()
        .describe('Optional range of lines to view [start, end]'),
    }),
    execute: async (context, toolContext) => {
      try {
        const { path: filePath, view_range } = context;
        const root = projectRoot || process.cwd();

        // Resolve relative to projectRoot if provided, otherwise relative to process.cwd()
        const absolutePath = path.resolve(root, filePath);

        // Security: ensure the path is within the project root or allowed paths
        const allowedPaths = getAllowedPathsFromContext(toolContext);
        assertPathAllowed(absolutePath, root, allowedPaths);

        await validatePath('view', absolutePath);

        // Handle directory listing
        if (await isDirectory(absolutePath)) {
          const { stdout, stderr } = await execAsync(`find "${absolutePath}" -maxdepth 2 -not -path '*/.*'`);

          if (stderr) {
            throw new Error(stderr);
          }

          // Shorten paths in output to save tokens
          const cwd = projectRoot || process.cwd();
          let lines = stdout
            .split('\n')
            .map(line => (line.trim() ? shortenPath(line.trim(), cwd) : ''))
            .filter(Boolean);

          const totalLines = lines.length;
          const displayPath = shortenPath(absolutePath, cwd);

          // Apply view_range to slice the directory listing
          if (view_range && view_range[0] != null && view_range[1] != null) {
            const [start, end] = view_range as [number, number];
            lines = lines.slice(Math.max(0, start - 1), end === -1 ? undefined : end);
          }

          const dirOutput = `Here's the files and directories up to 2 levels deep in ${displayPath}, excluding hidden items (${totalLines} entries):\n${lines.join('\n')}\n`;
          return {
            content: truncateStringForTokenEstimate(dirOutput, MAX_VIEW_TOKENS, false),
            isError: false,
          };
        }

        // Handle file viewing
        const fileContent = await readFile(absolutePath);
        if (view_range && view_range[0] != null && view_range[1] != null) {
          const fileLines = fileContent.split('\n');
          const nLinesFile = fileLines.length;
          let [start, end] = view_range as [number, number];

          // Validate start line
          if (start < 1 || start > nLinesFile) {
            throw new Error(
              `Invalid \`view_range\`: ${view_range}. Its first element \`${start}\` should be within the range of lines of the file: [1, ${nLinesFile}]`,
            );
          }

          // Handle end line
          if (end !== -1) {
            if (end > nLinesFile) {
              end = nLinesFile;
            }
            if (end < start) {
              throw new Error(
                `Invalid \`view_range\`: ${view_range}. Its second element \`${end}\` should be larger or equal than its first \`${start}\``,
              );
            }
          }

          // Extract selected lines
          const selectedLines = end === -1 ? fileLines.slice(start - 1) : fileLines.slice(start - 1, end);

          const output = makeOutput(selectedLines.join('\n'), String(filePath), start);
          return {
            // Truncate from end (keep the start of the range the user requested)
            content: truncateStringForTokenEstimate(output, MAX_VIEW_TOKENS, false),
            isError: false,
          };
        }

        const fileLines = fileContent.split('\n');
        const output = makeOutput(fileContent, String(filePath));
        const truncated = truncateStringForTokenEstimate(output, MAX_VIEW_TOKENS, false);
        const wasTruncated = truncated !== output;
        return {
          content: wasTruncated
            ? truncated + `\n\n... ${fileLines.length} total lines in file. Use view_range to see specific sections.`
            : truncated,
          isError: false,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: errorMessage,
          isError: true,
        };
      }
    },
  });
}
