/**
 * Mastra `apiRoutes` for the intake source configuration (Settings › Intake).
 *
 * Available whenever web auth + the app DB are up (resolved by the caller via
 * `resolveIntakeReady`), independent of which integrations are configured —
 * the SPA combines this config with the GitHub/Linear status routes to decide
 * what to render.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { emitAudit } from '../audit/audit';
import { ensureWebAuthUser, webAuthTenant } from '../auth';
import { getIntakeConfig, parseIntakeConfig, saveIntakeConfig } from './store';

function loose(c: unknown): Context {
  return c as Context;
}

/** Resolve the `(orgId, userId)` tenant or a ready-to-return error response. */
async function resolveTenant(c: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
  await ensureWebAuthUser(c);
  const tenant = webAuthTenant(c);
  if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (!tenant.orgId) {
    return {
      response: c.json(
        { error: 'organization_required', message: 'Intake configuration requires a WorkOS organization.' },
        403,
      ),
    };
  }
  return { orgId: tenant.orgId, userId: tenant.userId };
}

/** Build the intake config routes as Mastra `apiRoutes`. */
export function buildIntakeRoutes(): ApiRoute[] {
  return [
    registerApiRoute('/web/intake/config', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const tenant = await resolveTenant(loose(c));
        if ('response' in tenant) return tenant.response;
        const config = await getIntakeConfig(tenant.orgId, tenant.userId);
        return c.json({ config });
      },
    }),
    registerApiRoute('/web/intake/config', {
      method: 'PUT',
      requiresAuth: false,
      handler: async c => {
        const tenant = await resolveTenant(loose(c));
        if ('response' in tenant) return tenant.response;

        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const config = parseIntakeConfig(body);
        if (!config) return c.json({ error: 'invalid_config' }, 400);

        await saveIntakeConfig(tenant.orgId, tenant.userId, config);
        await emitAudit(loose(c), {
          action: 'factory.intake.config_updated',
          targets: [{ type: 'intake_config', id: tenant.orgId }],
          metadata: {
            github: { enabled: config.github.enabled, repositories: config.github.repositoryIds?.length ?? null },
            linear: { enabled: config.linear.enabled, projects: config.linear.projectIds?.length ?? null },
          },
        });
        return c.json({ config });
      },
    }),
  ];
}
