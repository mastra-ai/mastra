import * as path from 'node:path';
import { skillPaths } from '../agents/workspace.js';

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
 * Read allowed paths from the Mastra harness runtime context.
 * Combines skill paths (computed at startup) with user-approved sandbox paths
 * from harness state so that both parent and subagent tools have the same access.
 * Returns skill paths when the context is unavailable (e.g. in tests).
 */
export function getAllowedPathsFromContext(
  toolContext: { requestContext?: { get: (key: string) => unknown } } | undefined,
): string[] {
  if (!toolContext?.requestContext) {
    return [...skillPaths];
  }
  const harnessCtx = toolContext.requestContext.get('harness') as
    | {
        state?: { sandboxAllowedPaths?: string[] };
        getState?: () => { sandboxAllowedPaths?: string[] };
      }
    | undefined;
  const sandboxPaths = harnessCtx?.getState?.()?.sandboxAllowedPaths ?? harnessCtx?.state?.sandboxAllowedPaths ?? [];
  return [...skillPaths, ...sandboxPaths];
}
