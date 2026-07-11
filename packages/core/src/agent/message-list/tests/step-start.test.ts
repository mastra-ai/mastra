import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../';
import { MessageList } from '../index';

function makeAssistantMessage(parts: MastraDBMessage['content']['parts'], id?: string): MastraDBMessage {
  return {
    id: id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role: 'assistant',
    content: { format: 2, parts },
    createdAt: new Date(),
  };
}

function makeUserMessage(text: string): MastraDBMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text }] },
    createdAt: new Date(),
  };
}

describe('MessageList.stepStart', () => {
  it('should append step-start to the last assistant message', () => {
    const messageList = new MessageList();
    const msg = makeAssistantMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'tc-1',
          toolName: 'weather',
          args: { city: 'London' },
          result: { temp: 72 },
        },
      },
    ]);
    messageList.add(msg, 'response');

    const result = messageList.stepStart();

    expect(result).toBe(true);
    const parts = messageList.get.all.db()[0]?.content?.parts ?? [];
    expect(parts[parts.length - 1]).toMatchObject({ type: 'step-start' });
    expect(parts[parts.length - 1]).toEqual(expect.objectContaining({ createdAt: expect.any(Number) }));
  });

  it('should return false when the last message is a user message', () => {
    const messageList = new MessageList();
    messageList.add(makeUserMessage('hello'), 'response');

    const result = messageList.stepStart();

    expect(result).toBe(false);
  });

  it('should return false when there are no messages', () => {
    const messageList = new MessageList();

    const result = messageList.stepStart();

    expect(result).toBe(false);
  });

  it('should not add a duplicate step-start', () => {
    const messageList = new MessageList();
    const msg = makeAssistantMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'tc-1',
          toolName: 'weather',
          args: { city: 'London' },
          result: { temp: 72 },
        },
      },
    ]);
    messageList.add(msg, 'response');

    messageList.stepStart();
    const secondResult = messageList.stepStart();

    expect(secondResult).toBe(false);
    const parts = messageList.get.all.db()[0]?.content?.parts ?? [];
    const stepStarts = parts.filter(p => p.type === 'step-start');
    expect(stepStarts).toHaveLength(1);
  });

  it('should not add step-start to a sealed message', () => {
    const messageList = new MessageList();
    const msg = makeAssistantMessage([{ type: 'text', text: 'hello' }]);
    // Seal the message
    msg.content.metadata = { mastra: { sealed: true } };
    messageList.add(msg, 'response');

    const result = messageList.stepStart();

    expect(result).toBe(false);
    const parts = messageList.get.all.db()[0]?.content?.parts ?? [];
    expect(parts.find(p => p.type === 'step-start')).toBeUndefined();
  });

  it('should move a memory message to response source for persistence', () => {
    const messageList = new MessageList();
    const msg = makeAssistantMessage([{ type: 'text', text: 'hello' }]);
    messageList.add(msg, 'memory');

    const result = messageList.stepStart();

    expect(result).toBe(true);
    // The message should now be in the response source (drainable for saving)
    const unsaved = messageList.drainUnsavedMessages();
    expect(unsaved.length).toBeGreaterThan(0);
    const drained = unsaved.find(m => m.id === msg.id);
    expect(drained).toBeDefined();
    expect(drained?.content.parts.at(-1)).toMatchObject({ type: 'step-start' });
    expect(drained?.content.parts.at(-1)).toEqual(expect.objectContaining({ createdAt: expect.any(Number) }));
  });

  it('should enrich the latest step-start with the resolved model', () => {
    const messageList = new MessageList();
    const msg = makeAssistantMessage([
      { type: 'text', text: 'hello' },
      { type: 'step-start', createdAt: Date.now() },
    ]);
    messageList.add(msg, 'response');

    const result = messageList.enrichLastStepStart('openai/gpt-4o');

    expect(result).toBe(true);
    expect(messageList.get.all.db()[0]?.content.parts.at(-1)).toMatchObject({
      type: 'step-start',
      model: 'openai/gpt-4o',
    });
  });

  it('should return false when no step-start exists to enrich', () => {
    const messageList = new MessageList();
    messageList.add(makeAssistantMessage([{ type: 'text', text: 'hello' }]), 'response');

    const result = messageList.enrichLastStepStart('openai/gpt-4o');

    expect(result).toBe(false);
  });

  it('should not overwrite a step-start that already has a model attributed', () => {
    const messageList = new MessageList();
    const msg = makeAssistantMessage([
      { type: 'text', text: 'hello' },
      { type: 'step-start', createdAt: Date.now(), model: 'openai/gpt-4o' },
    ]);
    messageList.add(msg, 'response');

    const result = messageList.enrichLastStepStart('anthropic/claude-opus-4-7');

    expect(result).toBe(false);
    expect(messageList.get.all.db()[0]?.content.parts.at(-1)).toMatchObject({
      type: 'step-start',
      model: 'openai/gpt-4o',
    });
  });

  it('preserves step-start metadata when merge inserts a synthetic step-start', () => {
    const messageList = new MessageList();
    const stepStartCreatedAt = 1234567890;

    messageList.add(
      makeAssistantMessage(
        [
          { type: 'text', text: 'First step' },
          { type: 'step-start', createdAt: stepStartCreatedAt, model: 'openai/gpt-4o' },
          { type: 'text', text: 'Starting second step' },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tc-1',
              toolName: 'weather',
              args: { city: 'London' },
              result: { temp: 72 },
            },
          },
        ],
        'assistant-1',
      ),
      'response',
    );

    messageList.add(makeAssistantMessage([{ type: 'text', text: 'Second step' }], 'assistant-1'), 'response');

    const stepStarts = messageList.get.all.db()[0]?.content.parts.filter(p => p.type === 'step-start') ?? [];

    expect(stepStarts).toHaveLength(2);
    expect(stepStarts[1]).toMatchObject({
      type: 'step-start',
      model: 'openai/gpt-4o',
    });
    expect(stepStarts[1]?.createdAt).toEqual(expect.any(Number));
    expect(stepStarts[1]?.createdAt).not.toBe(stepStartCreatedAt);
  });
});
