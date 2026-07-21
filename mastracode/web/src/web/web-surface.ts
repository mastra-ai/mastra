import type { AgentController } from '@mastra/core/agent-controller';
import type { ApiRoute } from '@mastra/core/server';

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import type { MastraCodeState } from '@mastra/code-sdk/schema';

import type { AuditEmitter } from './audit/domain.js';
import { buildConfigRoutes } from './config-routes.js';
import type { FactoryIntegration } from './factory-integration.js';
import { buildFactoryRoutes } from './factory/routes.js';
import { buildFsRoutes } from './fs-routes.js';
import { buildIntakeRoutes } from './intake/routes.js';
import { buildOAuthRoutes } from './oauth-routes.js';
import { registerSandboxReattach } from './sandbox-reattach-registration.js';
import { buildSkillRoutes } from './skills/routes.js';
import type { StateSigner } from './state-signing.js';
import type { IntegrationStorage } from './storage/domains/integrations/base.js';
import type { SourceControlStorage } from './storage/domains/source-control/base.js';

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

export function assembleWebApiRoutes(deps: WebApiRoutesDeps): ApiRoute[] {
  const emitAudit: AuditEmitter['emit'] = args => deps.audit.emit(args);
  const integrationRoutes = (deps.integrations ?? []).flatMap(registration => {
    const { integration } = registration;
    const context = {
      baseUrl: deps.publicOrigin,
      controller: deps.controller,
      stateSigner: deps.stateSigner,
      storage: {
        generic: deps.integrationStorage.forIntegration(integration.id),
        sourceControl: deps.sourceControlStorage.forIntegration(integration.id),
      },
      hooks: { emitAudit },
    };
    return guardIntegrationRoutes({ ...registration, routes: integration.routes(context) });
  });

  return [
    ...buildFsRoutes({ root: deps.fsRoot }),
    ...buildConfigRoutes({ controller: deps.controller, authStorage: deps.authStorage }),
    ...buildOAuthRoutes({ authStorage: deps.authStorage }),
    ...buildSkillRoutes({ controllerId: deps.controllerId, controller: deps.controller }),
    ...integrationRoutes,
    ...(deps.intakeReady
      ? buildIntakeRoutes({
          audit: deps.audit,
          integrations: (deps.integrations ?? []).flatMap(({ integration }) =>
            integration.intake ? [{ id: integration.id, intake: integration.intake }] : [],
          ),
        })
      : []),
    ...(deps.factoryReady ? buildFactoryRoutes({ audit: deps.audit }) : []),
  ];
}
