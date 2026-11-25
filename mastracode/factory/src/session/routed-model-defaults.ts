import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import { DEFAULT_THINKING_LEVEL } from '../default-thinking-level.js';
import {
  EMPTY_MODEL_PACK_SET,
  FACTORY_MODEL_SELECTION_SETTING,
  parseStoredModelSelection,
  resolveModelSelection,
} from '../model-packs.js';
import type { ModelPackModel, ModelPackSet, StoredModelSelection } from '../model-packs.js';
import { UUID_PATTERN } from '../routes/contracts.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import { resolveFactoryModelPolicy, routedPersonalDefaults } from './credential-policy.js';
import type { FactoryModelPolicyDependencies } from './credential-policy.js';

const FACTORY_PROJECT_ID = new RegExp(UUID_PATTERN);

export interface RoutedModelDefaultsDependencies extends FactoryModelPolicyDependencies {
  modelDefaults: Pick<ModelDefaultsStorage, 'ensureReady' | 'get'>;
}

export interface RoutedModelDefaults {
  thinkingLevel: ThinkingLevelSetting;
  modelPackSet: ModelPackSet;
}

const UNROUTED_DEFAULTS: RoutedModelDefaults = {
  thinkingLevel: DEFAULT_THINKING_LEVEL,
  modelPackSet: EMPTY_MODEL_PACK_SET,
};
const readPerRequest = new WeakMap<RequestContext, Promise<RoutedModelDefaults>>();

function sessionlessFactoryProjectId(controller: AgentControllerRequestContext): string | undefined {
  const stateProjectId = (controller.getState?.() as { factoryProjectId?: unknown } | undefined)?.factoryProjectId;
  if (typeof stateProjectId === 'string' && stateProjectId) return stateProjectId;
  // Session-less Factory pages address the Factory itself: the resourceId is the project id.
  const { resourceId } = controller;
  return resourceId && FACTORY_PROJECT_ID.test(resourceId) ? resourceId : undefined;
}

async function unsignedFactoryProjectId(
  controller: AgentControllerRequestContext,
  deps: RoutedModelDefaultsDependencies,
): Promise<string | undefined> {
  const sourceSession = controller.sessionId ? await deps.sourceControl.getBySessionId(controller.sessionId) : null;
  return sourceSession?.factoryProjectId ?? sessionlessFactoryProjectId(controller);
}

export async function resolveRoutedModelDefaults(
  requestContext: RequestContext | undefined,
  deps: RoutedModelDefaultsDependencies,
): Promise<RoutedModelDefaults> {
  if (!requestContext) return UNROUTED_DEFAULTS;
  const read = readPerRequest.get(requestContext);
  if (read) return read;
  const reading = readRoutedModelDefaults(requestContext, deps);
  readPerRequest.set(requestContext, reading);
  return reading;
}

async function readRoutedModelDefaults(
  requestContext: RequestContext,
  deps: RoutedModelDefaultsDependencies,
): Promise<RoutedModelDefaults> {
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  if (!controller) return UNROUTED_DEFAULTS;
  try {
    const policy = await resolveFactoryModelPolicy(requestContext, deps);
    if (policy && policy.tenant.credentialScope !== 'factory') {
      const personalDefaults = await routedPersonalDefaults(policy.tenant, deps.modelDefaults).catch(error => {
        console.warn('[factory] Could not read the personal model defaults; using medium and no model packs.', error);
        return null;
      });
      return {
        thinkingLevel: personalDefaults?.thinkingLevel ?? DEFAULT_THINKING_LEVEL,
        modelPackSet: personalDefaults
          ? { modelPacks: personalDefaults.modelPacks, defaultModelPackId: personalDefaults.defaultModelPackId }
          : EMPTY_MODEL_PACK_SET,
      };
    }
    const factoryProjectId = policy
      ? (policy.factoryProjectId ?? sessionlessFactoryProjectId(controller))
      : await unsignedFactoryProjectId(controller, deps);
    const project = factoryProjectId ? await deps.projects.getById({ id: factoryProjectId }) : null;
    return project
      ? {
          thinkingLevel: project.defaultThinkingLevel,
          modelPackSet: { modelPacks: project.modelPacks, defaultModelPackId: project.defaultModelPackId },
        }
      : UNROUTED_DEFAULTS;
  } catch (error) {
    console.warn('[factory] Could not read the model defaults; using medium and no model packs.', error);
    return UNROUTED_DEFAULTS;
  }
}

async function stampModelSelection(
  controller: AgentControllerRequestContext,
  value: StoredModelSelection,
): Promise<void> {
  try {
    await controller.setThreadSetting?.({ key: FACTORY_MODEL_SELECTION_SETTING, value });
  } catch (error) {
    console.warn('[factory] Could not record the session model selection.', error);
  }
}

export async function resolveSessionModelRoute(
  requestContext: RequestContext | undefined,
  deps: RoutedModelDefaultsDependencies,
): Promise<ModelPackModel[]> {
  const controller = requestContext?.get('controller') as AgentControllerRequestContext | undefined;
  if (!controller) return [];
  const stored = parseStoredModelSelection(await controller.getThreadSetting?.(FACTORY_MODEL_SELECTION_SETTING));
  const { modelPackSet } = await resolveRoutedModelDefaults(requestContext, deps);
  const pack = resolveModelSelection(modelPackSet, stored, controller.session?.modelId);
  if (!stored && modelPackSet.modelPacks.length > 0) {
    await stampModelSelection(controller, pack ? { kind: 'default' } : { kind: 'model' });
  }
  return pack?.models ?? [];
}
