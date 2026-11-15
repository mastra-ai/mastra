import { createHash } from 'node:crypto';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { toolDefinitions } from './fixed-prompt-cost';
import type { ProviderAddedSource } from './fixed-prompt-cost';
import type { TokenCounter } from './token-counter';

export type ContextRequest = {
  step: number;
  model: string;
  parts: string[];
  system: string;
  /** Everything in the request that is not message content: system messages plus the provider-added prompt. */
  fixedTokens: number;
  systemTokens: number;
  /** Local estimate of the tool definitions; used only until the provider-added prompt is measured. */
  toolTokens: number;
  /** Identifies the provider-added prompt; see providerAddedKey. */
  providerAddedKey: string;
  providerAddedSource: ProviderAddedSource;
};

export type ContextUsageAnchor = {
  request: ContextRequest;
  inputTokens: number;
  outputTokens: number;
  outputEstimate: number;
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

/**
 * Estimate what the tool definitions add to a request. They are sent on every call and are
 * not message content, so they must not count against the message budget.
 */
export function countToolDefinitionTokens(
  tools: Record<string, unknown> | undefined,
  activeTools: string[] | undefined,
  counter: TokenCounter,
): number {
  if (!tools) return 0;
  try {
    return counter.countString(JSON.stringify(toolDefinitions(tools, activeTools)));
  } catch {
    // Pressure is a safeguard; an unserializable tool must not stop the run.
    return 0;
  }
}

export function snapshotContextRequest(
  messageList: MessageList,
  step: number,
  model: string,
  counter: TokenCounter,
  toolTokens = 0,
  providerAddedKey = '',
): ContextRequest {
  // Tagged system messages (e.g. the observations block) are part of the prompt the provider
  // counts, so they belong to the overhead as well as to the invalidation hash.
  const system = messageList.getAllSystemMessages();
  const systemTokens = counter.countString(JSON.stringify(system));
  return {
    step,
    model,
    parts: parts(messageList.get.all.db()),
    system: hash(system),
    // Keep full-prompt pressure separate from the unobserved-message budget.
    fixedTokens: systemTokens + toolTokens,
    systemTokens,
    toolTokens,
    providerAddedKey,
    providerAddedSource: 'estimate',
  };
}

/**
 * Message-only pressure: the provider-reported size of the anchored request and its output,
 * minus the system and tool overhead measured with that request, plus what was added since.
 */
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
  return Math.max(
    0,
    anchor.inputTokens -
      anchor.request.fixedTokens +
      anchor.outputTokens +
      Math.max(0, currentEstimate - anchor.outputEstimate),
  );
}
