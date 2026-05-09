import { describe, it, expect, vi } from 'vitest';
import type { MastraDBMessage } from '../agent/message-list';
import { createSignal, mastraDBMessageToSignal } from '../agent/signals';
import type { ProcessInputArgs, ProcessInputStepArgs } from '../processors';
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

  // Helper to create minimal args for processInputStep
  const createInputStepArgs = (overrides: Partial<ProcessInputStepArgs> = {}): ProcessInputStepArgs => {
    const messageList = overrides.messageList ?? (createMockMessageList() as any);
    const rotateResponseMessageId = overrides.rotateResponseMessageId ?? vi.fn();
    return {
      messages: [],
      systemMessages: [],
      messageList,
      requestContext: new RequestContext(),
      stepNumber: 0,
      steps: [],
      state: {},
      model: undefined as any,
      retryCount: 0,
      abort: vi.fn() as any,
      rotateResponseMessageId,
      sendSignal: async signalInput => {
        const signal = createSignal(signalInput);
        rotateResponseMessageId?.();
        messageList.add(signal.toDBMessage(), 'input');
        return signal;
      },
      ...overrides,
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

  describe('processInputStep', () => {
    it('should return undefined when no browser context', async () => {
      const result = await processor.processInputStep(createInputStepArgs());

      expect(result).toBeUndefined();
    });

    it('should return undefined when stepNumber is not 0', async () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        currentUrl: 'https://example.com',
      };
      requestContext.set('browser', browserCtx);

      const result = await processor.processInputStep(createInputStepArgs({ requestContext, stepNumber: 1 }));

      expect(result).toBeUndefined();
    });

    it('should add a new user message with system-reminder containing URL and title', async () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        currentUrl: 'https://example.com/page',
        pageTitle: 'Example Page',
      };
      requestContext.set('browser', browserCtx);

      const mockMessageList = createMockMessageList();
      const rotateResponseMessageId = vi.fn();

      const result = await processor.processInputStep(
        createInputStepArgs({
          requestContext,
          messageList: mockMessageList as any,
          rotateResponseMessageId,
        }),
      );

      expect(result).toBe(mockMessageList);
      expect(mockMessageList.add).toHaveBeenCalledTimes(1);

      const addedMessage = mockMessageList.add.mock.calls[0][0] as MastraDBMessage;
      expect(addedMessage.role).toBe('signal');
      expect(addedMessage.type).toBe('system-reminder');
      expect(addedMessage.content.metadata).toEqual(
        expect.objectContaining({
          type: 'browser-context',
          url: 'https://example.com/page',
          title: 'Example Page',
          signal: expect.objectContaining({ type: 'system-reminder' }),
        }),
      );

      const textPart = addedMessage.content.parts?.[0] as { type: 'text'; text: string };
      expect(textPart.text).toContain('https://example.com/page');
      expect(textPart.text).toContain('Example Page');

      expect(rotateResponseMessageId).toHaveBeenCalled();
    });

    it('should add system-reminder when only page title is available', async () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        pageTitle: 'Example Page',
      };
      requestContext.set('browser', browserCtx);

      const mockMessageList = createMockMessageList();

      const result = await processor.processInputStep(
        createInputStepArgs({
          requestContext,
          messageList: mockMessageList as any,
        }),
      );

      expect(result).toBe(mockMessageList);
      expect(mockMessageList.add).toHaveBeenCalledTimes(1);

      const addedMessage = mockMessageList.add.mock.calls[0][0] as MastraDBMessage;
      expect(addedMessage.role).toBe('signal');
      const textPart = addedMessage.content.parts?.[0] as { type: 'text'; text: string };
      expect(textPart.text).toContain('Example Page');
    });

    it('should return undefined when no per-request data available', async () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        // No currentUrl or pageTitle
      };
      requestContext.set('browser', browserCtx);

      const result = await processor.processInputStep(createInputStepArgs({ requestContext }));

      expect(result).toBeUndefined();
    });

    it('should not add duplicate reminder if same content already exists', async () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        currentUrl: 'https://example.com/page',
        pageTitle: 'Example Page',
      };
      requestContext.set('browser', browserCtx);

      // Create messageList with an existing browser reminder (matching URL/title in metadata)
      const existingReminder: MastraDBMessage = {
        id: 'existing-reminder',
        role: 'user',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: '<system-reminder type="browser-context">Current URL: https://example.com/page | Page title: Example Page</system-reminder>',
            },
          ],
          metadata: {
            systemReminder: {
              type: 'browser-context',
              url: 'https://example.com/page',
              title: 'Example Page',
            },
          },
        },
        createdAt: new Date(),
      };

      const mockMessageList = createMockMessageList([existingReminder]);

      const result = await processor.processInputStep(
        createInputStepArgs({
          requestContext,
          messageList: mockMessageList as any,
        }),
      );

      expect(result).toBeUndefined();
      expect(mockMessageList.add).not.toHaveBeenCalled();
    });

    it('should add new reminder if URL changed from previous reminder', async () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        currentUrl: 'https://example.com/new-page',
        pageTitle: 'New Page',
      };
      requestContext.set('browser', browserCtx);

      // Create messageList with an existing browser reminder for a different URL
      const existingReminder: MastraDBMessage = {
        id: 'existing-reminder',
        role: 'user',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: '<system-reminder type="browser-context">Current URL: https://example.com/old-page | Page title: Old Page</system-reminder>',
            },
          ],
          metadata: {
            systemReminder: {
              type: 'browser-context',
              url: 'https://example.com/old-page',
              title: 'Old Page',
            },
          },
        },
        createdAt: new Date(),
      };

      const mockMessageList = createMockMessageList([existingReminder]);

      const result = await processor.processInputStep(
        createInputStepArgs({
          requestContext,
          messageList: mockMessageList as any,
        }),
      );

      expect(result).toBe(mockMessageList);
      expect(mockMessageList.add).toHaveBeenCalledTimes(1);

      const addedMessage = mockMessageList.add.mock.calls[0][0] as MastraDBMessage;
      const textPart = addedMessage.content.parts?.[0] as { type: 'text'; text: string };
      expect(textPart.text).toContain('https://example.com/new-page');
      expect(textPart.text).toContain('New Page');
    });

    it('should add reminder for A→B→A navigation (trailing reminder B differs from current A)', async () => {
      const requestContext = new RequestContext();
      // Current state: back on page A
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        currentUrl: 'https://example.com/page-a',
        pageTitle: 'Page A',
      };
      requestContext.set('browser', browserCtx);

      // History: A, then B (trailing is B, so A should be added)
      const reminderA: MastraDBMessage = {
        id: 'reminder-a',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: '<system-reminder type="browser-context">Page A</system-reminder>' }],
          metadata: {
            systemReminder: { type: 'browser-context', url: 'https://example.com/page-a', title: 'Page A' },
          },
        },
        createdAt: new Date(),
      };
      const reminderB: MastraDBMessage = {
        id: 'reminder-b',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: '<system-reminder type="browser-context">Page B</system-reminder>' }],
          metadata: {
            systemReminder: { type: 'browser-context', url: 'https://example.com/page-b', title: 'Page B' },
          },
        },
        createdAt: new Date(),
      };

      const mockMessageList = createMockMessageList([reminderA, reminderB]);

      const result = await processor.processInputStep(
        createInputStepArgs({
          requestContext,
          messageList: mockMessageList as any,
        }),
      );

      // Should add new reminder because trailing (B) doesn't match current (A)
      expect(result).toBe(mockMessageList);
      expect(mockMessageList.add).toHaveBeenCalledTimes(1);

      const addedMessage = mockMessageList.add.mock.calls[0][0] as MastraDBMessage;
      const textPart = addedMessage.content.parts?.[0] as { type: 'text'; text: string };
      expect(textPart.text).toContain('page-a');
    });

    it('should add reminder when trailing message is not a browser reminder (user → reminder → assistant → user)', async () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        currentUrl: 'https://example.com/page-a',
        pageTitle: 'Page A',
      };
      requestContext.set('browser', browserCtx);

      // History: reminder(A), then assistant response, then new user message
      const reminderA: MastraDBMessage = {
        id: 'reminder-a',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: '<system-reminder type="browser-context">Page A</system-reminder>' }],
          metadata: {
            systemReminder: { type: 'browser-context', url: 'https://example.com/page-a', title: 'Page A' },
          },
        },
        createdAt: new Date(),
      };
      const assistantResponse: MastraDBMessage = {
        id: 'assistant-response',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Here is the page content...' }],
        },
        createdAt: new Date(),
      };
      const userMessage: MastraDBMessage = {
        id: 'user-message',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Now do something else' }],
        },
        createdAt: new Date(),
      };

      const mockMessageList = createMockMessageList([reminderA, assistantResponse, userMessage]);

      const result = await processor.processInputStep(
        createInputStepArgs({
          requestContext,
          messageList: mockMessageList as any,
        }),
      );

      // Should add reminder because trailing message is a regular user message, not a browser reminder
      expect(result).toBe(mockMessageList);
      expect(mockMessageList.add).toHaveBeenCalledTimes(1);
    });

    it('should escape XML special characters in URL and title', async () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        currentUrl: 'https://example.com/search?q=foo&bar=1',
        pageTitle: 'Search <Results> & More',
      };
      requestContext.set('browser', browserCtx);

      const mockMessageList = createMockMessageList();

      await processor.processInputStep(
        createInputStepArgs({
          requestContext,
          messageList: mockMessageList as any,
        }),
      );

      const addedMessage = mockMessageList.add.mock.calls[0][0] as MastraDBMessage;
      const textPart = addedMessage.content.parts?.[0] as { type: 'text'; text: string };

      // DB signal content stays raw; XML escaping happens when converting to LLM markup.
      expect(textPart.text).toContain('q=foo&bar');
      expect(textPart.text).toContain('<Results>');

      const llmMessage = mastraDBMessageToSignal(addedMessage).toLLMMessage();
      expect(llmMessage).toEqual([
        {
          role: 'system',
          content:
            '<system-reminder type="browser-context">Current URL: https://example.com/search?q=foo&amp;bar=1 | Page title: Search &lt;Results&gt; &amp; More</system-reminder>',
        },
      ]);
    });
  });
});
