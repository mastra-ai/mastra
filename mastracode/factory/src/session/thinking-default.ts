import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import { DEFAULT_THINKING_LEVEL } from '../default-thinking-level.js';
import { UUID_PATTERN } from '../routes/contracts.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
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

/** A session's unpicked thinking level: the level of the defaults set it routes to; unsigned requests get the Factory's. */
export async function resolveFactoryThinkingLevel(
  requestContext: RequestContext | undefined,
  deps: FactoryThinkingDefaultDependencies,
): Promise<ThinkingLevelSetting> {
  if (!requestContext) return DEFAULT_THINKING_LEVEL;
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  if (!controller) return DEFAULT_THINKING_LEVEL;
  try {
    const policy = await resolveFactoryModelPolicy(requestContext, deps);
    if (policy && policy.tenant.credentialScope !== 'factory') {
      const personalDefaults = await routedPersonalDefaults(policy.tenant, deps.modelDefaults).catch(error => {
        console.warn('[factory] Could not read the personal thinking default; using medium.', error);
        return null;
      });
      return personalDefaults?.thinkingLevel ?? DEFAULT_THINKING_LEVEL;
    }
    const factoryProjectId = policy
      ? (policy.factoryProjectId ?? sessionlessFactoryProjectId(controller))
      : await unsignedFactoryProjectId(controller, deps);
    const project = factoryProjectId ? await deps.projects.getById({ id: factoryProjectId }) : null;
    return project?.defaultThinkingLevel ?? DEFAULT_THINKING_LEVEL;
  } catch (error) {
    // A missed lookup costs reasoning depth, not the run.
    console.warn('[factory] Could not read the thinking default; using medium.', error);
    return DEFAULT_THINKING_LEVEL;
  }
}
