import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { ProjectRepository, SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { RouteAuth } from './route.js';

interface SourceControlSettingsRoutesOptions {
  auth: RouteAuth;
  sourceControls: readonly SourceControlStorageHandle[];
}

async function loadRepository(
  c: Context,
  options: SourceControlSettingsRoutesOptions,
): Promise<{ sourceControl: SourceControlStorageHandle; repository: ProjectRepository; orgId: string } | Response> {
  await options.auth.ensureUser(c);
  const tenant = options.auth.tenant(c);
  if (!tenant) return c.json({ error: 'unauthorized' }, 401);
  const orgId = tenant.orgId;
  if (!orgId) return c.json({ error: 'organization_required' }, 403);

  const id = c.req.param('id');
  if (!id) return c.json({ error: 'project_repository_not_found' }, 404);
  const matches = (
    await Promise.all(
      options.sourceControls.map(async sourceControl => {
        const repository = await sourceControl.projectRepositories.get({ orgId, id });
        return repository ? { sourceControl, repository, orgId } : null;
      }),
    )
  ).filter(
    (match): match is { sourceControl: SourceControlStorageHandle; repository: ProjectRepository; orgId: string } =>
      match !== null,
  );
  if (matches.length > 1) return c.json({ error: 'ambiguous_project_repository' }, 409);
  return matches[0] ?? c.json({ error: 'project_repository_not_found' }, 404);
}

function commandFromBody(
  body: Record<string, unknown>,
  key: 'setupCommand' | 'teardownCommand',
): string | null | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value.trim() || null;
  return null;
}

export function buildSourceControlSettingsRoutes(options: SourceControlSettingsRoutesOptions): ApiRoute[] {
  const path = '/web/source-control/projects/:id/settings';
  return [
    registerApiRoute(path, {
      method: 'GET',
      requiresAuth: false,
      handler: async raw => {
        const c = raw as Context;
        const loaded = await loadRepository(c, options);
        if (loaded instanceof Response) return loaded;
        return c.json({
          setupCommand: loaded.repository.setupCommand,
          teardownCommand: loaded.repository.teardownCommand,
        });
      },
    }),
    registerApiRoute(path, {
      method: 'POST',
      requiresAuth: false,
      handler: async raw => {
        const c = raw as Context;
        const loaded = await loadRepository(c, options);
        if (loaded instanceof Response) return loaded;
        let body: Record<string, unknown>;
        try {
          body = await c.req.json();
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid JSON body');
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }

        for (const key of ['setupCommand', 'teardownCommand'] as const) {
          const value = body[key];
          if (value === undefined) continue;
          if (value !== null && typeof value !== 'string') return c.json({ error: `Invalid ${key}` }, 400);
          if (typeof value === 'string' && value.length > 2000)
            return c.json({ error: `${key} too long (max 2000 characters)` }, 400);
          if (typeof value === 'string' && /[\0-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))
            return c.json({ error: `${key} contains control characters` }, 400);
        }

        const setupCommand = commandFromBody(body, 'setupCommand');
        const teardownCommand = commandFromBody(body, 'teardownCommand');
        const saved = await loaded.sourceControl.projectRepositories.update({
          orgId: loaded.orgId,
          id: loaded.repository.id,
          input: {
            ...(setupCommand !== undefined ? { setupCommand } : {}),
            ...(teardownCommand !== undefined ? { teardownCommand } : {}),
          },
        });
        if (!saved) return c.json({ error: 'project_repository_not_found' }, 404);
        return c.json({ setupCommand: saved.setupCommand, teardownCommand: saved.teardownCommand });
      },
    }),
  ];
}
