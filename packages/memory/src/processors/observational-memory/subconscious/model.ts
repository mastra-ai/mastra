import type { RequestContext } from '@mastra/core/request-context';

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
  return undefined;
}
