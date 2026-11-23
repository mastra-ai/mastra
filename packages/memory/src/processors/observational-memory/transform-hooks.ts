import type { MastraDBMessage } from '@mastra/core/agent';
import { clearTokenEstimates, clearTokenEstimatesInPlace } from './core-token-estimates';
import { omDebug } from './debug';
import type { ObserveHookContext, ObserveTransformHooks } from './types';

function messageParts(message: MastraDBMessage): unknown[] {
  const parts = (message.content as { parts?: unknown } | undefined)?.parts;
  return Array.isArray(parts) ? parts : [];
}

/** The hook's messages with every part's stored token counts removed, so the observer recounts them. */
function withoutTokenEstimates(messages: MastraDBMessage[]): MastraDBMessage[] {
  return messages.map(message => {
    const parts = (message.content as { parts?: unknown } | undefined)?.parts;
    if (!Array.isArray(parts)) return message;
    return { ...message, content: { ...message.content, parts: parts.map(part => clearTokenEstimates(part)) } };
  });
}

/**
 * Run the `beforeObservation` transform hook. Returns the (possibly replaced)
 * message array; `undefined` from the hook means passthrough.
 *
 * The hook receives the messages themselves. Before it runs, their stored token counts are cleared,
 * so whatever the hook returns or edits in place is counted again, never read from storage.
 */
export async function applyBeforeObservation(
  hooks: ObserveTransformHooks | undefined,
  messages: MastraDBMessage[],
  context: ObserveHookContext,
): Promise<MastraDBMessage[]> {
  if (!hooks?.beforeObservation) return messages;
  for (const message of messages) {
    for (const part of messageParts(message)) clearTokenEstimatesInPlace(part);
  }
  const result = await hooks.beforeObservation({ ...context, messages });
  if (!result) return withoutTokenEstimates(messages);
  omDebug(`[OM:hooks] beforeObservation replaced messages: ${messages.length} -> ${result.messages.length}`);
  return withoutTokenEstimates(result.messages);
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
