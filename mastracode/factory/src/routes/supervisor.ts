/**
 * Supervisor routes: the per-factory supervisor session address and the
 * deterministic health check the supervisor page pins above its transcript.
 *
 * Mounted from {@link WorkItemRoutes} so they share its tenant + project
 * resolution: a caller can only address a supervisor for a project their org
 * owns.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { runFactoryHealthCheck } from '../supervisor/health.js';
import { supervisorResourceId, supervisorThreadId } from '../supervisor/session.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';

interface SupervisorRouteDependencies {
  workItems: WorkItemsStorage;
  resolveProject(
    context: unknown,
  ): Promise<{ orgId: string; userId: string; factoryProjectId: string } | { response: Response }>;
}

export function buildSupervisorRoutes(dependencies: SupervisorRouteDependencies): ApiRoute[] {
  const { workItems } = dependencies;
  return [
    // The session is addressed deterministically and created lazily by the
    // agent controller on first reach (see hydrateSupervisorSession), so
    // "ensure" only has to hand back the address once ownership is verified.
    registerApiRoute(FACTORY_ROUTE_CONTRACTS.supervisorSession.path, {
      method: FACTORY_ROUTE_CONTRACTS.supervisorSession.method,
      requiresAuth: false,
      handler: async context => {
        const resolved = await dependencies.resolveProject(context);
        if ('response' in resolved) return resolved.response;
        return context.json({
          sessionId: supervisorResourceId(resolved.factoryProjectId),
          threadId: supervisorThreadId(resolved.factoryProjectId),
          factoryProjectId: resolved.factoryProjectId,
        });
      },
    }),
    registerApiRoute(FACTORY_ROUTE_CONTRACTS.supervisorHealth.path, {
      method: FACTORY_ROUTE_CONTRACTS.supervisorHealth.method,
      requiresAuth: false,
      handler: async context => {
        const resolved = await dependencies.resolveProject(context);
        if ('response' in resolved) return resolved.response;
        await workItems.ensureReady();
        const report = await runFactoryHealthCheck(workItems, resolved);
        return context.json(report);
      },
    }),
  ];
}
