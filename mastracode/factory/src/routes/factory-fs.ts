/**
 * Read-only HTTP surface for the durable factory filesystem (`/factory` in
 * session workspaces), so the web UI can browse and preview the files agents
 * persist there.
 *
 * Unlike session agents — whose view is confined to their own project — the
 * UI serves signed-in org members, so these routes expose the whole org tree:
 * `shared/` plus every `projects/<project>/` directory. Tenancy still comes
 * from the authenticated org; backend paths reuse the exact same
 * `orgs/<orgId>/...` mapping as `FactoryFilesystem`, so what the UI shows is
 * precisely what sessions wrote. The `projectId` query lets the UI learn the
 * current project's directory name so it can focus there by default.
 */

import { posix as posixPath } from 'node:path';

import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { WorkspaceFilesystem } from '@mastra/core/workspace';
import type { Context } from 'hono';

import { sanitizePathSegment } from '../filesystem.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

export interface FactoryFsEntry {
  name: string;
  /** Path relative to the org root, e.g. `shared/notes.md` or `projects/Alpha/plans/x.md`. */
  path: string;
  type: 'file' | 'directory';
  size: number;
  updatedAt: string;
}

export interface FactoryFsListing {
  /** False when no durable filesystem is configured on this deployment. */
  available: boolean;
  /** Org-relative directory of the requested project (e.g. `projects/Alpha`), when resolvable. */
  projectDir?: string;
  entries: FactoryFsEntry[];
}

export interface FactoryFsFile {
  /** Org-relative file path. */
  path: string;
  name: string;
  size: number;
  updatedAt: string;
  contentType: 'text' | 'unsupported';
  content?: string;
  truncated?: boolean;
}

const MAX_TEXT_FILE_BYTES = 512 * 1024;
const MAX_LIST_ENTRIES = 2_000;
const MAX_LIST_DEPTH = 16;
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });

function loose(context: unknown): Context {
  return context as Context;
}

/**
 * Validate a client-supplied org-relative path: no absolute paths, no
 * backslashes, and no `..` escaping the org prefix after normalization.
 * Returns the normalized relative path or null when invalid.
 */
function normalizeRelativePath(input: string): string | null {
  if (input.includes('\\') || input.startsWith('/')) return null;
  const normalized = posixPath.normalize(input);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) return null;
  return normalized;
}

export interface FactoryFsRoutesDeps extends RouteDependencies {
  /** The durable factory filesystem backend; omitted → routes answer `available: false`. */
  filesystem?: WorkspaceFilesystem;
  /** Projects domain — resolves the current project's directory name. */
  projects: Pick<FactoryProjectsStorage, 'get' | 'ensureReady'>;
}

export class FactoryFsRoutes extends Route<FactoryFsRoutesDeps> {
  async #resolveTenant(context: Context): Promise<{ orgId: string } | { response: Response }> {
    await this.deps.auth.ensureUser(context);
    const tenant = this.deps.auth.tenant(context);
    if (!tenant) return { response: context.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: context.json(
          { error: 'organization_required', message: 'The factory filesystem requires an organization.' },
          403,
        ),
      };
    }
    return { orgId: tenant.orgId };
  }

  #orgRoot(orgId: string): string {
    return posixPath.join('orgs', sanitizePathSegment(orgId));
  }

  /** Org-relative directory for a project id, when it resolves. */
  async #projectDir(orgId: string, projectId: string | undefined): Promise<string | undefined> {
    if (!projectId) return undefined;
    try {
      await this.deps.projects.ensureReady();
      const project = await this.deps.projects.get({ orgId, id: projectId });
      return project ? posixPath.join('projects', sanitizePathSegment(project.name)) : undefined;
    } catch {
      return undefined;
    }
  }

  /** Recursively walk the org root, returning org-relative entries. */
  async #walk(filesystem: WorkspaceFilesystem, orgRoot: string): Promise<FactoryFsEntry[]> {
    const entries: FactoryFsEntry[] = [];
    const queue: Array<{ relative: string; depth: number }> = [{ relative: '', depth: 0 }];

    while (queue.length > 0 && entries.length < MAX_LIST_ENTRIES) {
      const { relative, depth } = queue.shift()!;
      let children;
      try {
        children = await filesystem.readdir(posixPath.join(orgRoot, relative));
      } catch {
        // Missing directory (virtual/empty bucket prefix) — nothing to list.
        continue;
      }
      for (const child of children) {
        if (entries.length >= MAX_LIST_ENTRIES) break;
        const childRelative = relative ? `${relative}/${child.name}` : child.name;
        if (child.type === 'directory') {
          entries.push({ name: child.name, path: childRelative, type: 'directory', size: 0, updatedAt: '' });
          if (depth + 1 < MAX_LIST_DEPTH) queue.push({ relative: childRelative, depth: depth + 1 });
          continue;
        }
        let size = child.size ?? 0;
        let updatedAt = '';
        try {
          const stat = await filesystem.stat(posixPath.join(orgRoot, childRelative));
          size = stat.size;
          updatedAt = stat.modifiedAt.toISOString();
        } catch {
          // Entry disappeared between readdir and stat — keep readdir's view.
        }
        entries.push({ name: child.name, path: childRelative, type: 'file', size, updatedAt });
      }
    }
    return entries;
  }

  async #readFile(filesystem: WorkspaceFilesystem, orgRoot: string, relativePath: string): Promise<FactoryFsFile> {
    const backendPath = posixPath.join(orgRoot, relativePath);
    const stat = await filesystem.stat(backendPath);
    const base = {
      path: relativePath,
      name: posixPath.basename(relativePath),
      size: stat.size,
      updatedAt: stat.modifiedAt.toISOString(),
    };

    const content = await filesystem.readFile(backendPath);
    const bytes =
      typeof content === 'string'
        ? Buffer.from(content, 'utf8')
        : Buffer.isBuffer(content)
          ? content
          : Buffer.from(content as Uint8Array);
    const truncated = bytes.byteLength > MAX_TEXT_FILE_BYTES;
    const sliced = truncated ? bytes.subarray(0, MAX_TEXT_FILE_BYTES) : bytes;
    try {
      const text = TEXT_DECODER.decode(sliced);
      return { ...base, contentType: 'text', content: text, ...(truncated ? { truncated } : {}) };
    } catch {
      // Truncation can split a multi-byte sequence; a genuine binary file
      // fails to decode either way.
      return { ...base, contentType: 'unsupported' };
    }
  }

  routes(): ApiRoute[] {
    return [
      registerApiRoute('/web/factory/fs/list', {
        method: 'GET',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;

          const projectDir = await this.#projectDir(tenant.orgId, context.req.query('projectId'));
          const filesystem = this.deps.filesystem;
          if (!filesystem) {
            return context.json({ available: false, projectDir, entries: [] } satisfies FactoryFsListing);
          }
          try {
            const entries = await this.#walk(filesystem, this.#orgRoot(tenant.orgId));
            return context.json({ available: true, projectDir, entries } satisfies FactoryFsListing);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return context.json({ error: message }, 500);
          }
        },
      }),
      registerApiRoute('/web/factory/fs/file', {
        method: 'GET',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;

          const rawPath = context.req.query('path');
          if (!rawPath) return context.json({ error: 'missing_path' }, 400);
          const relativePath = normalizeRelativePath(rawPath);
          if (!relativePath) return context.json({ error: 'invalid_path' }, 400);

          const filesystem = this.deps.filesystem;
          if (!filesystem) return context.json({ error: 'filesystem_not_configured' }, 404);

          try {
            return context.json(await this.#readFile(filesystem, this.#orgRoot(tenant.orgId), relativePath));
          } catch {
            return context.json({ error: 'not_found' }, 404);
          }
        },
      }),
    ];
  }
}
