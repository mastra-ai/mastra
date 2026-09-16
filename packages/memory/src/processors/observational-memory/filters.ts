import type { MastraDBMessage } from '@mastra/core/agent';

import type { ObserveTransformHooks } from './types';

type MessagePart = MastraDBMessage['content']['parts'][number];

type ToolInvocationPart = Extract<MessagePart, { type: 'tool-invocation' }>;

type BeforeObservationHook = NonNullable<ObserveTransformHooks['beforeObservation']>;

/**
 * Tool ids of the built-in Agent Skills tools created by `createSkillTools()`
 * in `@mastra/core` (`packages/core/src/workspace/skills/tools.ts`).
 */
export const SKILL_TOOL_NAMES = ['skill', 'skill_search', 'skill_read'] as const;

/**
 * A `beforeObservation` filter: a hook that only transforms messages. It
 * receives the messages about to be sent to the Observer and returns
 * `{ messages }` to replace them, or `undefined` to pass the payload through
 * unchanged.
 */
export type ObserverMessageFilter = (
  ...args: Parameters<BeforeObservationHook>
) => { messages: MastraDBMessage[] } | undefined;

export interface SkillResultFilterOptions {
  /**
   * Tool names whose results are redacted. Defaults to
   * {@link SKILL_TOOL_NAMES}.
   */
  toolNames?: readonly string[];
}

/**
 * Written in place of a redacted tool result. The Observer still records the
 * call and its outcome; only the payload is replaced.
 */
const REDACTED_TOOL_RESULT = '[tool result omitted]';

function isRedactableToolResult(part: MessagePart, toolNames: Set<string>): part is ToolInvocationPart {
  if (part?.type !== 'tool-invocation') return false;
  // Only `state: 'result'` parts render a `Tool Result <name>` body, so only
  // those carry the tool's output.
  if (part.toolInvocation.state !== 'result') return false;
  const toolName = part.toolInvocation.toolName;
  if (typeof toolName !== 'string' || !toolNames.has(toolName)) return false;
  // Nothing to redact when the tool returned no payload.
  return part.toolInvocation.result !== undefined || hasStoredModelOutput(part);
}

function hasStoredModelOutput(part: MessagePart): boolean {
  if (part?.type !== 'tool-invocation') return false;
  const mastra = part.providerMetadata?.mastra;
  return !!mastra && typeof mastra === 'object' && 'modelOutput' in mastra;
}

/**
 * Replace the result payload of a tool invocation with a placeholder, keeping
 * the call's identity (tool name, arguments, terminal state). The Observer
 * still records that the tool ran and what it was called with.
 */
function redactToolResult(part: ToolInvocationPart): ToolInvocationPart {
  const redacted: ToolInvocationPart = {
    ...part,
    toolInvocation: { ...part.toolInvocation, result: REDACTED_TOOL_RESULT },
  };

  // `resolveToolResultValue` prefers `providerMetadata.mastra.modelOutput` over
  // `toolInvocation.result`, so a stored model output has to be replaced too.
  // Copy rather than mutate: these message objects are shared with the stored
  // history, which keeps the full result.
  if (hasStoredModelOutput(part)) {
    const providerMetadata = part.providerMetadata ?? {};
    const mastra = providerMetadata.mastra as Record<string, unknown>;
    return {
      ...redacted,
      providerMetadata: { ...providerMetadata, mastra: { ...mastra, modelOutput: REDACTED_TOOL_RESULT } },
    };
  }

  return redacted;
}

/**
 * Build a `beforeObservation` hook that keeps Agent Skills results out of the
 * Observer payload.
 *
 * The `skill` tool returns a skill's instructions verbatim as its result, and
 * `skill_read` / `skill_search` return skill file contents, so without a filter
 * the Observer re-observes the full skill text every time a skill is used.
 * `skillResultFilter()` replaces the result payload with a placeholder and
 * leaves the tool call in place, so the Observer still records which skill was
 * used without the skill text.
 *
 * ```typescript
 * const memory = new Memory({
 *   options: {
 *     observationalMemory: {
 *       model: 'google/gemini-2.5-flash',
 *       hooks: { beforeObservation: skillResultFilter() },
 *     },
 *   },
 * });
 * ```
 *
 * Because a hook is a function over the messages, this composes with your own
 * filtering by chaining the outputs. Await each chained filter so an async one
 * doesn't resolve to a promise that gets discarded:
 *
 * ```typescript
 * const dropSkillResults = skillResultFilter();
 *
 * hooks: {
 *   beforeObservation: async input => {
 *     const messages = (await dropSkillResults(input))?.messages ?? input.messages;
 *     return { messages: messages.filter(m => m.role !== 'signal') };
 *   },
 * }
 * ```
 */
export function skillResultFilter(options?: SkillResultFilterOptions): ObserverMessageFilter {
  const toolNames = new Set<string>(options?.toolNames ?? SKILL_TOOL_NAMES);

  return ({ messages }) => {
    let changed = false;

    const filtered = messages.map(message => {
      const parts = message.content?.parts;
      if (!Array.isArray(parts)) return message;

      let messageChanged = false;
      const nextParts = parts.map(part => {
        if (!isRedactableToolResult(part, toolNames)) return part;
        messageChanged = true;
        return redactToolResult(part);
      });

      if (!messageChanged) return message;

      changed = true;
      return { ...message, content: { ...message.content, parts: nextParts } };
    });

    // `undefined` means "pass through unchanged", so leave untouched payloads alone.
    return changed ? { messages: filtered } : undefined;
  };
}
