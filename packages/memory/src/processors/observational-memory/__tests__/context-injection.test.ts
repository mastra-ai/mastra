import type { MessageList } from '@mastra/core/agent';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import { describe, it, expect, vi } from 'vitest';

import {
  OBSERVATION_CONTINUATION_HINT,
  OBSERVATION_CONTEXT_PROMPT,
  OBSERVATION_CONTEXT_INSTRUCTIONS,
  formatObservationsForContext,
  getThreadContext,
  injectObservationsIntoContext,
} from '../context-injection';

// =============================================================================
// Test Helpers
// =============================================================================

function makeRequestContext(entries: Record<string, unknown>): ProcessInputStepArgs['requestContext'] {
  const map = new Map(Object.entries(entries));
  return map as unknown as ProcessInputStepArgs['requestContext'];
}

function makeMessageList(opts?: {
  memoryInfo?: { threadId?: string; resourceId?: string };
  systemMessages?: string[];
  addedMessages?: any[];
}): MessageList {
  const systemMessages: string[] = [...(opts?.systemMessages ?? [])];
  const addedMessages: any[] = [...(opts?.addedMessages ?? [])];
  return {
    serialize: () => ({
      memoryInfo: opts?.memoryInfo,
    }),
    clearSystemMessages: vi.fn((source: string) => {
      // Remove system messages matching source
      const idx = systemMessages.findIndex(s => s === source);
      if (idx !== -1) systemMessages.splice(idx, 1);
    }),
    addSystem: vi.fn((content: string, source: string) => {
      systemMessages.push(source);
    }),
    add: vi.fn((msg: any, source: string) => {
      addedMessages.push({ msg, source });
    }),
    get: {
      all: { db: () => [] },
    },
  } as unknown as MessageList;
}

// =============================================================================
// Constants
// =============================================================================

describe('Constants', () => {
  it('OBSERVATION_CONTINUATION_HINT is a non-empty string', () => {
    expect(typeof OBSERVATION_CONTINUATION_HINT).toBe('string');
    expect(OBSERVATION_CONTINUATION_HINT.length).toBeGreaterThan(0);
    expect(OBSERVATION_CONTINUATION_HINT).toContain('memory observations');
  });

  it('OBSERVATION_CONTEXT_PROMPT is a non-empty string', () => {
    expect(typeof OBSERVATION_CONTEXT_PROMPT).toBe('string');
    expect(OBSERVATION_CONTEXT_PROMPT).toContain('observations');
  });

  it('OBSERVATION_CONTEXT_INSTRUCTIONS is a non-empty string', () => {
    expect(typeof OBSERVATION_CONTEXT_INSTRUCTIONS).toBe('string');
    expect(OBSERVATION_CONTEXT_INSTRUCTIONS).toContain('KNOWLEDGE UPDATES');
    expect(OBSERVATION_CONTEXT_INSTRUCTIONS).toContain('PLANNED ACTIONS');
    expect(OBSERVATION_CONTEXT_INSTRUCTIONS).toContain('MOST RECENT USER INPUT');
  });
});

// =============================================================================
// formatObservationsForContext
// =============================================================================

describe('formatObservationsForContext', () => {
  it('formats basic observations with prompt and instructions', () => {
    const result = formatObservationsForContext({ observations: 'User likes cats.' });
    expect(result).toContain(OBSERVATION_CONTEXT_PROMPT);
    expect(result).toContain('<observations>');
    expect(result).toContain('</observations>');
    expect(result).toContain(OBSERVATION_CONTEXT_INSTRUCTIONS);
    // The observations content (possibly optimized) should be present
    expect(result).toContain('cats');
  });

  it('injects current-task when provided', () => {
    const result = formatObservationsForContext({
      observations: 'Some observations',
      currentTask: 'Fix the login bug',
    });
    expect(result).toContain('<current-task>');
    expect(result).toContain('Fix the login bug');
    expect(result).toContain('</current-task>');
  });

  it('does not inject current-task when not provided', () => {
    const result = formatObservationsForContext({ observations: 'Some observations' });
    expect(result).not.toContain('<current-task>');
  });

  it('injects suggested-response when provided', () => {
    const result = formatObservationsForContext({
      observations: 'Some observations',
      suggestedResponse: 'Tell the user about X',
    });
    expect(result).toContain('<suggested-response>');
    expect(result).toContain('Tell the user about X');
    expect(result).toContain('</suggested-response>');
  });

  it('does not inject suggested-response when not provided', () => {
    const result = formatObservationsForContext({ observations: 'Some observations' });
    expect(result).not.toContain('<suggested-response>');
  });

  it('injects both current-task and suggested-response', () => {
    const result = formatObservationsForContext({
      observations: 'obs',
      currentTask: 'Task A',
      suggestedResponse: 'Suggest B',
    });
    expect(result).toContain('<current-task>');
    expect(result).toContain('Task A');
    expect(result).toContain('<suggested-response>');
    expect(result).toContain('Suggest B');
  });

  it('adds unobserved context blocks for resource scope', () => {
    const result = formatObservationsForContext({
      observations: 'obs',
      unobservedContextBlocks: 'Thread-2 context here',
    });
    expect(result).toContain('START_OTHER_CONVERSATIONS_BLOCK');
    expect(result).toContain('Thread-2 context here');
    expect(result).toContain('END_OTHER_CONVERSATIONS_BLOCK');
  });

  it('does not add unobserved context blocks when not provided', () => {
    const result = formatObservationsForContext({ observations: 'obs' });
    expect(result).not.toContain('START_OTHER_CONVERSATIONS_BLOCK');
  });
});

// =============================================================================
// getThreadContext
// =============================================================================

describe('getThreadContext', () => {
  it('returns context from RequestContext (MastraMemory)', () => {
    const rc = makeRequestContext({
      MastraMemory: { thread: { id: 'thread-abc' }, resourceId: 'res-xyz' },
    });
    const ml = makeMessageList();

    const result = getThreadContext({ requestContext: rc, messageList: ml, scope: 'thread' });
    expect(result).toEqual({ threadId: 'thread-abc', resourceId: 'res-xyz' });
  });

  it('falls back to MessageList memoryInfo', () => {
    const rc = makeRequestContext({});
    const ml = makeMessageList({ memoryInfo: { threadId: 'thread-from-ml', resourceId: 'res-from-ml' } });

    const result = getThreadContext({ requestContext: rc, messageList: ml, scope: 'thread' });
    expect(result).toEqual({ threadId: 'thread-from-ml', resourceId: 'res-from-ml' });
  });

  it('prefers RequestContext over MessageList', () => {
    const rc = makeRequestContext({
      MastraMemory: { thread: { id: 'from-rc' }, resourceId: 'rc-res' },
    });
    const ml = makeMessageList({ memoryInfo: { threadId: 'from-ml', resourceId: 'ml-res' } });

    const result = getThreadContext({ requestContext: rc, messageList: ml, scope: 'thread' });
    expect(result).toEqual({ threadId: 'from-rc', resourceId: 'rc-res' });
  });

  it('returns null in resource scope when no context found', () => {
    const rc = makeRequestContext({});
    const ml = makeMessageList();

    const result = getThreadContext({ requestContext: rc, messageList: ml, scope: 'resource' });
    expect(result).toBeNull();
  });

  it('throws in thread scope when no context found', () => {
    const rc = makeRequestContext({});
    const ml = makeMessageList();

    expect(() => getThreadContext({ requestContext: rc, messageList: ml, scope: 'thread' })).toThrow(
      "ObservationalMemory (scope: 'thread') requires a threadId",
    );
  });

  it('handles undefined requestContext', () => {
    const ml = makeMessageList({ memoryInfo: { threadId: 'fallback-id' } });

    const result = getThreadContext({ requestContext: undefined, messageList: ml, scope: 'thread' });
    expect(result).toEqual({ threadId: 'fallback-id', resourceId: undefined });
  });

  it('handles undefined requestContext and no memoryInfo in resource scope', () => {
    const ml = makeMessageList();
    const result = getThreadContext({ requestContext: undefined, messageList: ml, scope: 'resource' });
    expect(result).toBeNull();
  });
});

// =============================================================================
// injectObservationsIntoContext
// =============================================================================

describe('injectObservationsIntoContext', () => {
  function makeMockStorage(thread?: { metadata?: any }) {
    return {
      getThreadById: vi.fn().mockResolvedValue(thread ?? null),
    } as unknown as Parameters<typeof injectObservationsIntoContext>[0]['storage'];
  }

  it('injects observation system message and continuation hint', async () => {
    const storage = makeMockStorage({ metadata: {} });
    const ml = makeMessageList();
    const record = {
      activeObservations: 'User prefers dark mode.',
    } as any;
    const rc = makeRequestContext({ currentDate: new Date('2025-01-15') });

    await injectObservationsIntoContext({
      storage,
      messageList: ml,
      record,
      threadId: 'thread-1',
      resourceId: 'res-1',
      unobservedContextBlocks: undefined,
      requestContext: rc,
    });

    expect(ml.clearSystemMessages).toHaveBeenCalledWith('observational-memory');
    expect(ml.addSystem).toHaveBeenCalledWith(expect.stringContaining('dark mode'), 'observational-memory');
    expect(ml.add).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'user',
        content: expect.objectContaining({
          parts: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              text: expect.stringContaining(OBSERVATION_CONTINUATION_HINT),
            }),
          ]),
        }),
      }),
      'memory',
    );
  });

  it('does nothing when activeObservations is empty', async () => {
    const storage = makeMockStorage({ metadata: {} });
    const ml = makeMessageList();
    const record = { activeObservations: '' } as any;

    await injectObservationsIntoContext({
      storage,
      messageList: ml,
      record,
      threadId: 'thread-1',
      resourceId: undefined,
      unobservedContextBlocks: undefined,
      requestContext: undefined,
    });

    expect(ml.clearSystemMessages).not.toHaveBeenCalled();
    expect(ml.addSystem).not.toHaveBeenCalled();
    expect(ml.add).not.toHaveBeenCalled();
  });

  it('does nothing when activeObservations is undefined', async () => {
    const storage = makeMockStorage({ metadata: {} });
    const ml = makeMessageList();
    const record = {} as any;

    await injectObservationsIntoContext({
      storage,
      messageList: ml,
      record,
      threadId: 'thread-1',
      resourceId: undefined,
      unobservedContextBlocks: undefined,
      requestContext: undefined,
    });

    expect(ml.clearSystemMessages).not.toHaveBeenCalled();
  });

  it('injects currentTask from thread metadata', async () => {
    const storage = makeMockStorage({
      metadata: { mastra: { om: { currentTask: 'Deploy v2.0' } } },
    });
    const ml = makeMessageList();
    const record = { activeObservations: 'obs data' } as any;

    await injectObservationsIntoContext({
      storage,
      messageList: ml,
      record,
      threadId: 'thread-1',
      resourceId: undefined,
      unobservedContextBlocks: undefined,
      requestContext: undefined,
    });

    expect(ml.addSystem).toHaveBeenCalledWith(expect.stringContaining('Deploy v2.0'), 'observational-memory');
  });

  it('injects suggestedResponse from thread metadata', async () => {
    const storage = makeMockStorage({
      metadata: { mastra: { om: { suggestedResponse: 'Ask for details' } } },
    });
    const ml = makeMessageList();
    const record = { activeObservations: 'obs data' } as any;

    await injectObservationsIntoContext({
      storage,
      messageList: ml,
      record,
      threadId: 'thread-1',
      resourceId: undefined,
      unobservedContextBlocks: undefined,
      requestContext: undefined,
    });

    expect(ml.addSystem).toHaveBeenCalledWith(expect.stringContaining('Ask for details'), 'observational-memory');
  });

  it('includes unobserved context blocks', async () => {
    const storage = makeMockStorage({ metadata: {} });
    const ml = makeMessageList();
    const record = { activeObservations: 'obs' } as any;

    await injectObservationsIntoContext({
      storage,
      messageList: ml,
      record,
      threadId: 'thread-1',
      resourceId: undefined,
      unobservedContextBlocks: 'Other thread content',
      requestContext: undefined,
    });

    expect(ml.addSystem).toHaveBeenCalledWith(expect.stringContaining('Other thread content'), 'observational-memory');
  });

  it('uses currentDate from requestContext as Date', async () => {
    const storage = makeMockStorage({ metadata: {} });
    const ml = makeMessageList();
    const record = { activeObservations: 'Date: Jan 10, 2025\n* obs' } as any;
    const fixedDate = new Date('2025-01-15T00:00:00Z');
    const rc = makeRequestContext({ currentDate: fixedDate });

    await injectObservationsIntoContext({
      storage,
      messageList: ml,
      record,
      threadId: 'thread-1',
      resourceId: undefined,
      unobservedContextBlocks: undefined,
      requestContext: rc,
    });

    // The observation should be processed (relative time added)
    expect(ml.addSystem).toHaveBeenCalled();
  });

  it('uses currentDate from requestContext as string', async () => {
    const storage = makeMockStorage({ metadata: {} });
    const ml = makeMessageList();
    const record = { activeObservations: 'obs' } as any;
    const rc = makeRequestContext({ currentDate: '2025-01-15T00:00:00Z' });

    await injectObservationsIntoContext({
      storage,
      messageList: ml,
      record,
      threadId: 'thread-1',
      resourceId: undefined,
      unobservedContextBlocks: undefined,
      requestContext: rc,
    });

    expect(ml.addSystem).toHaveBeenCalled();
  });

  it('continuation message has correct structure', async () => {
    const storage = makeMockStorage({ metadata: {} });
    const ml = makeMessageList();
    const record = { activeObservations: 'obs data' } as any;

    await injectObservationsIntoContext({
      storage,
      messageList: ml,
      record,
      threadId: 'thread-1',
      resourceId: 'res-1',
      unobservedContextBlocks: undefined,
      requestContext: undefined,
    });

    expect(ml.add).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'om-continuation',
        role: 'user',
        threadId: 'thread-1',
        resourceId: 'res-1',
        createdAt: new Date(0),
      }),
      'memory',
    );
  });
});
