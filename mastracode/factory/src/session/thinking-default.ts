import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import { UUID_PATTERN } from '../routes/contracts.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import { DEFAULT_FACTORY_THINKING_LEVEL } from '../storage/domains/projects/base.js';
import { resolveFactoryModelPolicy, routedPersonalDefaults } from './credential-policy.js';
import type { FactoryModelPolicyDependencies } from './credential-policy.js';

const FACTORY_PROJECT_ID = new RegExp(UUID_PATTERN);

interface FactoryThinkingDefaultDependencies extends FactoryModelPolicyDependencies {
  modelDefaults: Pick<ModelDefaultsStorage, 'ensureReady' | 'get'>;
}

function sessionlessFactoryProjectId(controller: AgentControllerRequestContext): string | undefined {
  const stateProjectId = (controller.getState?.() as { factoryProjectId?: unknown } | undefined)?.factoryProjectId;
  if (typeof stateProjectId === 'string' && stateProjectId) return stateProjectId;
  // Session-less Factory pages address the Factory itself: the resourceId is the project id.
  const { resourceId } = controller;
  return resourceId && FACTORY_PROJECT_ID.test(resourceId) ? resourceId : undefined;
}

async function unsignedFactoryProjectId(
  controller: AgentControllerRequestContext,
  deps: FactoryThinkingDefaultDependencies,
): Promise<string | undefined> {
  const sourceSession = controller.sessionId ? await deps.sourceControl.getBySessionId(controller.sessionId) : null;
  return sourceSession?.factoryProjectId ?? sessionlessFactoryProjectId(controller);
}

/** A session's unpicked thinking level: its routed personal level, else its Factory's; unsigned requests get the Factory's. */
export async function resolveFactoryThinkingLevel(
  requestContext: RequestContext | undefined,
  deps: FactoryThinkingDefaultDependencies,
): Promise<ThinkingLevelSetting> {
  if (!requestContext) return DEFAULT_FACTORY_THINKING_LEVEL;
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  if (!controller) return DEFAULT_FACTORY_THINKING_LEVEL;
  try {
    const policy = await resolveFactoryModelPolicy(requestContext, deps);
    const factoryProjectId = policy
      ? (policy.factoryProjectId ?? sessionlessFactoryProjectId(controller))
      : await unsignedFactoryProjectId(controller, deps);
    const project = factoryProjectId ? await deps.projects.getById({ id: factoryProjectId }) : null;
    const factoryLevel = project?.defaultThinkingLevel ?? DEFAULT_FACTORY_THINKING_LEVEL;
    if (!policy) return factoryLevel;
    const personalDefaults = await routedPersonalDefaults(policy.tenant, deps.modelDefaults).catch(error => {
      console.warn('[factory] Could not read the personal thinking default; using the Factory level.', error);
      return null;
    });
    return personalDefaults?.thinkingLevel ?? factoryLevel;
  } catch (error) {
    // A missed lookup costs reasoning depth, not the run.
    console.warn('[factory] Could not read the thinking default; using medium.', error);
    return DEFAULT_FACTORY_THINKING_LEVEL;
  }
}
