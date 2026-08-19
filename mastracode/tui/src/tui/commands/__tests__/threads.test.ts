import type { AgentControllerThread, MastraDBMessage } from '@mastra/core/agent-controller';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantRenderRegistry, getAssistantSegmentKey } from '../../assistant-render-registry.js';
import { AssistantMessageComponent } from '../../components/assistant-message.js';
import { askModalQuestion } from '../../modal-question.js';
import { handleThreadsCommand, showThreadLockPrompt } from '../threads.js';
import type { SlashCommandContext } from '../types.js';

const selectorInstances: Array<any> = [];

vi.mock('../clone.js', () => ({
  askCloneName: vi.fn(),
  confirmClone: vi.fn(),
  resetUIAfterClone: vi.fn(),
}));

vi.mock('../../modal-question.js', () => ({
  askModalQuestion: vi.fn(),
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

function createThread(id: string, updatedAtIso: string): AgentControllerThread {
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

function createMessage(id: string, text: string): MastraDBMessage {
  return {
    id,
    role: 'user',
    createdAt: new Date('2026-03-17T15:00:00.000Z'),
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

function createContext(threads: AgentControllerThread[]) {
  const showOverlay = vi.fn();
  const trackInteractivePrompt = vi.fn();
  const assistantRenderRegistry = new AssistantRenderRegistry();
  const assistantSegment = assistantRenderRegistry.start(
    'assistant-1',
    getAssistantSegmentKey('assistant-1'),
    () => new AssistantMessageComponent(),
  ).segment;
  vi.spyOn(assistantSegment.component, 'disposeRenderState');
  const state = {
    assistantRenderRegistry,
    assistantSegment,
    pendingNewThread: false,
    projectInfo: { rootPath: '/repo', gitBranch: 'main' },
    threadPreviewCache: new Map<string, { preview: string; updatedAt: number }>(),
    attemptedThreadPreviewIds: new Set<string>(),
    waitForAgentControllerEvents: undefined as undefined | (() => Promise<void>),
    ui: {
      showOverlay,
      hideOverlay: vi.fn(),
      requestRender: vi.fn(),
    },
    chatContainer: { clear: vi.fn(), addChild: vi.fn(), invalidate: vi.fn() },
    allToolComponents: [] as any[],
    allSystemReminderComponents: [] as any[],
    allShellComponents: [] as any[],
    messageComponentsById: new Map(),
    pendingTools: new Map(),
    pendingTaskToolIds: new Set(),
    session: {
      identity: { getResourceId: vi.fn(() => 'resource-1') },
      thread: {
        getId: vi.fn(() => null),
        list: vi.fn(async () => threads),
        firstUserMessages: vi.fn(async () => new Map()),
        switch: vi.fn(async () => {}),
      },
      mode: { get: vi.fn(() => 'build') },
    },
    controller: {
      setResourceId: vi.fn(),
      switchThread: vi.fn(),
      cloneThread: vi.fn(),
    },
  };

  const ctx = {
    state,
    analytics: { trackInteractivePrompt },
    showInfo: vi.fn(),
    showError: vi.fn(),
    renderExistingMessages: vi.fn(),
  } as unknown as SlashCommandContext;

  return { ctx, state, showOverlay, trackInteractivePrompt };
}

describe('handleThreadsCommand thread listing', () => {
  beforeEach(() => {
    selectorInstances.length = 0;
    vi.mocked(askModalQuestion).mockReset();
    vi.mocked(askModalQuestion).mockResolvedValue('New thread');
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

  it('returns only cached previews and never requests uncached ones from the controller', async () => {
    const threads = [createThread('thread-1', '2026-03-17T15:10:00.000Z')];
    const { ctx, state, showOverlay } = createContext(threads);
    state.threadPreviewCache.set('thread-1', {
      preview: 'Cached preview',
      updatedAt: new Date('2026-03-17T15:10:00.000Z').getTime(),
    });
    state.attemptedThreadPreviewIds.add('thread-1');
    state.session.thread.firstUserMessages = vi.fn(
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
    expect(state.session.thread.firstUserMessages).not.toHaveBeenCalled();
    expect(state.threadPreviewCache.get('thread-1')).toEqual({
      preview: 'Cached preview',
      updatedAt: new Date('2026-03-17T15:10:00.000Z').getTime(),
    });
    expect(state.attemptedThreadPreviewIds.has('thread-1')).toBe(true);
    expect(state.attemptedThreadPreviewIds.has('thread-2')).toBe(false);

    selector.options.onCancel();
    await commandPromise;
  });

  it('waits for thread-change rendering and disposes assistant render ownership when switching threads', async () => {
    const threads = [createThread('thread-1', '2026-03-17T15:10:00.000Z')];
    const { ctx, state, showOverlay } = createContext(threads);
    const rendered = vi.fn();
    state.waitForAgentControllerEvents = vi.fn(async () => rendered());

    const commandPromise = handleThreadsCommand(ctx);
    await Promise.resolve();
    expect(showOverlay).toHaveBeenCalledTimes(1);

    await selectorInstances[0].options.onSelect(threads[0]);
    await commandPromise;

    expect(state.session.thread.switch).toHaveBeenCalledWith({ threadId: 'thread-1' });
    expect(state.waitForAgentControllerEvents).toHaveBeenCalledTimes(1);
    expect(rendered).toHaveBeenCalledTimes(1);
    expect(state.assistantRenderRegistry.size).toBe(0);
    expect(state.assistantSegment.component.disposeRenderState).toHaveBeenCalledOnce();
    expect(state.chatContainer.clear).toHaveBeenCalledOnce();
    expect(ctx.renderExistingMessages).toHaveBeenCalledOnce();
  });

  it('tracks the thread lock prompt when shown', () => {
    const { ctx, trackInteractivePrompt } = createContext([]);

    showThreadLockPrompt(ctx, 'Locked Thread', 1234, 'thread-locked');

    expect(trackInteractivePrompt).toHaveBeenCalledWith('thread_lock_prompt', {
      threadId: 'thread-locked',
      resourceId: 'resource-1',
      mode: 'build',
    });
  });
});
