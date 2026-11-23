import type { MastraDBMessage } from '@mastra/core/agent';
import { clearTokenEstimates, clearTokenEstimatesInPlace } from './core-token-estimates';
import { omDebug } from './debug';
import { detachMessagePayload } from './detach-message-payload';
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
 * The hook gets detached copies (Buffers stay Buffers), so editing them in place changes only what
 * the observer sees. Before it runs, the originals' stored token counts are cleared: an object the
 * hook receives by reference can still reach an original part, and that part must be recounted.
 * Whatever the hook leaves (returned or edited copies) is counted again, never read from storage.
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
  const detached = detachMessagePayload(messages);
  const result = await hooks.beforeObservation({ ...context, messages: detached });
  if (!result) return withoutTokenEstimates(detached);
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
