import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import type { RouteAuth } from '../../routes/route.js';
import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import { GitLabApiError } from './api.js';
import { decodeSourceId, encodeIssueReference } from './integration.js';
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
  intake?: IntakeStorage;
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
  if (error instanceof GitLabApiError && error.code === 'gitlab_auth_failed') {
    return c.json({ error: 'gitlab_auth_failed', message: error.message }, 409);
  }
  return c.json({ error: 'gitlab_fetch_failed', message: error instanceof Error ? error.message : String(error) }, 502);
}

export function buildGitLabRoutes(options: BuildGitLabRoutesOptions): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const { gitlab, auth, intake } = options;
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

  if (gitlab && auth && intake) {
    routes.push(
      registerApiRoute('/web/gitlab/issues', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resolved = await resolveOrgTenant(loose(c), auth);
          if ('response' in resolved) return resolved.response;
          const factoryProjectId = c.req.query('factoryProjectId')?.trim();
          if (!factoryProjectId) return c.json({ error: 'invalid_factory_project_id' }, 400);
          const board = c.req.query('board')?.trim();
          if (!board) return c.json({ error: 'invalid_board' }, 400);
          if ((await gitlab.resolveOrgId(factoryProjectId)) !== resolved.tenant.orgId) {
            return c.json({ error: 'factory_project_not_found' }, 404);
          }

          await intake.ensureReady();
          const config = await intake.getConfig({ orgId: resolved.tenant.orgId, integrationIds: ['gitlab'] });
          const selection = config.gitlab!;
          if (!selection.enabled) {
            return c.json({ error: 'gitlab_intake_disabled', message: 'GitLab intake is turned off in Settings.' }, 404);
          }
          const selected = new Set(selection.sourceIds ?? []);
          const sourceIds = [
            ...new Set(
              (await intake.listBindings({ orgId: resolved.tenant.orgId, integrationId: 'gitlab' }))
                .filter(
                  binding =>
                    binding.factoryProjectId === factoryProjectId &&
                    binding.board === board &&
                    selected.has(binding.sourceId),
                )
                .map(binding => binding.sourceId),
            ),
          ];
          if (sourceIds.length === 0) return c.json({ issues: [], nextCursor: null });

          try {
            const result = await gitlab.intake.listIssues({
              connection: { type: 'oauth', accessToken: 'gitlab-route' },
              sourceIds,
              cursor: c.req.query('after')?.trim() || undefined,
            });
            return c.json({
              ...result,
              issues: result.issues.map(issue => {
                const source = decodeSourceId(issue.sourceId ?? '');
                const issueIid = Number(issue.id);
                if (!source || !Number.isSafeInteger(issueIid) || issueIid <= 0) {
                  throw new Error('GitLab returned an invalid routed issue reference.');
                }
                return { ...issue, externalId: encodeIssueReference({ ...source, issueIid }) };
              }),
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
