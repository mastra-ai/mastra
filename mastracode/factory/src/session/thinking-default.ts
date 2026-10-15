import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import { UUID_PATTERN } from '../routes/contracts.js';
import { DEFAULT_FACTORY_THINKING_LEVEL } from '../storage/domains/projects/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlSessionLookup } from './factory-session.js';

const FACTORY_PROJECT_ID = new RegExp(UUID_PATTERN);

interface FactoryThinkingDefaultDependencies {
  projects: Pick<FactoryProjectsStorage, 'getById'>;
  sourceControl: Pick<SourceControlSessionLookup, 'getBySessionId'>;
}

async function resolveFactoryProjectId(
  controller: AgentControllerRequestContext,
  deps: FactoryThinkingDefaultDependencies,
): Promise<string | undefined> {
  const resourceId = controller.resourceId;
  if (!resourceId) return undefined;
  const sourceSession = await deps.sourceControl.getBySessionId(resourceId);
  if (sourceSession?.factoryProjectId) return sourceSession.factoryProjectId;
  const stateProjectId = (controller.getState?.() as { factoryProjectId?: unknown } | undefined)?.factoryProjectId;
  if (typeof stateProjectId === 'string' && stateProjectId) return stateProjectId;
  // Session-less Factory pages address the Factory itself: the resourceId is the project id.
  return FACTORY_PROJECT_ID.test(resourceId) ? resourceId : undefined;
}

/**
 * The thinking level a Factory request uses when its session has not picked
 * one: the default stored on the session's Factory. Requests outside any
 * Factory get the built-in default; the host's settings.json never applies.
 */
export async function resolveFactoryThinkingLevel(
  requestContext: RequestContext,
  deps: FactoryThinkingDefaultDependencies,
): Promise<ThinkingLevelSetting> {
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  if (!controller) return DEFAULT_FACTORY_THINKING_LEVEL;
  try {
    const projectId = await resolveFactoryProjectId(controller, deps);
    if (!projectId) return DEFAULT_FACTORY_THINKING_LEVEL;
    const project = await deps.projects.getById({ id: projectId });
    return project?.defaultThinkingLevel ?? DEFAULT_FACTORY_THINKING_LEVEL;
  } catch (error) {
    // A missed lookup costs reasoning depth, not the run.
    console.warn('[factory] Could not read the Factory thinking default; using off.', error);
    return DEFAULT_FACTORY_THINKING_LEVEL;
  }
}
