import { createHash } from 'node:crypto';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import type { TokenCounter } from './token-counter';

export type ContextRequest = {
  step: number;
  model: string;
  parts: string[];
  system: string;
  /** Our estimate of the message tokens in this request (system messages and tool definitions excluded). */
  messageEstimate: number;
};

export type ContextUsageAnchor = {
  request: ContextRequest;
  inputTokens: number;
  outputTokens: number;
  outputEstimate: number;
  /**
   * Provider-measured tokens charged to everything except messages: system prompt, observations, tool
   * definitions and provider-added prompt text. Tracked as the smallest input-minus-message-estimate seen
   * in the run, so hidden growth (e.g. encrypted reasoning) is not mistaken for fixed overhead.
   */
  overheadTokens: number;
};

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function parts(messages: MastraDBMessage[]): string[] {
  return messages.flatMap(message =>
    message.content.parts
      .filter(part => part.type !== 'step-start' && !part.type.startsWith('data-'))
      .map(part => {
        // Strip only part bookkeeping, never fields inside a tool argument or result.
        const { createdAt, providerMetadata, ...content } = part;
        const payload = Object.fromEntries(Object.entries(content).filter(([key]) => key !== 'updatedAt'));
        const metadata = Object.fromEntries(Object.entries(providerMetadata ?? {}).filter(([key]) => key !== 'mastra'));
        return hash([message.id, message.role, payload, metadata]);
      }),
  );
}

export function snapshotContextRequest(
  messageList: MessageList,
  step: number,
  model: string,
  counter: TokenCounter,
): ContextRequest {
  // Tagged system messages hold OM's own observations; they are prompt overhead, not message pressure.
  const system = messageList.getAllSystemMessages();
  return {
    step,
    model,
    parts: parts(messageList.get.all.db()),
    system: hash(system),
    messageEstimate: counter.countMessages(messageList.get.all.db()),
  };
}

export function contextPressure(
  anchor: ContextUsageAnchor | undefined,
  current: ContextRequest,
  currentEstimate: number,
): number | undefined {
  if (
    !anchor ||
    anchor.request.step + 1 !== current.step ||
    anchor.request.model !== current.model ||
    anchor.request.system !== current.system ||
    !anchor.request.parts.every((part, i) => current.parts[i] === part)
  )
    return undefined;
  // Output usage already includes reasoning; cached input is already in inputTokens.
  // Only additions after output-step (tool results, new signals) are estimated.
  // Subtract the measured non-message overhead (system, observations, tool definitions); it is not
  // unobserved-message pressure.
  return (
    anchor.inputTokens -
    anchor.overheadTokens +
    anchor.outputTokens +
    Math.max(0, currentEstimate - anchor.outputEstimate)
  );
}

export type OverheadBasis = { system: string; model: string; tokens: number };

/**
 * Track the provider-charged non-message overhead as the smallest input-minus-message-estimate seen
 * while the system prompt and model are unchanged. A new system prompt (e.g. after an observation
 * rollover) or model starts over from this request, so a stale low floor cannot understate pressure.
 */
export function nextOverhead(
  previous: OverheadBasis | undefined,
  request: ContextRequest,
  inputTokens: number,
): OverheadBasis {
  const residual = Math.max(0, inputTokens - request.messageEstimate);
  const sameBasis = previous?.system === request.system && previous.model === request.model;
  return {
    system: request.system,
    model: request.model,
    tokens: sameBasis ? Math.min(previous.tokens, residual) : residual,
  };
}
