import type { AgentController } from '@mastra/core/agent-controller';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import type { MastraCodeState } from '@mastra/code-sdk/schema';

import type { AuditEmitter } from '@mastra/factory/storage/domains/audit/domain';
import { factoryRouteAuth } from './auth.js';
import type { FactoryIntegration, IntegrationContext } from './factory-integration.js';
import { getGithubFeatureDiagnostics } from './github/config.js';
import { getLinearFeatureDiagnostics } from './linear/config.js';
import { WorkItemRoutes } from '@mastra/factory/routes/work-items';
import { buildFsRoutes } from './fs-routes.js';
import { IntakeRoutes } from '@mastra/factory/routes/intake';
import { OAuthRoutes } from '@mastra/factory/routes/oauth';
import { registerSandboxReattach } from './sandbox-reattach-registration.js';
import { buildSkillRoutes } from './skills/routes.js';
import type { StateSigner } from './state-signing.js';
import { invalidateTenantCredentialSnapshots } from '@mastra/factory/routes/tenant-credentials';
import { ConfigRoutes } from '@mastra/factory/routes/config';
import type { IntegrationStorage } from '@mastra/factory/storage/domains/integrations/base';
import type { SourceControlStorage } from '@mastra/factory/storage/domains/source-control/base';
import type { IntakeStorage } from '@mastra/factory/storage/domains/intake/base';
import type { ModelCredentialsStorage } from '@mastra/factory/storage/domains/credentials/base';
import type { ModelPacksStorage } from '@mastra/factory/storage/domains/model-packs/base';
import type { FactoryProjectsStorage } from '@mastra/factory/storage/domains/projects/base';
import type { QueueHealthStorage } from '@mastra/factory/storage/domains/queue-health/base';
import type { WorkItemsStorage } from '@mastra/factory/storage/domains/work-items/base';

registerSandboxReattach();

export interface IntegrationRegistration {
  integration: FactoryIntegration;
  ready: boolean;
  ensureReady: () => Promise<void>;
}

export interface WebApiRoutesDeps {
  controllerId: string;
  controller: AgentController<MastraCodeState>;
  authStorage: AuthStorage;
  audit: AuditEmitter;
  fsRoot?: string;
  publicOrigin: string;
  stateSigner?: StateSigner;
  integrationStorage: IntegrationStorage;
  sourceControlStorage: SourceControlStorage;
  /** App-table domain handles, registered and owned by `MastraFactory.prepare()`. */
  domains: {
    intake: IntakeStorage;
    modelCredentials: ModelCredentialsStorage;
    modelPacks: ModelPacksStorage;
    projects: FactoryProjectsStorage;
    queueHealth: QueueHealthStorage;
    workItems: WorkItemsStorage;
  };
  integrations?: IntegrationRegistration[];
  intakeReady: boolean;
  factoryReady: boolean;
}

function guardIntegrationRoutes({
  integration,
  ready,
  ensureReady,
  routes,
}: IntegrationRegistration & { routes: ApiRoute[] }): ApiRoute[] {
  if (ready) return routes;
  return routes.map(route => {
    if ('handler' in route) {
      const handler = route.handler;
      return {
        ...route,
        handler: async (context: Parameters<typeof handler>[0]) => {
          try {
            await ensureReady();
          } catch {
            return context.json(
              { error: 'integration_unavailable', message: `${integration.id} integration is unavailable.` },
              503,
            );
          }
          return handler(context, async () => {});
        },
      };
    }

    const createHandler = route.createHandler;
    return {
      ...route,
      createHandler: async (args: Parameters<typeof createHandler>[0]) => {
        const handler = await createHandler(args);
        return async (context: Parameters<typeof handler>[0]) => {
          try {
            await ensureReady();
          } catch {
            return context.json(
              { error: 'integration_unavailable', message: `${integration.id} integration is unavailable.` },
              503,
            );
          }
          return handler(context);
        };
      },
    };
  });
}

/**
 * Build the {@link IntegrationContext} handed to an integration when the
 * factory collects its capabilities (routes, workers). One shape everywhere:
 * `assembleWebApiRoutes` uses it per registration, and `MastraFactory` uses it
 * when collecting integration workers at finalize.
 */
export function buildIntegrationContext(
  deps: Pick<WebApiRoutesDeps, 'controller' | 'publicOrigin' | 'integrationStorage' | 'sourceControlStorage'> & {
    stateSigner: StateSigner;
    emitAudit?: AuditEmitter['emit'];
    domains: Pick<WebApiRoutesDeps['domains'], 'projects' | 'intake'>;
  },
  integrationId: string,
): IntegrationContext {
  return {
    baseUrl: deps.publicOrigin,
    controller: deps.controller,
    stateSigner: deps.stateSigner,
    storage: {
      generic: deps.integrationStorage.forIntegration(integrationId),
      sourceControl: deps.sourceControlStorage.forIntegration(integrationId),
      projects: deps.domains.projects,
      intake: deps.domains.intake,
    },
    ...(deps.emitAudit ? { hooks: { emitAudit: deps.emitAudit } } : {}),
  };
}

/**
 * Disabled-status stub for the well-known integration ids. The SPA polls
 * `/web/github/status` and `/web/linear/status` unconditionally, so when an
 * integration is absent (or not ready) the status contract must still hold.
 * Unknown custom ids get no stub — the SPA doesn't poll them.
 */
function disabledIntegrationStatusRoutes(id: string): ApiRoute[] {
  if (id === 'github') {
    return [
      registerApiRoute('/web/github/status', {
        method: 'GET',
        requiresAuth: false,
        handler: c =>
          c.json({
            enabled: false,
            connected: false,
            installations: [],
            reason: 'missing_config',
            diagnostics: getGithubFeatureDiagnostics(),
          }),
      }),
    ];
  }
  if (id === 'linear') {
    return [
      registerApiRoute('/web/linear/status', {
        method: 'GET',
        requiresAuth: false,
        handler: c =>
          c.json({
            enabled: false,
            connected: false,
            workspace: null,
            reason: 'missing_config',
            diagnostics: getLinearFeatureDiagnostics(),
          }),
      }),
    ];
  }
  return [];
}

/**
 * Assemble the custom `/web/*` API routes as Mastra `server.apiRoutes`:
 *   - fs browser routes (project picker), confined to `fsRoot`
 *   - config routes (provider/API-key/model-pack/OM management)
 *   - every registered integration's `routes()` surface (full set when ready,
 *     disabled-status stub otherwise), plus stubs for absent known ids
 */
export function assembleWebApiRoutes(deps: WebApiRoutesDeps): ApiRoute[] {
  const emitAudit: AuditEmitter['emit'] = args => deps.audit.emit(args);
  const registrations = deps.integrations ?? [];
  const githubRegistration = registrations.find(({ integration }) => integration.id === 'github');
  const githubStorage = githubRegistration ? deps.sourceControlStorage.forIntegration('github') : undefined;
  const integrationRoutes = registrations.flatMap(registration => {
    const { integration } = registration;
    if (!deps.stateSigner) return disabledIntegrationStatusRoutes(integration.id);
    const context = buildIntegrationContext({ ...deps, stateSigner: deps.stateSigner, emitAudit }, integration.id);
    return guardIntegrationRoutes({ ...registration, routes: integration.routes(context) });
  });
  // Absent known integrations still get their disabled-status stub.
  const absentStubs = ['github', 'linear']
    .filter(id => !registrations.some(({ integration }) => integration.id === id))
    .flatMap(disabledIntegrationStatusRoutes);

  return [
    ...buildFsRoutes({ root: deps.fsRoot }),
    ...new ConfigRoutes({
      auth: factoryRouteAuth,
      controller: deps.controller,
      authStorage: deps.authStorage,
      modelCredentials: deps.domains.modelCredentials,
      modelPacks: deps.domains.modelPacks,
      onCredentialsChanged: invalidateTenantCredentialSnapshots,
    }).routes(),
    ...new OAuthRoutes({
      auth: factoryRouteAuth,
      authStorage: deps.authStorage,
      modelCredentials: deps.domains.modelCredentials,
      onCredentialsChanged: invalidateTenantCredentialSnapshots,
    }).routes(),
    ...buildSkillRoutes({
      controllerId: deps.controllerId,
      controller: deps.controller,
      sourceControlStorage: githubStorage,
      ensureSourceControlReady: githubRegistration?.ensureReady,
    }),
    ...integrationRoutes,
    ...absentStubs,
    ...(deps.intakeReady
      ? new IntakeRoutes({
          auth: factoryRouteAuth,
          audit: deps.audit,
          intake: deps.domains.intake,
          integrations: (deps.integrations ?? []).flatMap(({ integration }) =>
            integration.intake ? [{ id: integration.id, intake: integration.intake }] : [],
          ),
        }).routes()
      : []),
    ...(deps.factoryReady
      ? new WorkItemRoutes({
          auth: factoryRouteAuth,
          audit: deps.audit,
          projects: deps.domains.projects,
          workItems: deps.domains.workItems,
          queueHealth: deps.domains.queueHealth,
        }).routes()
      : []),
  ];
}
