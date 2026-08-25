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
      return Array.isArray(result) ? (result[0]?.model ?? 'unknown') : result;
    }) as SubconsciousModel;
  }
  return model as SubconsciousModel;
}

/**
 * Resolve the model the reminder lane runs on, preserving configured failover. Unlike
 * {@link resolveSubconsciousAgentModel}, retry/fallback arrays pass through unchanged (the
 * Agent materializes failover itself), and a token-routed model resolves against an estimate
 * of this turn's instructions and prompt instead of always taking the smallest tier. The
 * estimate deliberately excludes lane history and tool schemas (both live inside the Agent at
 * run time), so routing skews small on long-lived lanes; past the largest threshold the tier
 * clamps to the largest rather than throwing.
 */
export async function resolveReminderLaneModel(options: {
  config: ResolvedSubconsciousAgent;
  omModel?: ObservationalMemoryModel;
  mainAgent?: ReflectionCommittedContext['mainAgent'];
  requestContext?: RequestContext;
  /** Estimated input tokens for the turn about to run (chars/4 of the assembled text). */
  estimatedInputTokens: number;
}): Promise<SubconsciousModel | undefined> {
  const { config, omModel, mainAgent, requestContext, estimatedInputTokens } = options;
  if (config.model) {
    // A per-agent model is an AgentConfig['model'] form already — hand it to the Agent whole
    // so arrays keep their failover order and dynamic functions resolve at run time.
    return config.model;
  }
  if (omModel && omModel !== 'default' && !(omModel instanceof ModelByInputTokens)) {
    return omModel as SubconsciousModel;
  }
  if (omModel instanceof ModelByInputTokens) {
    // `resolve` picks the tier for the given input size and may return a fallback array;
    // return it unreduced. Past the largest threshold `resolve` throws — clamp to the largest
    // tier instead: an oversized reminder turn should degrade, not fail the observation cycle.
    const thresholds = omModel.getThresholds();
    // `thresholds` is non-empty by construction (the ModelByInputTokens constructor rejects an
    // empty config), so the last entry is always the largest tier.
    const clamped = Math.min(estimatedInputTokens, thresholds[thresholds.length - 1]!);
    return omModel.resolve(clamped) as SubconsciousModel;
  }
  if (mainAgent) return (await mainAgent.getModel({ requestContext })) as SubconsciousModel;
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
 * Resolve the OM model forms that cannot stand alone, used only when no better source exists
 * (no per-agent model, no main agent). The 'default' sentinel maps to the observational memory
 * default model, the same substitution the OM constructor makes. A token-routed model resolves
 * at its smallest tier: a subconscious agent's prompt is a question plus instructions, not a
 * transcript, so the smallest threshold is the honest input-size estimate.
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
