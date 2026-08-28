import type { RequestContext } from '@mastra/core/request-context';

import { OBSERVATIONAL_MEMORY_DEFAULTS } from '../constants';
import { ModelByInputTokens } from '../model-by-input-tokens';
import type { ObservationalMemoryModel, ReflectionCommittedContext } from '../types';
import type { ResolvedSubconsciousAgent, SubconsciousModel } from './types';

/**
 * Normalize an observational memory model config into something an Agent can consume directly.
 * Returns undefined when the OM model cannot stand alone: the 'default' sentinel and
 * token-routed models (ModelByInputTokens) both require engine context to resolve.
 */
export function usableObservationalMemoryModel(
  model: ObservationalMemoryModel | undefined,
): SubconsciousModel | undefined {
  if (!model || model === 'default') return undefined;
  if (model instanceof ModelByInputTokens) return undefined;
  if (Array.isArray(model)) return model[0]?.model as SubconsciousModel | undefined;
  if (typeof model === 'function') {
    return (async (ctx: unknown) => {
      const result = await (model as (ctx: unknown) => Promise<unknown> | unknown)(ctx);
      return Array.isArray(result) ? (result[0]?.model ?? result) : result;
    }) as SubconsciousModel;
  }
  return model as SubconsciousModel;
}

/**
 * Resolve the model the reminder conversation runs on, preserving configured failover. A
 * configured reminder-agent model wins, followed by an Agent-compatible observational-memory
 * model and the source Agent model. Token-routed observational-memory configuration is unavailable
 * here because its complete persisted conversation and tool context are not available to resolve it.
 */
export async function resolveReminderConversationModel(options: {
  config: ResolvedSubconsciousAgent;
  omModel?: ObservationalMemoryModel;
  mainAgent?: ReflectionCommittedContext['mainAgent'];
  requestContext?: RequestContext;
}): Promise<SubconsciousModel | undefined> {
  const { config, omModel, mainAgent, requestContext } = options;
  if (config.model) {
    // A per-agent model is an AgentConfig['model'] form already — hand it to the Agent whole
    // so arrays keep their failover order and dynamic functions resolve at run time.
    return config.model;
  }
  if (omModel && omModel !== 'default' && !(omModel instanceof ModelByInputTokens)) {
    return omModel as SubconsciousModel;
  }
  if (mainAgent) return (await mainAgent.getModel({ requestContext })) as SubconsciousModel;
  if (omModel instanceof ModelByInputTokens) return undefined;
  if (omModel === 'default') {
    return OBSERVATIONAL_MEMORY_DEFAULTS.observation.model as SubconsciousModel;
  }
  return undefined;
}

/**
 * Resolve the model a subconscious agent runs on. Precedence: the per-agent config model,
 * then the observational memory model, then the main agent's model. Returns undefined when
 * no source is available so callers keep their existing throw/silent-return behavior.
 */
export async function resolveSubconsciousAgentModel(options: {
  config: ResolvedSubconsciousAgent;
  omModel?: ObservationalMemoryModel;
  mainAgent?: ReflectionCommittedContext['mainAgent'];
  requestContext?: RequestContext;
}): Promise<SubconsciousModel | undefined> {
  const { config, omModel, mainAgent, requestContext } = options;
  if (config.model) {
    if (mainAgent) {
      return (await mainAgent.getModel({ requestContext, modelConfig: config.model })) as SubconsciousModel;
    }
    return config.model;
  }
  const fromOm = usableObservationalMemoryModel(omModel);
  if (fromOm) return fromOm;
  if (mainAgent) return (await mainAgent.getModel({ requestContext })) as SubconsciousModel;
  return lastResortObservationalMemoryModel(omModel);
}

/**
 * Resolve OM model forms for one-shot subconscious extractors when no better source exists.
 * Reminder conversations do not use this fallback because their persisted transcript and tools
 * make an immediate-text token estimate incomplete.
 */
function lastResortObservationalMemoryModel(
  model: ObservationalMemoryModel | undefined,
): SubconsciousModel | undefined {
  if (model === 'default') {
    return OBSERVATIONAL_MEMORY_DEFAULTS.observation.model as SubconsciousModel;
  }
  if (model instanceof ModelByInputTokens) {
    const smallestTier = model.getThresholds()[0]!;
    const resolved = model.resolve(smallestTier);
    return Array.isArray(resolved)
      ? (resolved[0]?.model as SubconsciousModel | undefined)
      : (resolved as SubconsciousModel);
  }
  return undefined;
}
