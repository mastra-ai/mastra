import { createHash } from 'node:crypto';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '@mastra/core/schema';
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
    const definitions = Object.entries(tools)
      .filter(([name]) => !activeTools || activeTools.includes(name))
      .map(([name, tool]) => {
        const { description, inputSchema, parameters } = (tool ?? {}) as Record<string, unknown>;
        const schema = inputSchema ?? parameters;
        const jsonSchema = isStandardSchemaWithJSON(schema)
          ? standardSchemaToJSONSchema(schema, { io: 'input' })
          : ((schema as { jsonSchema?: unknown } | undefined)?.jsonSchema ?? schema);
        return { name, description, parameters: jsonSchema };
      });
    return counter.countString(JSON.stringify(definitions));
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
): ContextRequest {
  // Tagged system messages (e.g. the observations block) are part of the prompt the provider
  // counts, so they belong to the overhead as well as to the invalidation hash.
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
