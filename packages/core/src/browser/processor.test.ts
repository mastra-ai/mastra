import { describe, it, expect, vi } from 'vitest';
import type { MastraDBMessage } from '../agent/message-list';
import { createSignal } from '../agent/signals';
import type { ProcessInputArgs } from '../processors';
import { RequestContext } from '../request-context';
import { BrowserContextProcessor } from './processor';
import type { BrowserContext } from './processor';

describe('BrowserContextProcessor', () => {
  const processor = new BrowserContextProcessor();

  // Helper to create minimal args for processInput
  const createInputArgs = (overrides: Partial<ProcessInputArgs> = {}): ProcessInputArgs => ({
    messages: [],
    systemMessages: [],
    messageList: {} as any,
    requestContext: new RequestContext(),
    state: {},
    abort: vi.fn() as any,
    retryCount: 0,
    ...overrides,
  });

  // Helper to create a mock messageList
  const createMockMessageList = (existingMessages: MastraDBMessage[] = []) => {
    const messages = [...existingMessages];
    return {
      get: {
        all: {
          db: () => messages,
        },
      },
      add: vi.fn((msg: MastraDBMessage) => {
        messages.push(msg);
      }),
    };
  };

  describe('processInput', () => {
    it('should return messageList unchanged when no browser context', () => {
      const messageList = { foo: 'bar' } as any;
      const result = processor.processInput(createInputArgs({ messageList }));

      expect(result).toBe(messageList);
    });

    it('should add system message with browser info', () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        sessionId: 'test-session-123',
        headless: false,
      };
      requestContext.set('browser', browserCtx);

      const result = processor.processInput(createInputArgs({ requestContext }));

      expect(result).toHaveProperty('systemMessages');
      const systemMessages = (result as any).systemMessages;
      expect(systemMessages).toHaveLength(1);
      expect(systemMessages[0].role).toBe('system');
      expect(systemMessages[0].content).toContain('agent-browser');
      expect(systemMessages[0].content).toContain('not headless');
      expect(systemMessages[0].content).toContain('test-session-123');
    });

    it('should not mention headless mode when headless is true', () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'stagehand',
        headless: true,
      };
      requestContext.set('browser', browserCtx);

      const result = processor.processInput(createInputArgs({ requestContext }));

      const systemMessages = (result as any).systemMessages;
      expect(systemMessages[0].content).not.toContain('headless');
    });
  });

  describe('computeStateSignal', () => {
    const createStateArgs = (
      browserCtx?: BrowserContext,
      activeStateSignals: any[] = [],
      options: { contextWindow?: { hasSnapshot?: boolean }; lastSnapshot?: any } = {},
    ) => {
      const requestContext = new RequestContext();
      if (browserCtx) requestContext.set('browser', browserCtx);
      return {
        messages: [],
        messageList: createMockMessageList() as any,
        requestContext,
        state: {},
        abort: vi.fn() as any,
        retryCount: 0,
        stepNumber: 0,
        steps: [],
        resourceId: 'resource-1',
        threadId: 'thread-1',
        activeStateSignals,
        contextWindow: {
          hasSnapshot:
            options.contextWindow?.hasSnapshot ??
            activeStateSignals.some(signal => signal.metadata?.state?.mode === 'snapshot'),
        },
        lastSnapshot:
          options.lastSnapshot ?? activeStateSignals.findLast(signal => signal.metadata?.state?.mode === 'snapshot'),
        deltasSinceSnapshot: activeStateSignals.filter(signal => signal.metadata?.state?.mode === 'delta'),
      };
    };

    it('returns an aggregate browser state snapshot', async () => {
      const result = await processor.computeStateSignal(
        createStateArgs({
          provider: 'agent-browser',
          currentUrl: 'https://example.com',
          pageTitle: 'Example',
          isOpen: true,
          tabCount: 3,
          pageMetadata: { ready: true },
        }),
      );

      expect(result).toEqual(
        expect.objectContaining({
          tagName: 'state',
          contents: expect.stringContaining('Active tab URL: https://example.com'),
          id: 'browser',
          cacheKey: expect.any(String),
          mode: 'snapshot',
          value: expect.objectContaining({ open: true, activeUrl: 'https://example.com', tabCount: 3 }),
          attributes: expect.objectContaining({ type: 'browser' }),
          metadata: expect.objectContaining({
            browser: expect.objectContaining({ open: true, activeUrl: 'https://example.com', tabCount: 3 }),
          }),
        }),
      );
    });

    it('returns metadata-backed deltas when active state exists', async () => {
      const activeSignal = createSignal({
        type: 'state',
        contents: 'Browser is open. 2 open tabs.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', version: 1 },
          browser: { open: true, activeUrl: 'https://example.com', pageTitle: 'Example', tabCount: 2 },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs(
          {
            provider: 'agent-browser',
            currentUrl: 'https://example.com',
            pageTitle: 'Example',
            isOpen: true,
            tabCount: 3,
          },
          [activeSignal as any],
        ),
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: 'browser',
          mode: 'delta',
          contents: 'changed: 3 open tabs',
          delta: { tabCount: 3 },
          value: expect.objectContaining({ tabCount: 3 }),
          metadata: expect.objectContaining({
            browser: expect.objectContaining({ tabCount: 3 }),
          }),
        }),
      );
    });

    it('refreshes browser state before computing the signal', async () => {
      const result = await processor.computeStateSignal(
        createStateArgs({
          provider: 'agent-browser',
          currentUrl: 'https://stale.example.com',
          pageTitle: 'Stale',
          isOpen: true,
          getState: vi.fn(async () => ({
            currentUrl: 'https://fresh.example.com',
            pageTitle: 'Fresh',
            tabCount: 2,
          })),
        }),
      );

      expect(result).toEqual(
        expect.objectContaining({
          contents: expect.stringContaining('Active tab URL: https://fresh.example.com'),
          value: expect.objectContaining({ activeUrl: 'https://fresh.example.com', pageTitle: 'Fresh', tabCount: 2 }),
        }),
      );
    });

    it('emits a fresh snapshot when the previous snapshot is no longer active', async () => {
      const evictedSnapshot = createSignal({
        type: 'state',
        contents: 'Browser is open. Active tab URL: https://example.com.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', mode: 'snapshot', version: 1 },
          browser: { open: true, activeUrl: 'https://example.com' },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs(
          { provider: 'agent-browser', currentUrl: 'https://example.com', isOpen: true },
          [evictedSnapshot as any],
          { contextWindow: { hasSnapshot: false } },
        ),
      );

      expect(result).toEqual(
        expect.objectContaining({
          mode: 'snapshot',
          contents: expect.stringContaining('Browser is open.'),
          value: expect.objectContaining({ activeUrl: 'https://example.com' }),
        }),
      );
    });

    it('does not emit when browser state has not changed', async () => {
      const activeSignal = createSignal({
        type: 'state',
        contents: 'Browser is open.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', version: 1 },
          browser: { open: true, activeUrl: 'https://example.com' },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', currentUrl: 'https://example.com', isOpen: true }, [
          activeSignal as any,
        ]),
      );

      expect(result).toBeUndefined();
    });

    it('includes active URL when browser opens from a remembered closed state', async () => {
      const closedSignal = createSignal({
        type: 'state',
        contents:
          'The browser was closed because the chat process restarted. Active tab URL: https://example.com/. 1 open tab.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'closed', version: 1 },
          value: { processId: 'previous-process', open: false, activeUrl: 'https://example.com/', tabCount: 1 },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs(
          {
            provider: 'agent-browser',
            isOpen: true,
            currentUrl: 'https://example.com/',
            activeUrlChangeSource: 'agent',
            tabCount: 1,
          },
          [closedSignal as any],
        ),
      );

      expect(result).toEqual(
        expect.objectContaining({
          mode: 'delta',
          contents: 'changed: browser opened; agent changed active tab URL to https://example.com/; 1 open tab',
          delta: expect.objectContaining({
            open: true,
            activeUrl: 'https://example.com/',
            activeUrlChangeSource: 'agent',
            tabCount: 1,
          }),
        }),
      );
    });

    it('does not emit when browser was never opened (no previous state and currently closed)', async () => {
      const result = await processor.computeStateSignal(createStateArgs({ provider: 'agent-browser', isOpen: false }));

      expect(result).toBeUndefined();
    });

    it('does not refresh a bare closed browser snapshot after restart', async () => {
      const evictedSnapshot = createSignal({
        type: 'state',
        contents: 'Browser is open. Active tab URL: https://example.com.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', mode: 'snapshot', version: 1 },
          browser: { open: true, activeUrl: 'https://example.com' },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', isOpen: false }, [evictedSnapshot as any], {
          contextWindow: { hasSnapshot: false },
        }),
      );

      expect(result).toBeUndefined();
    });

    it('does not emit an ambiguous bare closed delta without process attribution', async () => {
      const activeSignal = createSignal({
        type: 'state',
        contents: 'Browser is open.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', version: 1 },
          browser: { open: true, activeUrl: 'https://example.com' },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', isOpen: false }, [activeSignal as any]),
      );

      expect(result).toBeUndefined();
    });

    it('attributes a bare closed delta to process restart when process id changed', async () => {
      const activeSignal = createSignal({
        type: 'state',
        contents: 'Browser is open.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', version: 1 },
          value: { processId: 'previous-process', open: true, activeUrl: 'https://example.com' },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', isOpen: false }, [activeSignal as any]),
      );

      expect(result).toEqual(
        expect.objectContaining({
          mode: 'delta',
          contents: expect.stringContaining('browser was closed because the chat process restarted'),
          delta: expect.objectContaining({ open: false, closeReason: 'process_restart' }),
        }),
      );
    });

    it('attributes a same-process bare closed delta to the user', async () => {
      const snapshot = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', isOpen: true, currentUrl: 'https://example.com' }),
      );
      expect(snapshot).toBeDefined();
      const activeSignal = createSignal({
        type: 'state',
        contents: snapshot!.contents,
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: snapshot!.cacheKey, version: 1 },
          browser: snapshot!.metadata!.browser,
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', isOpen: false }, [activeSignal as any]),
      );

      expect(result).toEqual(
        expect.objectContaining({
          mode: 'delta',
          contents: expect.stringContaining('browser was closed externally, maybe by the user'),
          delta: expect.objectContaining({ open: false, closeReason: 'user' }),
        }),
      );
    });

    it('attributes a same-process remembered closed state to the user', async () => {
      const snapshot = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', isOpen: true, currentUrl: 'https://example.com', tabCount: 1 }),
      );
      expect(snapshot).toBeDefined();
      const activeSignal = createSignal({
        type: 'state',
        contents: snapshot!.contents,
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: snapshot!.cacheKey, version: 1 },
          browser: snapshot!.metadata!.browser,
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', isOpen: false, currentUrl: 'https://example.com', tabCount: 1 }, [
          activeSignal as any,
        ]),
      );

      expect(result).toEqual(
        expect.objectContaining({
          mode: 'delta',
          contents: expect.stringContaining('browser was closed externally, maybe by the user'),
          delta: expect.objectContaining({ open: false, closeReason: 'user' }),
        }),
      );
    });

    it('attributes a remembered closed state to process restart when process id changed', async () => {
      const activeSignal = createSignal({
        type: 'state',
        contents: 'Browser is open. Active tab URL: https://example.com. 1 open tab.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', version: 1 },
          value: { processId: 'previous-process', open: true, activeUrl: 'https://example.com', tabCount: 1 },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', isOpen: false, currentUrl: 'https://example.com', tabCount: 1 }, [
          activeSignal as any,
        ]),
      );

      expect(result).toEqual(
        expect.objectContaining({
          mode: 'delta',
          contents: expect.stringContaining('browser was closed because the chat process restarted'),
          delta: expect.objectContaining({ open: false, closeReason: 'process_restart' }),
        }),
      );
    });

    it('attributes snapshot refresh close to process restart from last snapshot when active copies are empty', async () => {
      const lastSnapshot = createSignal({
        type: 'state',
        contents: 'Browser is open. Active tab URL: https://example.com. 1 open tab.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', mode: 'snapshot', version: 1 },
          value: { processId: 'previous-process', open: true, activeUrl: 'https://example.com', tabCount: 1 },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs(
          { provider: 'agent-browser', isOpen: false, currentUrl: 'https://example.com', tabCount: 1 },
          [],
          { contextWindow: { hasSnapshot: false }, lastSnapshot },
        ),
      );

      expect(result).toEqual(
        expect.objectContaining({
          mode: 'snapshot',
          contents: expect.stringContaining('The browser was closed because the chat process restarted.'),
          value: expect.objectContaining({ closeReason: 'process_restart' }),
        }),
      );
    });

    it('includes process_restart close reason in delta', async () => {
      const activeSignal = createSignal({
        type: 'state',
        contents: 'Browser is open.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', version: 1 },
          browser: { open: true },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', isOpen: false, closeReason: 'process_restart' }, [
          activeSignal as any,
        ]),
      );

      expect(result).toBeDefined();
      expect(result).toEqual(
        expect.objectContaining({
          mode: 'delta',
          contents: expect.stringContaining('browser was closed because the chat process restarted'),
        }),
      );
    });

    it('includes user close reason in delta', async () => {
      const activeSignal = createSignal({
        type: 'state',
        contents: 'Browser is open.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', version: 1 },
          browser: { open: true },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', isOpen: false, closeReason: 'user' }, [activeSignal as any]),
      );

      expect(result).toBeDefined();
      expect(result).toEqual(
        expect.objectContaining({
          mode: 'delta',
          contents: expect.stringContaining('browser was closed externally, maybe by the user'),
        }),
      );
    });

    it('includes error close reason in delta', async () => {
      const activeSignal = createSignal({
        type: 'state',
        contents: 'Browser is open.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', version: 1 },
          browser: { open: true },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', isOpen: false, closeReason: 'error' }, [activeSignal as any]),
      );

      expect(result).toBeDefined();
      expect(result).toEqual(
        expect.objectContaining({
          mode: 'delta',
          contents: expect.stringContaining('closed unexpectedly due to an error'),
        }),
      );
    });

    it('attributes active URL changes to the user when provided', async () => {
      const activeSignal = createSignal({
        type: 'state',
        contents: 'Browser is open. Active tab URL: https://example.com.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', version: 1 },
          browser: { open: true, activeUrl: 'https://example.com' },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs(
          {
            provider: 'agent-browser',
            isOpen: true,
            currentUrl: 'https://www.google.com/',
            activeUrlChangeSource: 'user',
          },
          [activeSignal as any],
        ),
      );

      expect(result).toEqual(
        expect.objectContaining({
          mode: 'delta',
          contents: 'changed: user changed active tab URL to https://www.google.com/',
          delta: { activeUrl: 'https://www.google.com/', activeUrlChangeSource: 'user' },
        }),
      );
    });

    it('attributes same-process active URL changes to the user when source is missing', async () => {
      const snapshot = await processor.computeStateSignal(
        createStateArgs({ provider: 'agent-browser', isOpen: true, currentUrl: 'https://example.com' }),
      );
      expect(snapshot).toBeDefined();
      const activeSignal = createSignal({
        type: 'state',
        contents: snapshot!.contents,
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: snapshot!.cacheKey, version: 1 },
          browser: snapshot!.metadata!.browser,
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs(
          {
            provider: 'agent-browser',
            isOpen: true,
            currentUrl: 'https://www.google.com/',
          },
          [activeSignal as any],
        ),
      );

      expect(result).toEqual(
        expect.objectContaining({
          mode: 'delta',
          contents: 'changed: user changed active tab URL to https://www.google.com/',
          delta: { activeUrl: 'https://www.google.com/', activeUrlChangeSource: 'user' },
        }),
      );
    });

    it('does not emit when only the active URL change source changes', async () => {
      const activeSignal = createSignal({
        type: 'state',
        contents: 'Browser is open. Active tab URL: https://example.com.',
        metadata: {
          state: { id: 'browser', threadId: 'thread-1', cacheKey: 'old', version: 1 },
          browser: { open: true, activeUrl: 'https://example.com' },
        },
      });

      const result = await processor.computeStateSignal(
        createStateArgs(
          {
            provider: 'agent-browser',
            isOpen: true,
            currentUrl: 'https://example.com',
            activeUrlChangeSource: 'user',
          },
          [activeSignal as any],
        ),
      );

      expect(result).toBeUndefined();
    });
  });
});
