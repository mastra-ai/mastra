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

import type { BoardRegistry } from '../boards/index.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { runFactoryHealthCheck } from '../supervisor/health.js';
import { supervisorResourceId, supervisorThreadId } from '../supervisor/session.js';

interface SupervisorRouteDependencies {
  workItems: WorkItemsStorage;
  boards: BoardRegistry;
  resolveProject(
    context: unknown,
  ): Promise<{ orgId: string; userId: string; factoryProjectId: string } | { response: Response }>;
}

export function buildSupervisorRoutes(dependencies: SupervisorRouteDependencies): ApiRoute[] {
  const { workItems, boards } = dependencies;
  return [
    // The session is addressed deterministically and created lazily by the
    // agent controller on first reach (see hydrateSupervisorSession), so
    // "ensure" only has to hand back the address once ownership is verified.
    registerApiRoute('/web/factory/projects/:id/supervisor/session', {
      method: 'POST',
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
    registerApiRoute('/web/factory/projects/:id/supervisor/health', {
      method: 'GET',
      requiresAuth: false,
      handler: async context => {
        const resolved = await dependencies.resolveProject(context);
        if ('response' in resolved) return resolved.response;
        await workItems.ensureReady();
        const report = await runFactoryHealthCheck(workItems, boards, resolved);
        return context.json(report);
      },
    }),
  ];
}
