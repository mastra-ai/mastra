import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { MessageList } from '../agent/message-list';
import type { MastraDBMessage } from '../agent/message-list';
import { TrailingAssistantGuard } from './trailing-assistant-guard';
import type { ProcessInputStepArgs } from './index';

const createMessage = (role: 'user' | 'assistant', text: string): MastraDBMessage => ({
  id: `${role}-${text}`,
  role,
  content: {
    format: 2,
    parts: [{ type: 'text', text }],
  },
  createdAt: new Date(),
  threadId: 'test-thread',
});

const makeArgs = (
  overrides: Pick<Partial<ProcessInputStepArgs>, 'messages' | 'structuredOutput' | 'model' | 'messageList'> = {},
): ProcessInputStepArgs =>
  ({
    messages: overrides.messages ?? [createMessage('assistant', 'draft response')],
    messageList: overrides.messageList,
    structuredOutput:
      'structuredOutput' in overrides ? overrides.structuredOutput : { schema: z.object({ answer: z.string() }) },
    model: overrides.model ?? { provider: 'anthropic.messages', modelId: 'claude-opus-4-6' },
  }) as ProcessInputStepArgs;

const gemini3 = { provider: 'google.generative-ai', modelId: 'gemini-3.5-flash-lite' } as ProcessInputStepArgs['model'];
const gemini2 = { provider: 'google.generative-ai', modelId: 'gemini-2.5-flash' } as ProcessInputStepArgs['model'];

describe('TrailingAssistantGuard', () => {
  it('has the expected id and name', () => {
    const guard = new TrailingAssistantGuard();

    expect(guard.id).toBe('trailing-assistant-guard');
    expect(guard.name).toBe('Trailing Assistant Guard');
  });

  it('appliesTo reports which final models the guard can act on', () => {
    const guard = new TrailingAssistantGuard();

    expect(guard.appliesTo({ provider: 'google', modelId: 'gemini-3.5-flash-lite' })).toBe(true);
    expect(guard.appliesTo({ provider: 'anthropic.messages', modelId: 'claude-sonnet-4-6' })).toBe(true);
    expect(guard.appliesTo({ provider: 'google', modelId: 'gemini-2.5-flash' })).toBe(false);
    expect(guard.appliesTo({ provider: 'openai.chat', modelId: 'gpt-5' })).toBe(false);
    expect(guard.appliesTo(undefined)).toBe(false);
  });

  it('appends a user continuation message when native structured output follows an assistant message', () => {
    const guard = new TrailingAssistantGuard();
    const messages = [createMessage('user', 'question'), createMessage('assistant', 'draft response')];

    const result = guard.processInputStep(makeArgs({ messages }));

    expect(result?.messages).toHaveLength(3);
    expect(result?.messages?.slice(0, 2)).toEqual(messages);
    expect(result?.messages?.[2]).toMatchObject({
      role: 'user',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Generate the structured response.' }],
      },
    });
    expect(result?.messages?.[2]?.id).toEqual(expect.any(String));
    expect(result?.messages?.[2]?.createdAt).toBeInstanceOf(Date);
  });

  it('timestamps the appended message strictly after a trailing assistant message dated in the future', () => {
    const guard = new TrailingAssistantGuard();
    // MessageList nudges createdAt forward to keep insertion order, so the trailing
    // assistant message can sit ahead of wall-clock time. The guard must still sort after it.
    const assistant = createMessage('assistant', 'draft response');
    assistant.createdAt = new Date(Date.now() + 5_000);

    const result = guard.processInputStep(makeArgs({ messages: [assistant] }));

    const appended = result?.messages?.at(-1);
    expect(appended?.role).toBe('user');
    expect(appended!.createdAt.getTime()).toBeGreaterThan(assistant.createdAt.getTime());
  });

  it('does not append a message when structured output has no schema', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(makeArgs({ structuredOutput: undefined }));

    expect(result).toBeUndefined();
  });

  it('does not append a message when structured output uses a separate model', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(
      makeArgs({
        structuredOutput: {
          schema: z.object({ answer: z.string() }),
          model: 'anthropic/claude-opus-4-6',
        },
      }),
    );

    expect(result).toBeUndefined();
  });

  it('does not append a message when JSON prompt injection is enabled', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(
      makeArgs({
        structuredOutput: {
          schema: z.object({ answer: z.string() }),
          jsonPromptInjection: true,
        },
      }),
    );

    expect(result).toBeUndefined();
  });

  it('appends a generic continuation for Gemini 3+ even without structured output', () => {
    const guard = new TrailingAssistantGuard();
    const messages = [createMessage('user', 'question'), createMessage('assistant', 'draft response')];

    const result = guard.processInputStep(makeArgs({ messages, structuredOutput: undefined, model: gemini3 }));

    expect(result?.messages).toHaveLength(3);
    expect(result?.messages?.[2]).toMatchObject({
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'Continue.' }] },
    });
  });

  it('still uses the structured-output continuation text for Gemini 3+ under native structured output', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(makeArgs({ model: gemini3 }));

    expect(result?.messages?.at(-1)).toMatchObject({
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'Generate the structured response.' }] },
    });
  });

  it('appends a generic continuation for Gemini 3+ when structured output uses a separate model', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(
      makeArgs({
        model: gemini3,
        structuredOutput: { schema: z.object({ answer: z.string() }), model: 'anthropic/claude-opus-4-6' },
      }),
    );

    expect(result?.messages?.at(-1)).toMatchObject({
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'Continue.' }] },
    });
  });

  it('does not touch a trailing assistant message for providers that accept it, even under native structured output', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(
      makeArgs({ model: { provider: 'openai.chat', modelId: 'gpt-5' } as ProcessInputStepArgs['model'] }),
    );

    expect(result).toBeUndefined();
  });

  it('does not touch a trailing assistant message for Gemini 2.x without structured output', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(makeArgs({ structuredOutput: undefined, model: gemini2 }));

    expect(result).toBeUndefined();
  });

  it('does not touch a trailing assistant message for Anthropic without structured output (valid prefill)', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(makeArgs({ structuredOutput: undefined }));

    expect(result).toBeUndefined();
  });

  describe('trailing assistant message that ends on a tool result', () => {
    const toolInvocation = (state: 'result' | 'output-error' | 'call' | 'partial-call') =>
      ({
        type: 'tool-invocation',
        toolInvocation: {
          state,
          toolCallId: 'call-1',
          toolName: 'get-weather',
          args: { location: 'SF' },
          ...(state === 'result' ? { result: { temperature: 72 } } : {}),
          ...(state === 'output-error' ? { errorText: 'boom' } : {}),
        },
      }) as unknown as MastraDBMessage['content']['parts'][number];

    const assistantWith = (...parts: MastraDBMessage['content']['parts']): MastraDBMessage => ({
      ...createMessage('assistant', 'tool-turn'),
      content: { format: 2, parts },
    });

    it.each([
      ['Gemini 3+ without structured output', { structuredOutput: undefined, model: gemini3 }],
      ['Gemini 3+ under native structured output', { model: gemini3 }],
      ['Anthropic under native structured output', {}],
    ] as const)(
      'does not append after a settled tool result for %s (prompt already ends on a tool turn)',
      (_, args) => {
        const guard = new TrailingAssistantGuard();
        const messages = [createMessage('user', 'question'), assistantWith(toolInvocation('result'))];

        expect(guard.processInputStep(makeArgs({ ...args, messages }))).toBeUndefined();
      },
    );

    it('does not append after a tool error result', () => {
      const guard = new TrailingAssistantGuard();
      const messages = [createMessage('user', 'question'), assistantWith(toolInvocation('output-error'))];

      expect(
        guard.processInputStep(makeArgs({ messages, structuredOutput: undefined, model: gemini3 })),
      ).toBeUndefined();
    });

    it('ignores trailing step-start markers when locating the last content part', () => {
      const guard = new TrailingAssistantGuard();
      // Shape produced by the agentic loop between steps: results followed by a step-start marker.
      const messages = [
        createMessage('user', 'question'),
        assistantWith(toolInvocation('result'), toolInvocation('result'), {
          type: 'step-start',
        } as MastraDBMessage['content']['parts'][number]),
      ];

      expect(
        guard.processInputStep(makeArgs({ messages, structuredOutput: undefined, model: gemini3 })),
      ).toBeUndefined();
    });

    it('still appends when the assistant produced text after the tool result', () => {
      const guard = new TrailingAssistantGuard();
      const messages = [
        createMessage('user', 'question'),
        assistantWith(toolInvocation('result'), { type: 'text', text: 'It is sunny.' }),
      ];

      const result = guard.processInputStep(makeArgs({ messages, structuredOutput: undefined, model: gemini3 }));

      expect(result?.messages?.at(-1)).toMatchObject({ role: 'user' });
    });

    describe('still-pending tool call (no result yet)', () => {
      // Default MessageList behaviour drops unpaired calls from the prompt, so what precedes
      // the call decides whether the prompt ends on a model turn.
      it('appends when text precedes the pending call, because the call is dropped and the text remains', () => {
        const guard = new TrailingAssistantGuard();
        const messages = [
          createMessage('user', 'question'),
          assistantWith({ type: 'text', text: 'Let me check.' }, toolInvocation('call')),
        ];

        const result = guard.processInputStep(makeArgs({ messages, structuredOutput: undefined, model: gemini3 }));

        expect(result?.messages?.at(-1)).toMatchObject({ role: 'user' });
      });

      it('does not append when the pending call is the only content, because the whole message is dropped', () => {
        const guard = new TrailingAssistantGuard();
        const messages = [createMessage('user', 'question'), assistantWith(toolInvocation('call'))];

        expect(
          guard.processInputStep(makeArgs({ messages, structuredOutput: undefined, model: gemini3 })),
        ).toBeUndefined();
      });

      it('does not append when the list keeps incomplete calls, because they are paired with a placeholder result', () => {
        const guard = new TrailingAssistantGuard();
        const messages = [
          createMessage('user', 'question'),
          assistantWith({ type: 'text', text: 'Let me check.' }, toolInvocation('call')),
        ];
        const messageList = { dropsIncompleteToolCalls: false } as ProcessInputStepArgs['messageList'];

        expect(
          guard.processInputStep(makeArgs({ messages, structuredOutput: undefined, model: gemini3, messageList })),
        ).toBeUndefined();
      });
    });
  });

  it('adds the continuation to the message list as context so it is never persisted', () => {
    const guard = new TrailingAssistantGuard();
    const messageList = new MessageList({ threadId: 'test-thread' });
    messageList.add(createMessage('user', 'question'), 'input');
    messageList.add(createMessage('assistant', 'draft'), 'input');

    const result = guard.processInputStep(
      makeArgs({ messages: messageList.get.all.db(), messageList, structuredOutput: undefined, model: gemini3 }),
    );

    expect(result).toEqual({ messageList });
    expect(messageList.get.all.db().at(-1)).toMatchObject({
      role: 'user',
      content: { parts: [{ type: 'text', text: 'Continue.' }] },
    });
    expect(messageList.drainUnsavedMessages().map(message => message.content.parts)).toMatchObject([
      [{ type: 'text', text: 'question' }],
      [{ type: 'text', text: 'draft' }],
    ]);
  });

  it('does not append a message when the last message is not from the assistant', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(makeArgs({ messages: [createMessage('user', 'question')] }));

    expect(result).toBeUndefined();
  });

  it('does not append a message when there are no messages', () => {
    const guard = new TrailingAssistantGuard();

    const result = guard.processInputStep(makeArgs({ messages: [] }));

    expect(result).toBeUndefined();
  });
});
