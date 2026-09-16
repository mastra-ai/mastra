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

const resultOf = (part: MessagePart): unknown => (part as ToolInvocationPart).toolInvocation.result;

describe('skillResultFilter', () => {
  it('redacts the results of every built-in skill tool', async () => {
    const messages = [createMessage(SKILL_TOOL_NAMES.map(name => skillResult(name, `${name} secret instructions`)))];
    const parts = messages[0]!.content.parts;

    const result = await skillResultFilter()({ messages });

    const redacted = result?.messages[0]!.content.parts as ToolInvocationPart[];
    expect(redacted).toHaveLength(SKILL_TOOL_NAMES.length);
    SKILL_TOOL_NAMES.forEach((name, index) => {
      const invocation = redacted[index]!.toolInvocation;
      // The call's identity survives so the Observer still records the skill.
      expect(invocation.toolName).toBe(name);
      expect(invocation.args).toEqual({ name });
      expect(invocation.state).toBe('result');
      // Only the payload is replaced.
      expect(resultOf(redacted[index]!)).not.toContain(name);
      expect(resultOf(parts[index]!)).toContain(`${name} secret instructions`);
    });
  });

  it('keeps non-skill tool results and text parts untouched', async () => {
    const weather = skillResult('getWeather', 'sunny');
    const textPart = { type: 'text', text: 'hello' } as const;
    const messages = [createMessage([textPart, weather, skillResult('skill', 'secret')])];

    const result = await skillResultFilter()({ messages });

    expect(result?.messages[0]!.content.parts[0]).toBe(textPart);
    expect(result?.messages[0]!.content.parts[1]).toBe(weather);
    expect(resultOf(result!.messages[0]!.content.parts[2]!)).not.toContain('secret');
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

  it('leaves a result part with no payload alone', async () => {
    const empty: ToolInvocationPart = {
      type: 'tool-invocation',
      toolInvocation: { state: 'result', toolCallId: 'c1', toolName: 'skill', args: { name: 'pdf' } },
    };

    const result = await skillResultFilter()({ messages: [createMessage([empty])] });

    expect(result).toBeUndefined();
  });

  it('redacts a result stored on providerMetadata.mastra.modelOutput', async () => {
    // `resolveToolResultValue` prefers this over `toolInvocation.result`, so it
    // is a separate place the skill text can hide.
    const part: ToolInvocationPart = {
      type: 'tool-invocation',
      providerMetadata: { mastra: { modelOutput: 'SECRET_SKILL_INSTRUCTIONS' } },
      toolInvocation: {
        state: 'result',
        toolCallId: 'c1',
        toolName: 'skill',
        args: { name: 'pdf' },
        result: 'plain copy',
      },
    };
    const messages = [createMessage([part])];

    const result = await skillResultFilter()({ messages });
    const filtered = result!.messages[0]!.content.parts[0] as ToolInvocationPart;

    expect(formatMessagesForObserver([messages[0]!])).toContain('SECRET_SKILL_INSTRUCTIONS');
    expect(JSON.stringify(filtered)).not.toContain('SECRET_SKILL_INSTRUCTIONS');
    expect(formatMessagesForObserver(result!.messages)).not.toContain('SECRET_SKILL_INSTRUCTIONS');
    // The original payloads are shared with stored history, so they stay intact.
    expect(part.providerMetadata!.mastra!.modelOutput).toBe('SECRET_SKILL_INSTRUCTIONS');
  });

  it('honors a custom toolNames list', async () => {
    const messages = [createMessage([skillResult('skill', 'secret'), skillResult('internal_lookup', 'sensitive')])];

    const result = await skillResultFilter({ toolNames: ['internal_lookup'] })({ messages });

    const parts = result?.messages[0]!.content.parts as ToolInvocationPart[];
    expect(resultOf(parts[0]!)).toBe('secret');
    expect(resultOf(parts[1]!)).not.toContain('sensitive');
  });

  it('redacts across multiple messages and preserves messages without matches', async () => {
    const untouched = createMessage([skillResult('getWeather', 'sunny')], 'assistant', 'msg-2');
    const other = createMessage([skillResult('skill', 'secret')], 'assistant', 'msg-3');
    const messages = [createMessage([skillResult('skill_search', 'hits')]), untouched, other];

    const result = await skillResultFilter()({ messages });

    expect(result?.messages).toHaveLength(3);
    expect(result?.messages[0]).not.toBe(messages[0]);
    expect(result?.messages[1]).toBe(untouched);
    expect(resultOf(result!.messages[2]!.content.parts[0]!)).not.toContain('secret');
  });

  it('removes skill content from the Observer text but keeps the tool call', () => {
    const messages = [createMessage([skillResult('skill', 'SECRET_SKILL_INSTRUCTIONS')])];

    expect(formatMessagesForObserver(messages)).toContain('SECRET_SKILL_INSTRUCTIONS');

    const filtered = skillResultFilter()({ messages })?.messages ?? messages;
    const rendered = formatMessagesForObserver(filtered);

    expect(rendered).not.toContain('SECRET_SKILL_INSTRUCTIONS');
    // The Observer still learns which skill was activated and how.
    expect(rendered).toContain('Tool Call skill');
  });

  it('keeps the tool call for a message whose only part is the result', () => {
    // The shape production persists: a call and its result collapse into one
    // `state: 'result'` part, and the Observer derives the `Tool Call` line from
    // that terminal part. A separate call part is not present.
    const messages = [createMessage([skillResult('skill', 'SECRET_SKILL_INSTRUCTIONS')])];
    expect(messages[0]!.content.parts).toHaveLength(1);

    const filtered = skillResultFilter()({ messages })?.messages ?? messages;
    const rendered = formatMessagesForObserver(filtered);

    expect(rendered).toContain('Tool Call skill');
    expect(rendered).toContain('name: "skill"');
    expect(rendered).not.toContain('SECRET_SKILL_INSTRUCTIONS');
  });

  it('composes with other filtering using the documented chaining pattern', async () => {
    // This mirrors the chaining example in the docs and `skillResultFilter`'s
    // JSDoc. It is a compile-time guard too: `beforeObservation` accepts a
    // promise, and awaiting each chained filter keeps an async one from being
    // silently discarded.
    const dropSkillResults = skillResultFilter();
    const signalMessage = createMessage([{ type: 'text', text: 'signal' }], 'signal', 'msg-signal');

    const hooks: ObserveTransformHooks = {
      beforeObservation: async input => {
        const messages = (await dropSkillResults(input))?.messages ?? input.messages;
        return { messages: messages.filter(m => m.role !== 'signal') };
      },
    };

    const messages = [createMessage([skillResult('skill', 'secret')]), signalMessage];
    const result = await hooks.beforeObservation!({ messages, threadId: 't-1', resourceId: 'r-1' });

    expect(result?.messages).toHaveLength(1);
    expect(resultOf(result!.messages[0]!.content.parts[0]!)).not.toContain('secret');
  });
});
