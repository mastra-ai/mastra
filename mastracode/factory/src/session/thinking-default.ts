import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import { UUID_PATTERN } from '../routes/contracts.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import { DEFAULT_FACTORY_THINKING_LEVEL, effectiveModelScope } from '../storage/domains/projects/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { SourceControlSessionLookup } from './factory-session.js';

const FACTORY_PROJECT_ID = new RegExp(UUID_PATTERN);

interface FactoryThinkingDefaultDependencies {
  projects: Pick<FactoryProjectsStorage, 'getById'>;
  sourceControl: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  workItems: Pick<WorkItemsStorage, 'findRunBindingByThread'>;
  modelDefaults: Pick<ModelDefaultsStorage, 'get'>;
}

function sessionlessFactoryProjectId(controller: AgentControllerRequestContext): string | undefined {
  const stateProjectId = (controller.getState?.() as { factoryProjectId?: unknown } | undefined)?.factoryProjectId;
  if (typeof stateProjectId === 'string' && stateProjectId) return stateProjectId;
  // Session-less Factory pages address the Factory itself: the resourceId is the project id.
  const { resourceId } = controller;
  return resourceId && FACTORY_PROJECT_ID.test(resourceId) ? resourceId : undefined;
}

/**
 * The thinking level a Factory request uses when its session has not picked
 * one: the level of the defaults set its model comes from — the owner's
 * personal level on personal routing, falling back to the Factory's.
 */
export async function resolveFactoryThinkingLevel(
  requestContext: RequestContext | undefined,
  deps: FactoryThinkingDefaultDependencies,
): Promise<ThinkingLevelSetting> {
  const controller = requestContext?.get('controller') as AgentControllerRequestContext | undefined;
  if (!controller) return DEFAULT_FACTORY_THINKING_LEVEL;
  const { sessionId, resourceId, threadId } = controller;
  try {
    const sourceSession = sessionId ? await deps.sourceControl.getBySessionId(sessionId) : null;
    if (!sourceSession?.factoryProjectId) {
      const projectId = sessionlessFactoryProjectId(controller);
      const project = projectId ? await deps.projects.getById({ id: projectId }) : null;
      return project?.defaultThinkingLevel ?? DEFAULT_FACTORY_THINKING_LEVEL;
    }
    const binding =
      threadId && resourceId
        ? await deps.workItems.findRunBindingByThread({
            orgId: sourceSession.orgId,
            threadId,
            resourceId,
            sessionId,
            rejectAmbiguous: true,
          })
        : null;
    const project = await deps.projects.getById({ id: binding?.factoryProjectId ?? sourceSession.factoryProjectId });
    if (!project || project.orgId !== sourceSession.orgId) return DEFAULT_FACTORY_THINKING_LEVEL;
    if (effectiveModelScope(project.modelScope, binding ? 'run' : 'session') === 'factory') {
      return project.defaultThinkingLevel;
    }
    const ownerDefaults = await deps.modelDefaults.get({ orgId: sourceSession.orgId, userId: sourceSession.userId });
    return ownerDefaults?.thinkingLevel ?? project.defaultThinkingLevel;
  } catch (error) {
    // A missed lookup costs reasoning depth, not the run.
    console.warn('[factory] Could not read the thinking default; using medium.', error);
    return DEFAULT_FACTORY_THINKING_LEVEL;
  }
}
