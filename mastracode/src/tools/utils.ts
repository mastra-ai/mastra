import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { truncateStringForTokenEstimate } from '../utils/token-estimator.js';
import { ToolError } from './types.js';

// Per-file write queue to serialize concurrent writes
const fileWriteQueues = new Map<string, Promise<unknown>>();

async function withWriteLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const normalizedPath = path.resolve(filePath);

  // Get the current queue for this file (or a resolved promise if none)
  const currentQueue = fileWriteQueues.get(normalizedPath) ?? Promise.resolve();

  // Create a new promise that waits for the current queue, then runs our fn
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const ourPromise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // Chain our operation onto the queue
  const queuePromise = currentQueue
    .catch(() => {}) // Ignore errors from previous operations
    .then(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

  // Update the queue
  fileWriteQueues.set(normalizedPath, queuePromise);

  // Clean up when our operation completes
  queuePromise.finally(() => {
    // Only delete if we're still the last in queue
    if (fileWriteQueues.get(normalizedPath) === queuePromise) {
      fileWriteQueues.delete(normalizedPath);
    }
  });

  return ourPromise;
}

export const SNIPPET_LINES = 4;
export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (e) {
    const error = e instanceof Error ? e : new Error('Unknown error');
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
}
export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  } catch (e) {
    const error = e instanceof Error ? e : new Error('Unknown error');
    throw new Error(`Failed to write to ${filePath}: ${error.message}`);
  }
}

// Export the lock for operations that need to serialize read-modify-write
export { withWriteLock as withFileLock };
export function makeOutput(fileContent: string, fileDescriptor: string, initLine = 1, expandTabs = true): string {
  if (expandTabs) {
    fileContent = fileContent.replace(/\t/g, '    ');
  }
  // Convert absolute paths to relative paths from cwd for token efficiency
  const displayPath = path.isAbsolute(fileDescriptor) ? path.relative(process.cwd(), fileDescriptor) : fileDescriptor;
  const lines = fileContent.split('\n');
  const numberedLines = lines.map((line, i) => `${(i + initLine).toString().padStart(6)}\t${line}`).join('\n');
  return `Here's the result of running \`cat -n\` on ${displayPath}:\n${truncateStringForTokenEstimate(numberedLines, 500, false)}\n`;
}
export async function validatePath(command: string, filePath: string): Promise<void> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!path.isAbsolute(filePath)) {
    filePath = absolutePath;
  }
  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory() && command !== 'view') {
      throw new ToolError(
        `The path ${filePath} is a directory and only the \`view\` command can be used on directories`,
      );
    }
    if (command === 'create' && stats.isFile()) {
      throw new ToolError(`File already exists at: ${filePath}. Cannot overwrite files using command \`create\``);
    }
  } catch (e) {
    const error = e instanceof Error ? e : new Error('Unknown error');
    if ('code' in error && error.code === 'ENOENT' && command !== 'create') {
      throw new ToolError(`The path ${filePath} does not exist. Please provide a valid path.`);
    }
    if (command !== 'create') {
      throw error;
    }
  }
}
export function truncateText(text: string, maxLength = 1000): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '... (truncated)';
}

/**
 * Check whether `targetPath` falls inside `projectRoot` or any of the
 * additional `allowedPaths`.  All arguments are expected to be absolute.
 *
 * Returns `true` when access should be **allowed**.
 */
export function isPathAllowed(targetPath: string, projectRoot: string, allowedPaths: string[] = []): boolean {
  const resolved = path.resolve(targetPath);
  const roots = [projectRoot, ...allowedPaths].map(p => path.resolve(p));

  return roots.some(root => resolved === root || resolved.startsWith(root + path.sep));
}

/**
 * Guard that throws a descriptive error when a path is not allowed.
 * Designed to be called early in each tool's `execute` function.
 */
export function assertPathAllowed(targetPath: string, projectRoot: string, allowedPaths: string[] = []): void {
  if (!isPathAllowed(targetPath, projectRoot, allowedPaths)) {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedRoot = path.resolve(projectRoot);
    throw new ToolError(
      `Access denied: "${resolvedTarget}" is outside the project root "${resolvedRoot}"` +
        (allowedPaths.length ? ` and allowed paths [${allowedPaths.join(', ')}]` : '') +
        `. Use /sandbox to add additional allowed paths.`,
    );
  }
}

/**
 * Read `sandboxAllowedPaths` from the Mastra harness runtime context.
 * Returns an empty array when the context is unavailable (e.g. in tests).
 */
export function getAllowedPathsFromContext(
  toolContext: { requestContext?: { get: (key: string) => unknown } } | undefined,
): string[] {
  if (!toolContext?.requestContext) return [];
  const harnessCtx = toolContext.requestContext.get('harness') as
    | {
        state?: { sandboxAllowedPaths?: string[] };
        getState?: () => { sandboxAllowedPaths?: string[] };
      }
    | undefined;
  return harnessCtx?.getState?.()?.sandboxAllowedPaths ?? harnessCtx?.state?.sandboxAllowedPaths ?? [];
}
