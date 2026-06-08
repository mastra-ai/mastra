import { describe, it, expect } from 'vitest';

import type { ProcessInputStepArgs } from '../index';
import { deriveLoadedNamesFromMessages, LegacyMapLoadedToolStore, ContextLoadedToolStore } from './tool-search-stores';

/**
 * Build a minimal ProcessInputStepArgs carrying conversation messages with the
 * given search_tools / load_tool tool-invocation results.
 */
function argsWithMessages(
  invocations: Array<{ toolName: 'search_tools' | 'load_tool'; result: unknown }>,
): ProcessInputStepArgs {
  return {
    messages: [
      {
        id: 'm1',
        role: 'assistant',
        content: {
          format: 2,
          parts: invocations.map((inv, i) => ({
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'result' as const,
              toolCallId: `call-${i}`,
              toolName: inv.toolName,
              args: {},
              result: inv.result,
            },
          })),
        },
      },
    ],
  } as unknown as ProcessInputStepArgs;
}

describe('deriveLoadedNamesFromMessages', () => {
  it('reads names from a search_tools result (results[].name)', () => {
    const args = argsWithMessages([
      { toolName: 'search_tools', result: { results: [{ name: 'weather' }, { name: 'calendar' }] } },
    ]);
    expect([...deriveLoadedNamesFromMessages(args)].sort()).toEqual(['calendar', 'weather']);
  });

  it('reads names from a load_tool result (loaded[])', () => {
    const args = argsWithMessages([{ toolName: 'load_tool', result: { loaded: ['github_create_issue'] } }]);
    expect([...deriveLoadedNamesFromMessages(args)]).toEqual(['github_create_issue']);
  });

  it('unions across multiple invocations and ignores other tools', () => {
    const args = argsWithMessages([
      { toolName: 'search_tools', result: { results: [{ name: 'weather' }] } },
      { toolName: 'load_tool', result: { loaded: ['calendar'] } },
    ]);
    expect([...deriveLoadedNamesFromMessages(args)].sort()).toEqual(['calendar', 'weather']);
  });

  it('returns empty when messages are missing', () => {
    expect(deriveLoadedNamesFromMessages({} as ProcessInputStepArgs).size).toBe(0);
  });
});

describe('LegacyMapLoadedToolStore', () => {
  const emptyArgs = argsWithMessages([]);

  it('tracks loaded tools per thread', () => {
    const store = new LegacyMapLoadedToolStore({ ttl: 0 });
    store.addLoaded(['weather'], { threadId: 'thread-1', args: emptyArgs });
    store.addLoaded(['calendar'], { threadId: 'thread-2', args: emptyArgs });

    expect([...store.getLoadedNames({ threadId: 'thread-1', args: emptyArgs })]).toEqual(['weather']);
    expect([...store.getLoadedNames({ threadId: 'thread-2', args: emptyArgs })]).toEqual(['calendar']);
  });

  it('shares the default entry across anonymous requests (original behavior)', () => {
    const store = new LegacyMapLoadedToolStore({ ttl: 0 });
    store.addLoaded(['weather'], { threadId: undefined, args: emptyArgs });
    expect([...store.getLoadedNames({ threadId: undefined, args: emptyArgs })]).toEqual(['weather']);
  });

  it('clears a single thread and all threads', () => {
    const store = new LegacyMapLoadedToolStore({ ttl: 0 });
    store.addLoaded(['weather'], { threadId: 'thread-1', args: emptyArgs });
    store.addLoaded(['calendar'], { threadId: 'thread-2', args: emptyArgs });

    store.clearState('thread-1');
    expect(store.getLoadedNames({ threadId: 'thread-1', args: emptyArgs }).size).toBe(0);
    expect([...store.getLoadedNames({ threadId: 'thread-2', args: emptyArgs })]).toEqual(['calendar']);

    store.clearAllState();
    expect(store.getLoadedNames({ threadId: 'thread-2', args: emptyArgs }).size).toBe(0);
  });

  it('evicts stale state past the ttl and reports stats', async () => {
    const store = new LegacyMapLoadedToolStore({ ttl: 40 });
    store.addLoaded(['weather'], { threadId: 'thread-1', args: emptyArgs });
    expect(store.getStateStats().threadCount).toBe(1);

    await new Promise(r => setTimeout(r, 70));
    expect(store.cleanupStaleState()).toBeGreaterThanOrEqual(1);
    expect(store.getStateStats().threadCount).toBe(0);
  });
});

describe('ContextLoadedToolStore', () => {
  it('derives loaded names purely from the messages (restart-safe)', () => {
    const store = new ContextLoadedToolStore();
    const args = argsWithMessages([{ toolName: 'load_tool', result: { loaded: ['weather'] } }]);

    // A brand-new store instance (simulating a process restart) still resolves
    // loaded names from the conversation messages alone.
    const names = store.getLoadedNames({ threadId: 'thread-1', args });
    expect([...names]).toEqual(['weather']);
  });

  it('bridges activation with a same-process supplemental set before the messages catch up', () => {
    const store = new ContextLoadedToolStore();
    const emptyArgs = argsWithMessages([]);

    store.addLoaded(['weather'], { threadId: 'thread-1', args: emptyArgs });
    // Messages do not yet contain the result, but the supplemental set carries it.
    expect([...store.getLoadedNames({ threadId: 'thread-1', args: emptyArgs })]).toEqual(['weather']);
  });

  it('hands ownership to the messages once the result appears, so eviction de-loads', () => {
    const store = new ContextLoadedToolStore();
    const withResult = argsWithMessages([{ toolName: 'load_tool', result: { loaded: ['weather'] } }]);

    store.addLoaded(['weather'], { threadId: 'thread-1', args: withResult });
    // First read sees it in the messages and prunes the supplemental entry.
    expect([...store.getLoadedNames({ threadId: 'thread-1', args: withResult })]).toEqual(['weather']);

    // Simulate the result block leaving the messages.
    const evicted = argsWithMessages([]);
    expect(store.getLoadedNames({ threadId: 'thread-1', args: evicted }).size).toBe(0);
  });

  it('does not share supplemental state across anonymous (no-threadId) requests', () => {
    const store = new ContextLoadedToolStore();
    const emptyArgs = argsWithMessages([]);

    store.addLoaded(['weather'], { threadId: undefined, args: emptyArgs });
    expect(store.getLoadedNames({ threadId: undefined, args: emptyArgs }).size).toBe(0);
  });
});
