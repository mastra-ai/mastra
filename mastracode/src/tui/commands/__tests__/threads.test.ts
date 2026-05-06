import type { HarnessMessage, HarnessThread } from '@mastra/core/harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleThreadsCommand } from '../threads.js';
import type { SlashCommandContext } from '../types.js';

const selectorInstances: Array<any> = [];

vi.mock('@mariozechner/pi-tui', () => ({
  Spacer: class {
    constructor(public size: number) {}
  },
}));

vi.mock('../clone.js', () => ({
  askCloneName: vi.fn(),
  confirmClone: vi.fn(),
  resetUIAfterClone: vi.fn(),
}));

vi.mock('../../components/ask-question-inline.js', () => ({
  AskQuestionInlineComponent: class {},
}));

vi.mock('../../components/thread-selector.js', () => ({
  ThreadSelectorComponent: class {
    focused = false;
    options: any;
    constructor(options: any) {
      this.options = options;
      selectorInstances.push(this);
    }
  },
}));

function createThread(id: string, updatedAtIso: string): HarnessThread {
  const updatedAt = new Date(updatedAtIso);
  return {
    id,
    resourceId: 'resource-1',
    title: 'New Thread',
    createdAt: updatedAt,
    updatedAt,
    metadata: {},
    tokenUsage: { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
  };
}

function createMessage(id: string, text: string): HarnessMessage {
  return {
    id,
    role: 'user',
    createdAt: new Date('2026-03-17T15:00:00.000Z'),
    content: [{ type: 'text', text }],
  };
}

function createContext(threads: HarnessThread[]) {
  const showOverlay = vi.fn();
  const state = {
    pendingNewThread: false,
    projectInfo: { rootPath: '/repo', gitBranch: 'main' },
    threadPreviewCache: new Map<string, { preview: string; updatedAt: number }>(),
    attemptedThreadPreviewIds: new Set<string>(),
    ui: {
      showOverlay,
      hideOverlay: vi.fn(),
      requestRender: vi.fn(),
    },
    chatContainer: { clear: vi.fn() },
    allToolComponents: [] as any[],
    pendingTools: new Map(),
    harness: {
      listThreads: vi.fn(async () => threads),
      getCurrentThreadId: vi.fn(() => null),
      getResourceId: vi.fn(() => 'resource-1'),
      getFirstUserMessagesForThreads: vi.fn(async () => new Map()),
      setResourceId: vi.fn(),
      switchThread: vi.fn(),
      cloneThread: vi.fn(),
    },
  };

  const ctx = {
    state,
    showInfo: vi.fn(),
    showError: vi.fn(),
    renderExistingMessages: vi.fn(),
  } as unknown as SlashCommandContext;

  return { ctx, state, showOverlay };
}

describe('handleThreadsCommand thread listing', () => {
  beforeEach(() => {
    selectorInstances.length = 0;
  });

  it('drops stale cached previews when a thread has a newer updatedAt', async () => {
    const threads = [createThread('thread-1', '2026-03-17T15:10:00.000Z')];
    const { ctx, state, showOverlay } = createContext(threads);
    state.threadPreviewCache.set('thread-1', {
      preview: 'Old preview',
      updatedAt: new Date('2026-03-17T15:00:00.000Z').getTime(),
    });
    state.attemptedThreadPreviewIds.add('thread-1');

    const commandPromise = handleThreadsCommand(ctx);
    await Promise.resolve();
    expect(showOverlay).toHaveBeenCalledTimes(1);

    const selector = selectorInstances[0];
    expect(selector.options.initialMessagePreviews.size).toBe(0);
    expect(state.threadPreviewCache.has('thread-1')).toBe(false);
    expect(state.attemptedThreadPreviewIds.has('thread-1')).toBe(false);

    selector.options.onCancel();
    await commandPromise;
  });

  it('preserves fresh cached previews for unchanged threads', async () => {
    const threads = [createThread('thread-1', '2026-03-17T15:10:00.000Z')];
    const { ctx, state, showOverlay } = createContext(threads);
    state.threadPreviewCache.set('thread-1', {
      preview: 'Fresh preview',
      updatedAt: new Date('2026-03-17T15:10:00.000Z').getTime(),
    });
    state.attemptedThreadPreviewIds.add('thread-1');

    const commandPromise = handleThreadsCommand(ctx);
    await Promise.resolve();
    expect(showOverlay).toHaveBeenCalledTimes(1);

    const selector = selectorInstances[0];
    expect(selector.options.initialMessagePreviews.get('thread-1')).toBe('Fresh preview');
    expect(state.threadPreviewCache.get('thread-1')?.preview).toBe('Fresh preview');
    expect(state.attemptedThreadPreviewIds.has('thread-1')).toBe(true);

    selector.options.onCancel();
    await commandPromise;
  });

  it('returns only cached previews and never requests uncached ones from the harness', async () => {
    const threads = [createThread('thread-1', '2026-03-17T15:10:00.000Z')];
    const { ctx, state, showOverlay } = createContext(threads);
    state.threadPreviewCache.set('thread-1', {
      preview: 'Cached preview',
      updatedAt: new Date('2026-03-17T15:10:00.000Z').getTime(),
    });
    state.attemptedThreadPreviewIds.add('thread-1');
    state.harness.getFirstUserMessagesForThreads = vi.fn(
      async () => new Map([['thread-1', createMessage('message-1', 'slow')]]),
    );

    const commandPromise = handleThreadsCommand(ctx);
    await Promise.resolve();
    expect(showOverlay).toHaveBeenCalledTimes(1);

    const selector = selectorInstances[0];
    expect(typeof selector.options.getMessagePreviews).toBe('function');
    await expect(selector.options.getMessagePreviews(['thread-1', 'thread-2'])).resolves.toEqual(
      new Map([['thread-1', 'Cached preview']]),
    );
    expect(state.harness.getFirstUserMessagesForThreads).not.toHaveBeenCalled();
    expect(state.threadPreviewCache.get('thread-1')).toEqual({
      preview: 'Cached preview',
      updatedAt: new Date('2026-03-17T15:10:00.000Z').getTime(),
    });
    expect(state.attemptedThreadPreviewIds.has('thread-1')).toBe(true);
    expect(state.attemptedThreadPreviewIds.has('thread-2')).toBe(false);

    selector.options.onCancel();
    await commandPromise;
  });
});
