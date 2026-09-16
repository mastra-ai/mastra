import type { MastraDBMessage } from '@mastra/core/agent';

import type { ObserveTransformHooks } from './types';

type MessagePart = MastraDBMessage['content']['parts'][number];

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
  /** Tool names whose results are dropped. Defaults to {@link SKILL_TOOL_NAMES}. */
  toolNames?: readonly string[];
}

function isObservedToolResult(part: MessagePart, toolNames: Set<string>): boolean {
  if (part?.type !== 'tool-invocation') return false;
  // Only `state: 'result'` parts are rendered as `Tool Result <name>` for the
  // Observer, so only those carry the tool's full output.
  if (part.toolInvocation.state !== 'result') return false;
  const toolName = part.toolInvocation.toolName;
  return typeof toolName === 'string' && toolNames.has(toolName);
}

/**
 * Build a `beforeObservation` hook that keeps Agent Skills results out of the
 * Observer payload.
 *
 * The `skill` tool returns a skill's instructions verbatim as its result, and
 * `skill_read` / `skill_search` return skill file contents, so without a filter
 * the Observer re-observes the full skill text every time a skill is used.
 * Skill tool *call* parts are left in place; only the results are dropped.
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
 * Because a hook is just a function over the messages, this composes with your
 * own filtering by chaining the outputs:
 *
 * ```typescript
 * const dropSkillResults = skillResultFilter();
 *
 * hooks: {
 *   beforeObservation: input => {
 *     const messages = dropSkillResults(input)?.messages ?? input.messages;
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

      const kept = parts.filter(part => !isObservedToolResult(part, toolNames));
      if (kept.length === parts.length) return message;

      changed = true;
      return { ...message, content: { ...message.content, parts: kept } };
    });

    // `undefined` means "pass through unchanged", so leave untouched payloads alone.
    return changed ? { messages: filtered } : undefined;
  };
}
