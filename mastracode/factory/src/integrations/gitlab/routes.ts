import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import type { RouteAuth } from '../../routes/route.js';
import { GitLabApiError } from './api.js';
import type { GitLabIntegrationBase } from './integration.js';
import { handleGitLabWebhook } from './webhook.js';
import type { ParsedGitLabWebhook } from './webhook.js';

type RouteContext = Context;

function loose(c: unknown): RouteContext {
  return c as RouteContext;
}

export interface BuildGitLabRoutesOptions {
  gitlab?: GitLabIntegrationBase;
  auth?: RouteAuth;
  webhookSecret?: string;
  ingestFactoryEvent?: (event: ParsedGitLabWebhook) => Promise<unknown>;
}

async function resolveOrgTenant(
  c: RouteContext,
  auth: RouteAuth,
): Promise<{ tenant: { orgId: string; userId: string } } | { response: Response }> {
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
  if (!tenant) return { response: c.json({ error: 'unauthorized', reason: 'auth_required' }, 401) };
  if (!tenant.orgId) {
    return {
      response: c.json(
        {
          error: 'organization_required',
          message: 'GitLab intake requires an organization. Personal accounts cannot use GitLab intake.',
        },
        403,
      ),
    };
  }
  return { tenant: { orgId: tenant.orgId, userId: tenant.userId } };
}

function gitlabFetchError(c: RouteContext, error: unknown) {
  if (error instanceof GitLabApiError && error.status === 401) {
    return c.json({ error: 'gitlab_auth_failed', message: error.message }, 409);
  }
  return c.json({ error: 'gitlab_fetch_failed', message: error instanceof Error ? error.message : String(error) }, 502);
}

export function buildGitLabRoutes(options: BuildGitLabRoutesOptions): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const { gitlab, auth } = options;
  const enabled = Boolean(gitlab && auth?.enabled());

  if (gitlab && auth) {
    routes.push(
      registerApiRoute('/web/gitlab/status', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const diagnostics = gitlab.diagnostics();
          if (!enabled) {
            return c.json({ enabled: false, configured: true, reauthRequired: false, reason: 'missing_config' });
          }
          await auth.ensureUser(loose(c));
          const tenant = auth.tenant(loose(c));
          if (!tenant) return c.json({ error: 'unauthorized', reason: 'auth_required' }, 401);
          if (!tenant.orgId) {
            return c.json({
              enabled: true,
              configured: false,
              organizationRequired: true,
              connections: [],
              accounts: [],
              reauthRequired: false,
              reason: 'organization_required',
            });
          }

          try {
            const connections = await gitlab.statusConnections();
            const active = connections?.filter(connection => connection.status === 'active');
            const direct = connections === undefined;
            const endpointHost = typeof diagnostics.endpointHost === 'string' ? diagnostics.endpointHost : null;
            const accounts = direct
              ? endpointHost
                ? [endpointHost]
                : []
              : (active ?? []).flatMap(connection => (connection.accountLabel ? [connection.accountLabel] : []));
            const configured = direct || (active?.length ?? 0) > 0;
            return c.json({
              enabled: true,
              configured,
              ...(connections ? { connections } : {}),
              accounts,
              reauthRequired: connections?.some(connection => connection.status === 'needs_reauth') ?? false,
              reason: configured ? 'ready' : 'not_connected',
            });
          } catch (error) {
            return gitlabFetchError(loose(c), error);
          }
        },
      }),
      registerApiRoute('/web/gitlab/projects', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resolved = await resolveOrgTenant(loose(c), auth);
          if ('response' in resolved) return resolved.response;
          try {
            const sources = await gitlab.intake.listSources(resolved.tenant);
            return c.json({
              projects: sources.map(source => ({
                id: source.id,
                name: source.name,
                connectionId:
                  typeof source.metadata?.connectionId === 'string' ? source.metadata.connectionId : null,
                accountLabel: typeof source.metadata?.accountLabel === 'string' ? source.metadata.accountLabel : null,
                defaultBranch:
                  typeof source.metadata?.defaultBranch === 'string' ? source.metadata.defaultBranch : null,
              })),
            });
          } catch (error) {
            return gitlabFetchError(loose(c), error);
          }
        },
      }),
    );
  }

  routes.push(
    registerApiRoute('/web/gitlab/webhook', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const result = await handleGitLabWebhook(loose(c), {
          webhookSecret: options.webhookSecret,
          ingestFactoryEvent: options.ingestFactoryEvent,
        });
        return c.json(result.body, result.status);
      },
    }),
  );
  return routes;
}
