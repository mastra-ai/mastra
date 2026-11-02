import { createHash } from 'node:crypto';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat';
import type { TokenCounter } from './token-counter';

export type ContextRequest = {
  step: number;
  model: string;
  parts: string[];
  system: string;
  fixedTokens: number;
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

/** Estimate the tokens the provider charges for tool definitions, which are not message content. */
export function countToolDefinitions(tools: Record<string, unknown> | undefined, counter: TokenCounter): number {
  if (!tools) return 0;
  const definitions = Object.entries(tools).map(([name, tool]) => {
    const { description, inputSchema, parameters } = (tool ?? {}) as Record<string, any>;
    let schema: unknown;
    try {
      schema = standardSchemaToJSONSchema(inputSchema ?? parameters, { io: 'input' });
    } catch {
      // A schema we cannot serialize still costs tokens; name and description are the floor.
    }
    return { name, description, schema };
  });
  return counter.countString(JSON.stringify(definitions));
}

export function snapshotContextRequest(
  messageList: MessageList,
  step: number,
  model: string,
  counter: TokenCounter,
  toolTokens = 0,
): ContextRequest {
  // Tagged system messages hold OM's own observations; they are prompt overhead, not message pressure.
  const system = messageList.getAllSystemMessages();
  return {
    step,
    model,
    parts: parts(messageList.get.all.db()),
    system: hash(system),
    // Keep full-prompt pressure separate from the unobserved-message budget.
    fixedTokens: counter.countString(JSON.stringify(system)) + toolTokens,
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
  // Subtract the fixed overhead measured at the anchored request. System and tool tokens are
  // identical here (the system hash matched) and are not unobserved-message pressure.
  return (
    anchor.inputTokens -
    anchor.request.fixedTokens +
    anchor.outputTokens +
    Math.max(0, currentEstimate - anchor.outputEstimate)
  );
}
