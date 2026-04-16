import { describe, it, expect, vi } from 'vitest';
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
    abort: vi.fn(),
    retryCount: 0,
    ...overrides,
  });

  // Helper to create minimal args for processInputStep
  const createInputStepArgs = (overrides: Partial<ProcessInputStepArgs> = {}): ProcessInputStepArgs => ({
    messages: [],
    systemMessages: [],
    messageList: {} as any,
    requestContext: new RequestContext(),
    stepNumber: 0,
    steps: [],
    state: {},
    model: undefined as any,
    retryCount: 0,
    abort: vi.fn(),
    ...overrides,
  });

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
    it('should return undefined when no browser context', () => {
      const result = processor.processInputStep(createInputStepArgs());

      expect(result).toBeUndefined();
    });

    it('should return undefined when stepNumber is not 0', () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        currentUrl: 'https://example.com',
      };
      requestContext.set('browser', browserCtx);

      const result = processor.processInputStep(createInputStepArgs({ requestContext, stepNumber: 1 }));

      expect(result).toBeUndefined();
    });

    it('should prepend system-reminder to user message with URL and title', () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        currentUrl: 'https://example.com/page',
        pageTitle: 'Example Page',
      };
      requestContext.set('browser', browserCtx);

      const messages = [
        {
          role: 'user' as const,
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Hello' }],
          },
        },
      ] as any;

      const result = processor.processInputStep(createInputStepArgs({ messages, requestContext }));

      expect(result).toBeDefined();
      const resultMessages = (result as any).messages;
      expect(resultMessages).toHaveLength(1);
      const textPart = resultMessages[0].content.parts[0];
      expect(textPart.text).toContain('<system-reminder>');
      expect(textPart.text).toContain('https://example.com/page');
      expect(textPart.text).toContain('Example Page');
      expect(textPart.text).toContain('Hello');
    });

    it('should indicate browser not running', () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        isRunning: false,
      };
      requestContext.set('browser', browserCtx);

      const messages = [
        {
          role: 'user' as const,
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Hello' }],
          },
        },
      ] as any;

      const result = processor.processInputStep(createInputStepArgs({ messages, requestContext }));

      expect(result).toBeDefined();
      const resultMessages = (result as any).messages;
      const textPart = resultMessages[0].content.parts[0];
      expect(textPart.text).toContain('Browser is not currently running');
    });

    it('should return undefined when no per-request data available', () => {
      const requestContext = new RequestContext();
      const browserCtx: BrowserContext = {
        provider: 'agent-browser',
        // No currentUrl, pageTitle, or isRunning=false
      };
      requestContext.set('browser', browserCtx);

      const result = processor.processInputStep(createInputStepArgs({ requestContext }));

      expect(result).toBeUndefined();
    });
  });
});
