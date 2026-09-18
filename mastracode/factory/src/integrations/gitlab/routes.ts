import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import type { RouteAuth } from '../../routes/route.js';
import type { MastraFactorySandboxConfig } from '../../sandbox/session-sandbox.js';
import { sanitizeSegment } from '../../sandbox/workdir.js';
import type { AuditEmitter } from '../../storage/domains/audit/domain.js';
import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import { GitLabApiError } from './api.js';
import {
  decodeIssueReference,
  decodeSourceId,
  encodeIssueReference,
  encodeSourceId,
  gitlabConnection,
} from './integration.js';
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
  sandbox?: MastraFactorySandboxConfig;
  emitAudit?: AuditEmitter['emit'];
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

type GitLabSourceIdentityMigration = { from: string; to: string };

function gitlabProjectPayload(source: { id: string; name: string; metadata?: Record<string, unknown> }) {
  const connectionId = typeof source.metadata?.connectionId === 'string' ? source.metadata.connectionId : null;
  const projectId = typeof source.metadata?.projectId === 'string' ? source.metadata.projectId : null;
  const projectPath = typeof source.metadata?.projectPath === 'string' ? source.metadata.projectPath : source.name;
  if (!connectionId || !projectId) return null;
  const repositoryName = projectPath.split('/').filter(Boolean).at(-1) ?? 'repo';
  return {
    id: source.id,
    name: source.name,
    projectId,
    projectPath,
    connectionId,
    accountLabel: typeof source.metadata?.accountLabel === 'string' ? source.metadata.accountLabel : null,
    defaultBranch: typeof source.metadata?.defaultBranch === 'string' ? source.metadata.defaultBranch : 'main',
    sandboxProvider: 'none',
    sandboxWorkdir: `~/${sanitizeSegment(repositoryName)}`,
  };
}

async function reconcileGitLabSourceIdentity({
  intake,
  orgId,
  sources,
}: {
  intake: IntakeStorage;
  orgId: string;
  sources: Array<{ id: string; metadata?: Record<string, unknown> }>;
}): Promise<{ migrations: GitLabSourceIdentityMigration[]; conflicts: GitLabSourceIdentityMigration[] }> {
  await intake.ensureReady();
  const [config, bindings] = await Promise.all([
    intake.getConfig({ orgId }),
    intake.listBindings({ orgId, integrationId: 'gitlab' }),
  ]);
  const selected = config.gitlab?.sourceIds ?? [];
  const canonicalByProject = new Map<string, string[]>();
  for (const source of sources) {
    const reference = decodeSourceId(source.id);
    if (!reference?.host) continue;
    const ids = canonicalByProject.get(reference.projectId) ?? [];
    ids.push(source.id);
    canonicalByProject.set(reference.projectId, ids);
  }

  const migrations = new Map<string, string>();
  for (const sourceId of new Set([...selected, ...bindings.map(binding => binding.sourceId)])) {
    const reference = decodeSourceId(sourceId);
    if (!reference || reference.host) continue;
    const candidates = canonicalByProject.get(reference.projectId) ?? [];
    if (candidates.length === 1) migrations.set(sourceId, candidates[0]!);
  }
  return intake.migrateSourceIds({
    orgId,
    integrationId: 'gitlab',
    migrations: [...migrations].map(([from, to]) => ({ from, to })),
  });
}

export function buildGitLabRoutes(options: BuildGitLabRoutesOptions): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const { gitlab, auth, intake, emitAudit } = options;
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
            await gitlab.verifyStatus();
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
              mode: direct ? 'direct' : 'platform',
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
            if (intake) {
              const identity = await reconcileGitLabSourceIdentity({
                intake,
                orgId: resolved.tenant.orgId,
                sources,
              });
              if (identity.conflicts.length > 0) {
                return c.json(
                  {
                    error: 'gitlab_source_identity_conflict',
                    message: 'Conflicting routes exist for the same GitLab project. Resolve the duplicate bindings.',
                    conflicts: identity.conflicts,
                  },
                  409,
                );
              }
              if (identity.migrations.length > 0) {
                await emitAudit?.({
                  context: loose(c),
                  input: {
                    action: 'factory.intake.config_updated',
                    targets: identity.migrations.map(migration => ({ type: 'intake_source', id: migration.to })),
                    metadata: { provider: 'gitlab', migrated: identity.migrations.length },
                  },
                });
              }
            }
            return c.json({
              projects: sources.flatMap(source => {
                const project = gitlabProjectPayload(source);
                return project ? [{ ...project, sandboxProvider: options.sandbox ? 'custom' : 'none' }] : [];
              }),
            });
          } catch (error) {
            return gitlabFetchError(loose(c), error);
          }
        },
      }),
      registerApiRoute('/web/gitlab/projects/registration', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          const resolved = await resolveOrgTenant(loose(c), auth);
          if ('response' in resolved) return resolved.response;
          const input = (await c.req.json().catch(() => null)) as { sourceId?: unknown } | null;
          const sourceId = typeof input?.sourceId === 'string' ? input.sourceId.trim() : '';
          if (!sourceId) return c.json({ error: 'invalid_gitlab_source' }, 400);
          try {
            const source = (await gitlab.intake.listSources(resolved.tenant)).find(candidate => candidate.id === sourceId);
            const project = source ? gitlabProjectPayload(source) : null;
            if (!project) return c.json({ error: 'gitlab_project_not_found' }, 404);
            const installation = await gitlab.versionControl.registerInstallation({
              orgId: resolved.tenant.orgId,
              userId: resolved.tenant.userId,
              installation: {
                externalId: project.connectionId,
                accountName: project.accountLabel ?? 'GitLab',
                accountType: 'GitLab',
                metadata: { connection: gitlabConnection(project.connectionId) },
              },
            });
            return c.json({
              project: {
                ...project,
                installationStorageId: installation.id,
                sandboxProvider: options.sandbox ? 'custom' : 'none',
              },
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
            return c.json(
              { error: 'gitlab_intake_disabled', message: 'GitLab intake is turned off in Settings.' },
              404,
            );
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

    routes.push(
      registerApiRoute('/web/gitlab/issues/:issueId', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resolved = await resolveOrgTenant(loose(c), auth);
          if ('response' in resolved) return resolved.response;
          const factoryProjectId = c.req.query('factoryProjectId')?.trim();
          if (!factoryProjectId) return c.json({ error: 'invalid_factory_project_id' }, 400);
          if ((await gitlab.resolveOrgId(factoryProjectId)) !== resolved.tenant.orgId) {
            return c.json({ error: 'factory_project_not_found' }, 404);
          }
          const issueId = c.req.param('issueId')?.trim();
          const issueReference = issueId ? decodeIssueReference(issueId) : null;
          if (!issueReference) return c.json({ error: 'invalid_gitlab_issue_id' }, 400);

          const { connectionId, projectId, projectPath } = issueReference;
          const sourceId = encodeSourceId({ connectionId, projectId, projectPath });
          await intake.ensureReady();
          const config = await intake.getConfig({ orgId: resolved.tenant.orgId, integrationIds: ['gitlab'] });
          const selection = config.gitlab!;
          const selected = new Set(selection.sourceIds ?? []);
          const routed =
            selection.enabled &&
            selected.has(sourceId) &&
            (await intake.listBindings({ orgId: resolved.tenant.orgId, integrationId: 'gitlab' })).some(
              binding => binding.factoryProjectId === factoryProjectId && binding.sourceId === sourceId,
            );
          if (!routed) return c.json({ error: 'gitlab_issue_not_routed' }, 404);

          try {
            const issue = await gitlab.intake.getIssue({
              connection: { type: 'oauth', accessToken: 'gitlab-route' },
              issueId,
            });
            if (!issue) return c.json({ error: 'gitlab_issue_not_found' }, 404);
            return c.json(issue);
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
