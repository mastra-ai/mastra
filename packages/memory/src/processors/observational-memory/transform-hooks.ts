import type { MastraDBMessage } from '@mastra/core/agent';
import { omDebug } from './debug';
import type { ObserveHookContext, ObserveTransformHooks } from './types';

/**
 * Run the `beforeObservation` transform hook. Returns the (possibly replaced)
 * message array; `undefined` from the hook means passthrough.
 */
export async function applyBeforeObservation(
  hooks: ObserveTransformHooks | undefined,
  messages: MastraDBMessage[],
  context: ObserveHookContext,
): Promise<MastraDBMessage[]> {
  if (!hooks?.beforeObservation) return messages;
  const result = await hooks.beforeObservation({ ...context, messages });
  if (!result) return messages;
  omDebug(`[OM:hooks] beforeObservation replaced messages: ${messages.length} -> ${result.messages.length}`);
  return result.messages;
}

type TextTransformHook = 'afterObservation' | 'beforeReflection' | 'afterReflection';

/**
 * Run one of the text transform hooks. Returns the (possibly replaced)
 * observation text; `undefined` from the hook means passthrough.
 */
export async function applyTextTransform(
  hooks: ObserveTransformHooks | undefined,
  name: TextTransformHook,
  observations: string,
  context: ObserveHookContext,
): Promise<string> {
  const hook = hooks?.[name];
  if (!hook) return observations;
  const result = await hook({ ...context, observations });
  if (!result) return observations;
  omDebug(`[OM:hooks] ${name} replaced observations: ${observations.length} -> ${result.observations.length} chars`);
  return result.observations;
}
