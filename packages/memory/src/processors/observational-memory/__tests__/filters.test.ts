/**
 * Unit tests for the prebuilt `beforeObservation` filters exported from
 * `@mastra/memory/filters`.
 *
 * `skillResultFilter` is a pure function over the Observer's message payload, so
 * these tests exercise it directly and then prove the effect end-to-end through
 * `formatMessagesForObserver` (the exact formatter the Observer model sees).
 */

import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { describe, it, expect } from 'vitest';

import { skillResultFilter, SKILL_TOOL_NAMES } from '../filters';
import { formatMessagesForObserver } from '../observer-agent';
import type { ObserveTransformHooks } from '../types';

type MessagePart = MastraDBMessage['content']['parts'][number];
type ToolInvocationPart = Extract<MessagePart, { type: 'tool-invocation' }>;

function createMessage(
  parts: MessagePart[],
  role: MastraDBMessage['role'] = 'assistant',
  id = 'msg-1',
): MastraDBMessage {
  return {
    id,
    role,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    content: { format: 2, parts } as MastraMessageContentV2,
  };
}

function skillResult(toolName: string, result: string, toolCallId = toolName): ToolInvocationPart {
  return {
    type: 'tool-invocation',
    toolInvocation: {
      state: 'result',
      toolCallId,
      toolName,
      args: { name: toolName },
      result,
    },
  };
}

describe('skillResultFilter', () => {
  it('drops the results of every built-in skill tool', async () => {
    const messages = [createMessage(SKILL_TOOL_NAMES.map(name => skillResult(name, `${name} secret instructions`)))];

    const result = await skillResultFilter()({ messages });

    expect(result?.messages[0]!.content.parts).toEqual([]);
  });

  it('keeps non-skill tool results and text parts untouched', async () => {
    const weather = skillResult('getWeather', 'sunny');
    const textPart = { type: 'text', text: 'hello' } as const;
    const messages = [createMessage([textPart, weather, skillResult('skill', 'secret')])];

    const result = await skillResultFilter()({ messages });

    expect(result?.messages[0]!.content.parts).toEqual([textPart, weather]);
  });

  it('passes through unchanged (returns undefined) when nothing matched', async () => {
    const messages = [createMessage([skillResult('getWeather', 'sunny')])];

    const result = await skillResultFilter()({ messages });

    expect(result).toBeUndefined();
  });

  it('does not mutate the original messages', async () => {
    const messages = [createMessage([skillResult('skill', 'secret')])];
    const snapshot = structuredClone(messages);

    await skillResultFilter()({ messages });

    expect(messages).toEqual(snapshot);
  });

  it('keeps skill tool-call parts that have not produced a result', async () => {
    const callPart: ToolInvocationPart = {
      type: 'tool-invocation',
      toolInvocation: { state: 'call', toolCallId: 'c1', toolName: 'skill', args: { name: 'pdf' } },
    };
    const messages = [createMessage([callPart])];

    const result = await skillResultFilter()({ messages });

    expect(result).toBeUndefined();
  });

  it('honors a custom toolNames list', async () => {
    const messages = [createMessage([skillResult('skill', 'secret'), skillResult('internal_lookup', 'sensitive')])];

    const result = await skillResultFilter({ toolNames: ['internal_lookup'] })({ messages });

    expect(result?.messages[0]!.content.parts).toEqual([messages[0]!.content.parts[0]]);
  });

  it('filters across multiple messages and preserves messages without matches', async () => {
    const untouched = createMessage([skillResult('getWeather', 'sunny')], 'assistant', 'msg-2');
    const other = createMessage([skillResult('skill', 'secret')], 'assistant', 'msg-3');
    const messages = [createMessage([skillResult('skill_search', 'hits')]), untouched, other];

    const result = await skillResultFilter()({ messages });

    expect(result?.messages).toHaveLength(3);
    expect(result?.messages[0]).not.toBe(messages[0]);
    expect(result?.messages[1]).toBe(untouched);
    expect(result?.messages[2]!.content.parts).toEqual([]);
  });

  it('removes skill content from the text the Observer model actually sees', () => {
    const messages = [createMessage([skillResult('skill', 'SECRET_SKILL_INSTRUCTIONS')])];

    expect(formatMessagesForObserver(messages)).toContain('SECRET_SKILL_INSTRUCTIONS');

    const filtered = skillResultFilter()({ messages })?.messages ?? messages;

    expect(formatMessagesForObserver(filtered)).not.toContain('SECRET_SKILL_INSTRUCTIONS');
  });

  it('composes with other filtering using the documented chaining pattern', async () => {
    // This mirrors the chaining example in the docs and `skillResultFilter`'s
    // JSDoc. It is a compile-time guard too: with `beforeObservation`'s broad
    // `void | { messages } | Promise<...>` return type, `dropSkillResults(input)
    // ?.messages` would not type-check, because `messages` is not a property of
    // every union member.
    const dropSkillResults = skillResultFilter();
    const signalMessage = createMessage([{ type: 'text', text: 'signal' }], 'signal', 'msg-signal');

    const hooks: ObserveTransformHooks = {
      beforeObservation: input => {
        const messages = dropSkillResults(input)?.messages ?? input.messages;
        return { messages: messages.filter(m => m.role !== 'signal') };
      },
    };

    const messages = [createMessage([skillResult('skill', 'secret')]), signalMessage];
    const result = await hooks.beforeObservation!({ messages, threadId: 't-1', resourceId: 'r-1' });

    expect(result?.messages).toHaveLength(1);
    expect(result?.messages[0]!.content.parts).toEqual([]);
  });
});
