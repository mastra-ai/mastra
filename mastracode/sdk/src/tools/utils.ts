import * as path from 'node:path';
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { buildSkillPaths } from './skill-paths.js';

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
 * Read allowed paths from the Mastra controller runtime context.
 * Combines skill paths (computed dynamically from projectPath and configDir)
 * with user-approved sandbox paths from controller state so that both parent
 * and subagent tools have the same access.
 * Returns default skill paths when the context is unavailable (e.g. in tests).
 */
export function getAllowedPathsFromContext(
  toolContext: { requestContext?: { get: (key: string) => unknown } } | undefined,
): string[] {
  const agentControllerCtx = toolContext?.requestContext?.get('controller') as
    | {
        getState?: () => { sandboxAllowedPaths?: string[]; projectPath?: string; configDir?: string };
        session?: {
          state?: { get?: () => { sandboxAllowedPaths?: string[]; projectPath?: string; configDir?: string } };
        };
      }
    | undefined;
  const state = agentControllerCtx?.getState?.() ?? agentControllerCtx?.session?.state?.get?.();
  const projectPath = state?.projectPath ? path.resolve(state.projectPath) : process.cwd();
  const configDir = state?.configDir ?? DEFAULT_CONFIG_DIR;
  const skillPaths = buildSkillPaths(projectPath, configDir);
  const sandboxPaths = state?.sandboxAllowedPaths ?? [];

  return [...skillPaths, ...sandboxPaths];
}
