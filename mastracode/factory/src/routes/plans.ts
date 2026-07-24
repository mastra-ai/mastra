import { isAbsolute, posix as posixPath } from 'node:path';

import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { SessionFsDeps } from './fs.js';
import {
  readConfinedSessionWorkspaceFile,
  readConfinedWorkspaceFile,
  resolveAuthorizedSession,
  resolveFsRoot,
} from './fs.js';

/**
 * Plan-file read endpoint for the web UI.
 *
 * Core's `submit_plan` tool suspends with only a workspace-relative `path`
 * pointing at a markdown plan file (by convention under `.mastracode/plans/`).
 * The web transcript fetches that file here to render the plan during the
 * approval window. Access is strictly confined: only relative paths under
 * `.mastracode/plans/`, only `.md` files. Workspace/root confinement and
 * symlink clamping from the fs helpers apply as a second layer.
 */

const PLANS_ROOT = '.mastracode/plans';

/** Response shape for `POST /web/plans/file`. */
export interface PlanFile {
  /** Normalized workspace-relative plan path. */
  path: string;
  /** Raw plan markdown. */
  content: string;
  truncated: boolean;
  updatedAt: string;
}

/** Erase a route handler's path-parameterized context to a plain `Context`. */
function loose(c: unknown): Context {
  return c as Context;
}

/**
 * Validate that `path` is a relative markdown path confined to
 * `.mastracode/plans/`. Returns the normalized POSIX path, or throws.
 */
export function assertPlanPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) throw new Error('Missing required field: path');
  const posixLike = trimmed.replace(/\\/g, '/');
  if (isAbsolute(trimmed) || posixLike.startsWith('/')) throw new Error('path must be relative');
  const normalized = posixPath.normalize(posixLike);
  if (normalized.split('/').includes('..')) throw new Error('path escapes workspace');
  if (normalized !== PLANS_ROOT && !normalized.startsWith(`${PLANS_ROOT}/`))
    throw new Error('path is outside the plans directory');
  if (!normalized.endsWith('.md')) throw new Error('path must be a markdown (.md) file');
  return normalized;
}

/**
 * Build the plan-file routes as Mastra `apiRoutes`:
 *   - `POST /web/plans/file` with body `{ workspacePath, path }` — read raw
 *     plan markdown, confined to `.mastracode/plans/*.md`.
 */
export function buildPlanRoutes(options: { root?: string; sessionFs?: SessionFsDeps } = {}): ApiRoute[] {
  const root = resolveFsRoot(options.root);
  const sessionFs = options.sessionFs;

  return [
    registerApiRoute('/web/plans/file', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        let body: { workspacePath?: unknown; path?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const workspacePath = typeof body.workspacePath === 'string' ? body.workspacePath : '';
        const path = typeof body.path === 'string' ? body.path : '';
        if (!workspacePath) return c.json({ error: 'Missing required field: workspacePath' }, 400);
        if (!path) return c.json({ error: 'Missing required field: path' }, 400);

        let safePath: string;
        try {
          safePath = assertPlanPath(path);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return c.json({ error: message }, 403);
        }

        try {
          const session = await resolveAuthorizedSession(loose(c), sessionFs, workspacePath);
          const file =
            session && sessionFs
              ? await readConfinedSessionWorkspaceFile(sessionFs.fleet, session, safePath)
              : await readConfinedWorkspaceFile(root, workspacePath, safePath);
          if (file.contentType !== 'text') return c.json({ error: 'Plan file is not readable text' }, 400);
          const planFile: PlanFile = {
            path: file.path,
            content: file.content ?? '',
            truncated: file.truncated ?? false,
            updatedAt: file.updatedAt,
          };
          return c.json(planFile);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // A nonexistent plan file surfaces from the confined resolver as
          // 'Path is outside the workspace' (it conflates non-existence with
          // symlink escape). The path shape is already validated above, so
          // treat it as not-found rather than forbidden.
          const status =
            message === 'Path is outside the workspace'
              ? 404
              : message.includes('outside') ||
                  message.includes('relative') ||
                  message.includes('escapes') ||
                  message.includes('not available')
                ? 403
                : message === 'Path is a directory'
                  ? 400
                  : message.includes('not found') || message.includes('ENOENT') || message.includes('no such file')
                    ? 404
                    : 500;
          return c.json({ error: message }, status);
        }
      },
    }),
  ];
}
