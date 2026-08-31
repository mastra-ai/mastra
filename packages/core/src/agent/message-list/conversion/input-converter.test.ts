import { describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../state/types';
import type { InputConversionContext } from './input-converter';
import { hydrateMastraDBMessageFields, inputToMastraDBMessage } from './input-converter';

describe('hydrateMastraDBMessageFields', () => {
  it('backfills resourceId when the message already has a threadId', () => {
    const message = {
      id: 'msg-1',
      role: 'user',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      threadId: 'thread-1',
      content: {
        format: 2,
        parts: [],
      },
    } satisfies MastraDBMessage;
    const context = {
      memoryInfo: {
        threadId: 'thread-1',
        resourceId: 'resource-1',
      },
      newMessageId: vi.fn(() => 'generated-id'),
      generateCreatedAt: vi.fn(() => new Date('2026-01-02T00:00:00.000Z')),
      dbMessages: [],
    } satisfies InputConversionContext;

    const result = hydrateMastraDBMessageFields(message, context, 'memory');

    expect(result.threadId).toBe('thread-1');
    expect(result.resourceId).toBe('resource-1');
    expect(context.newMessageId).not.toHaveBeenCalled();
    expect(context.generateCreatedAt).not.toHaveBeenCalled();
  });
});

describe('inputToMastraDBMessage', () => {
  const makeContext = () =>
    ({
      memoryInfo: {
        threadId: 'thread-1',
        resourceId: 'resource-1',
      },
      newMessageId: vi.fn(() => 'generated-id'),
      generateCreatedAt: vi.fn(() => new Date('2026-01-02T00:00:00.000Z')),
      dbMessages: [],
    }) satisfies InputConversionContext;

  const makeMessage = (overrides: Partial<MastraDBMessage>) =>
    ({
      id: 'msg-1',
      role: 'user',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      threadId: 'thread-1',
      resourceId: 'resource-1',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'hello' }],
      },
      ...overrides,
    }) as MastraDBMessage;

  it('accepts memory-sourced messages whose resourceId differs from the conversation resource', () => {
    // Memory messages can carry a system resourceId — e.g. observational-memory
    // continuation messages arrive with the observer's own resourceId. The
    // threadId guard already exempts `memory`; the resourceId guard must too,
    // or a compaction mid-run throws inside input processing and aborts the turn.
    const message = makeMessage({
      threadId: 'other-thread',
      resourceId: 'structured-observer',
    });

    expect(() => inputToMastraDBMessage(message, 'memory', makeContext())).not.toThrow();
  });

  it('accepts memory-sourced messages from another thread and preserves their threadId', () => {
    // Resource-scoped observational memory loads context via listMessagesByResourceId(),
    // which returns messages from every thread of the resource. Those arrive tagged
    // `memory` while carrying their originating threadId, so the guard must exempt them —
    // and the original threadId must survive so the message is not re-homed onto the
    // current thread. See https://github.com/mastra-ai/mastra/issues/15367.
    const message = makeMessage({ id: 'cross-thread-msg', threadId: 'other-thread' });

    const converted = inputToMastraDBMessage(message, 'memory', makeContext());

    expect(converted.threadId).toBe('other-thread');
  });

  it('still rejects non-memory messages with a mismatched resourceId', () => {
    const message = makeMessage({ resourceId: 'someone-else' });

    expect(() => inputToMastraDBMessage(message, 'user', makeContext())).toThrow(/wrong resourceId/);
  });

  it('still rejects non-memory messages with a mismatched threadId', () => {
    const message = makeMessage({ threadId: 'other-thread' });

    expect(() => inputToMastraDBMessage(message, 'user', makeContext())).toThrow(/wrong threadId/);
  });

  it('compacts malformed memory message parts before recovering tool arguments', () => {
    const textPart = { type: 'text' as const, text: 'hello' };
    const toolPart = {
      type: 'tool-invocation' as const,
      toolInvocation: {
        state: 'call' as const,
        toolCallId: 'call-1',
        toolName: 'search',
        args: { query: 'weather' },
      },
    };
    const message = makeMessage({
      content: {
        format: 2,
        parts: [undefined, null, textPart, toolPart] as never,
        toolInvocations: [
          {
            state: 'call',
            toolCallId: 'call-1',
            toolName: 'search',
            args: {},
          },
        ],
      },
    });

    const converted = inputToMastraDBMessage(message, 'memory', makeContext());

    expect(converted.content.parts).toEqual([textPart, toolPart]);
    expect(converted.content.parts).not.toContain(undefined);
    expect(converted.content.parts).not.toContain(null);
    expect(converted.content.toolInvocations?.[0]?.args).toEqual({ query: 'weather' });
  });
});
