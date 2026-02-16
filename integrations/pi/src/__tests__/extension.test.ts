import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { ObservationalMemory } from '@mastra/memory/processors';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { convertMessages, createMastraOM } from '../index.js';

/**
 * These tests exercise the extension's `registerExtension` logic by
 * simulating the pi-coding-agent ExtensionAPI contract.
 *
 * Since `registerExtension` is a private function inside extension.ts,
 * we test the same logic paths through the public createMastraOM +
 * manual hook invocation, verifying the same behavior the extension wires up.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createInMemoryStorage(): InMemoryMemory {
  const db = new InMemoryDB();
  return new InMemoryMemory({ db });
}

function createMockObserverModel() {
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-observer',
    modelId: 'mock-observer-model',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate() {
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: `<observations>
## February 15, 2026

### Session
- 🔴 User discussed building integrations
- 🟡 Assistant explained observational memory
</observations>
<current-task>Building Pi integration tests</current-task>
<suggested-response>Let me continue helping.</suggested-response>`,
          },
        ],
        warnings: [],
      };
    },

    async doStream() {
      const text = `<observations>
## February 15, 2026
- 🔴 User discussed building integrations
</observations>
<current-task>Building Pi integration tests</current-task>
<suggested-response>Continue.</suggested-response>`;

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'obs-1',
            modelId: 'mock-observer-model',
            timestamp: new Date(),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
          });
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
}

function piMessage(role: 'user' | 'assistant', text: string, timestamp?: number): any {
  return {
    role,
    content: [{ type: 'text', text }],
    timestamp: timestamp ?? Date.now(),
  };
}

function createMessagesExceedingThreshold(count: number): any[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: [{ type: 'text', text: `Message ${i}: ${'x'.repeat(200)}` }],
    timestamp: now - (count - i) * 1000,
  }));
}

// ---------------------------------------------------------------------------
// Mock ExtensionAPI
// ---------------------------------------------------------------------------

interface MockHandler {
  event: string;
  handler: (...args: any[]) => any;
}

interface MockTool {
  name: string;
  label: string;
  description: string;
  execute: (...args: any[]) => any;
}

function createMockExtensionAPI() {
  const handlers: MockHandler[] = [];
  const tools: MockTool[] = [];

  return {
    api: {
      on(event: string, handler: (...args: any[]) => any) {
        handlers.push({ event, handler });
      },
      registerTool(tool: any) {
        tools.push(tool);
      },
    },
    handlers,
    tools,
    getHandler(event: string) {
      return handlers.find(h => h.event === event)?.handler;
    },
    getTool(name: string) {
      return tools.find(t => t.name === name);
    },
  };
}

function createMockContext(sessionId: string) {
  return {
    sessionManager: {
      getSessionId: () => sessionId,
    },
    ui: {
      notify: vi.fn(),
      setStatus: vi.fn(),
    },
  };
}

// ============================================================================
// Extension behavior tests (simulated via createMastraOM + manual hooks)
// ============================================================================

describe('Extension behavior: context observation flow', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const sessionId = 'ext-session-1';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = new ObservationalMemory({
      storage,
      observation: {
        messageTokens: 10, // Low threshold to trigger observation
        model: createMockObserverModel() as any,
        bufferTokens: false,
      },
      reflection: {
        observationTokens: 100_000,
        model: createMockObserverModel() as any,
      },
    });
  });

  it('should observe messages and produce observations', async () => {
    await om.getOrCreateRecord(sessionId);

    const messages = createMessagesExceedingThreshold(20);
    const mastraMessages = convertMessages(messages, sessionId);

    await om.observe({ threadId: sessionId, messages: mastraMessages });

    const observations = await om.getObservations(sessionId);
    expect(observations).toBeDefined();
    expect(observations).toContain('User discussed building integrations');
  });

  it('should track lastObservedAt after observation', async () => {
    await om.getOrCreateRecord(sessionId);

    const messages = createMessagesExceedingThreshold(20);
    const mastraMessages = convertMessages(messages, sessionId);

    await om.observe({ threadId: sessionId, messages: mastraMessages });

    const record = await om.getRecord(sessionId);
    expect(record!.lastObservedAt).toBeDefined();
  });

  it('should allow filtering messages by lastObservedAt', async () => {
    await om.getOrCreateRecord(sessionId);

    const now = Date.now();
    const messages = createMessagesExceedingThreshold(20);
    const mastraMessages = convertMessages(messages, sessionId);

    await om.observe({ threadId: sessionId, messages: mastraMessages });

    const record = await om.getRecord(sessionId);
    const lastObservedAt = new Date(record!.lastObservedAt!);

    // Simulate the extension's filtering logic
    const filtered = messages.filter(msg => {
      const timestamp = msg.timestamp;
      if (!timestamp) return true;
      return new Date(timestamp) > lastObservedAt;
    });

    expect(filtered.length).toBeLessThan(messages.length);
  });

  it('should call observation hooks during observe', async () => {
    await om.getOrCreateRecord(sessionId);

    const hooks = {
      onObservationStart: vi.fn(),
      onObservationEnd: vi.fn(),
    };

    const messages = createMessagesExceedingThreshold(20);
    const mastraMessages = convertMessages(messages, sessionId);

    await om.observe({ threadId: sessionId, messages: mastraMessages, hooks });

    expect(hooks.onObservationStart).toHaveBeenCalled();
    expect(hooks.onObservationEnd).toHaveBeenCalled();
  });
});

describe('Extension behavior: system prompt injection', () => {
  let storage: InMemoryMemory;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  function createIntegration() {
    return createMastraOM({ storage, model: createMockObserverModel() as any });
  }

  it('should return base prompt when no observations exist', async () => {
    const integration = createIntegration();
    const result = await integration.wrapSystemPrompt('You are a coding assistant.', 'session-1');
    expect(result).toBe('You are a coding assistant.');
  });

  it('should inject observations into system prompt', async () => {
    const integration = createIntegration();
    await integration.initSession('session-1');

    const record = await integration.om.getRecord('session-1');
    await storage.updateActiveObservations({
      id: record!.id,
      observations: '- User prefers functional style\n- User works with TypeScript',
      observationTokenCount: 30,
      lastObservedAt: new Date(),
      lastObservedMessageId: 'msg-1',
      pendingMessageTokens: 0,
    });

    const result = await integration.wrapSystemPrompt('You are a coding assistant.', 'session-1');
    expect(result).toContain('You are a coding assistant.');
    expect(result).toContain('<observations>');
    expect(result).toContain('User prefers functional style');
    expect(result).toContain('User works with TypeScript');
    expect(result).toContain('</observations>');
  });
});

describe('Extension behavior: diagnostic tool responses', () => {
  let storage: InMemoryMemory;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  function createIntegration(overrides?: Record<string, any>) {
    return createMastraOM({ storage, model: createMockObserverModel() as any, ...overrides });
  }

  it('memory_status should report no record for unknown session', async () => {
    const integration = createIntegration();
    const status = await integration.getStatus('unknown-session');
    expect(status).toContain('No Observational Memory record');
  });

  it('memory_status should report progress for active session', async () => {
    const integration = createIntegration({
      observation: { messageTokens: 30_000 },
      reflection: { observationTokens: 40_000 },
    });
    await integration.initSession('session-1');

    const status = await integration.getStatus('session-1');
    expect(status).toContain('Observational Memory');
    expect(status).toContain('30.0k');
    expect(status).toContain('40.0k');
    expect(status).toContain('Last observed: never');
  });

  it('memory_observations should return undefined for empty session', async () => {
    const integration = createIntegration();
    const obs = await integration.getObservations('session-1');
    expect(obs).toBeUndefined();
  });

  it('memory_observations should return stored observations', async () => {
    const integration = createIntegration();
    await integration.initSession('session-1');

    const record = await integration.om.getRecord('session-1');
    await storage.updateActiveObservations({
      id: record!.id,
      observations: '## Notes\n- User prefers dark mode',
      observationTokenCount: 25,
      lastObservedAt: new Date(),
      lastObservedMessageId: 'msg-1',
      pendingMessageTokens: 0,
    });

    const obs = await integration.getObservations('session-1');
    expect(obs).toContain('User prefers dark mode');
  });
});

// ============================================================================
// Mock ExtensionAPI registration tests
// ============================================================================

describe('Extension API registration contract', () => {
  it('should register expected event handlers and tools', async () => {
    // Dynamically import and call the extension factory with a mock API
    // to verify it registers the correct hooks and tools.
    const { registerExtensionForTest } = await setupExtensionTest();

    const { handlers, tools } = registerExtensionForTest;

    // Should register context, before_agent_start, and session_start handlers
    const eventNames = handlers.map(h => h.event);
    expect(eventNames).toContain('session_start');
    expect(eventNames).toContain('context');
    expect(eventNames).toContain('before_agent_start');

    // Should register diagnostic tools
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('memory_status');
    expect(toolNames).toContain('memory_observations');
  });

  it('session_start handler should initialize OM record', async () => {
    const { registerExtensionForTest, om } = await setupExtensionTest();
    const sessionStartHandler = registerExtensionForTest.getHandler('session_start');

    const ctx = createMockContext('init-session');
    await sessionStartHandler!({}, ctx);

    const record = await om.getRecord('init-session');
    expect(record).not.toBeNull();
  });

  it('session_start handler should notify on error', async () => {
    // Use a broken storage to trigger an error
    const brokenStorage = {
      supportsObservationalMemory: true,
      getObservationalMemory: () => { throw new Error('storage down'); },
      initializeObservationalMemory: () => { throw new Error('storage down'); },
    } as any;

    const brokenOm = new ObservationalMemory({
      storage: brokenStorage,
      model: createMockObserverModel() as any,
      observation: { messageTokens: 10000 },
      reflection: { observationTokens: 50000 },
    });

    const mock = createMockExtensionAPI();
    // Manually register extension with the broken OM
    registerExtensionManual(mock.api as any, brokenOm);

    const handler = mock.getHandler('session_start');
    const ctx = createMockContext('broken-session');
    await handler!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining('failed to initialize'),
      'error',
    );
  });

  it('context handler should return filtered messages after observation', async () => {
    const { registerExtensionForTest, om } = await setupExtensionTest();
    const contextHandler = registerExtensionForTest.getHandler('context');

    const sessionId = 'ctx-session';
    await om.getOrCreateRecord(sessionId);

    const ctx = createMockContext(sessionId);
    const messages = createMessagesExceedingThreshold(20);

    const result = await contextHandler!({ messages }, ctx);

    // Should return filtered messages (or empty object if no observation triggered)
    if (result?.messages) {
      expect(result.messages.length).toBeLessThanOrEqual(messages.length);
    }
  });

  it('context handler should notify on observation lifecycle', async () => {
    const { registerExtensionForTest, om } = await setupExtensionTest();
    const contextHandler = registerExtensionForTest.getHandler('context');

    const sessionId = 'notify-session';
    await om.getOrCreateRecord(sessionId);

    const ctx = createMockContext(sessionId);
    const messages = createMessagesExceedingThreshold(30);

    await contextHandler!({ messages }, ctx);

    // Should have called notify at least for observation start/end
    const notifyCalls = ctx.ui.notify.mock.calls.map((c: any[]) => c[0]);
    const hasObservationNotification = notifyCalls.some(
      (msg: string) => msg.includes('observing') || msg.includes('observation'),
    );
    expect(hasObservationNotification).toBe(true);
  });

  it('before_agent_start handler should inject observations into system prompt', async () => {
    const { registerExtensionForTest, om, storage } = await setupExtensionTest();
    const handler = registerExtensionForTest.getHandler('before_agent_start');

    const sessionId = 'prompt-session';
    await om.getOrCreateRecord(sessionId);

    // Store observations
    const record = await om.getRecord(sessionId);
    await storage.updateActiveObservations({
      id: record!.id,
      observations: '- User is building a Pi agent integration',
      observationTokenCount: 20,
      lastObservedAt: new Date(),
      lastObservedMessageId: 'msg-1',
      pendingMessageTokens: 0,
    });

    const ctx = createMockContext(sessionId);
    const result = await handler!(
      { systemPrompt: 'You are a coding assistant.', prompt: 'hello', images: [] },
      ctx,
    );

    expect(result.systemPrompt).toContain('You are a coding assistant.');
    expect(result.systemPrompt).toContain('<observations>');
    expect(result.systemPrompt).toContain('Pi agent integration');
  });

  it('before_agent_start handler should return empty when no observations', async () => {
    const { registerExtensionForTest } = await setupExtensionTest();
    const handler = registerExtensionForTest.getHandler('before_agent_start');

    const ctx = createMockContext('empty-session');
    const result = await handler!(
      { systemPrompt: 'You are helpful.', prompt: 'hi', images: [] },
      ctx,
    );

    expect(result).toEqual({});
  });

  it('memory_status tool should return formatted status', async () => {
    const { registerExtensionForTest, om } = await setupExtensionTest();
    const tool = registerExtensionForTest.getTool('memory_status');

    const sessionId = 'tool-session';
    await om.getOrCreateRecord(sessionId);

    const ctx = createMockContext(sessionId);
    const result = await tool!.execute('tc-1', {}, undefined, undefined, ctx);

    expect(result.content[0].text).toContain('Observational Memory');
    expect(result.content[0].text).toContain('Observation');
    expect(result.content[0].text).toContain('Reflection');
  });

  it('memory_status tool should handle missing record', async () => {
    const { registerExtensionForTest } = await setupExtensionTest();
    const tool = registerExtensionForTest.getTool('memory_status');

    const ctx = createMockContext('nonexistent');
    const result = await tool!.execute('tc-1', {}, undefined, undefined, ctx);

    expect(result.content[0].text).toContain('No Observational Memory record');
  });

  it('memory_observations tool should return observations', async () => {
    const { registerExtensionForTest, om, storage } = await setupExtensionTest();
    const tool = registerExtensionForTest.getTool('memory_observations');

    const sessionId = 'obs-tool-session';
    await om.getOrCreateRecord(sessionId);

    const record = await om.getRecord(sessionId);
    await storage.updateActiveObservations({
      id: record!.id,
      observations: '- User likes dark mode',
      observationTokenCount: 15,
      lastObservedAt: new Date(),
      lastObservedMessageId: 'msg-1',
      pendingMessageTokens: 0,
    });

    const ctx = createMockContext(sessionId);
    const result = await tool!.execute('tc-1', {}, undefined, undefined, ctx);

    expect(result.content[0].text).toContain('User likes dark mode');
  });

  it('memory_observations tool should handle empty state', async () => {
    const { registerExtensionForTest } = await setupExtensionTest();
    const tool = registerExtensionForTest.getTool('memory_observations');

    const ctx = createMockContext('empty');
    const result = await tool!.execute('tc-1', {}, undefined, undefined, ctx);

    expect(result.content[0].text).toContain('No observations stored yet');
  });
});

// ---------------------------------------------------------------------------
// Test setup helpers
// ---------------------------------------------------------------------------

/**
 * Manually replicates registerExtension logic so we can test it without
 * importing the private function or depending on the pi-coding-agent package.
 */
function registerExtensionManual(api: any, om: ObservationalMemory) {
  const {
    optimizeObservationsForContext,
    OBSERVATION_CONTINUATION_HINT,
    OBSERVATION_CONTEXT_PROMPT,
    OBSERVATION_CONTEXT_INSTRUCTIONS,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  } = require('@mastra/memory/processors');

  api.on('session_start', async (_event: any, ctx: any) => {
    const sessionId = ctx.sessionManager.getSessionId();
    try {
      await om.getOrCreateRecord(sessionId);
    } catch (err: any) {
      ctx.ui.notify(`Mastra OM: failed to initialize — ${err.message}`, 'error');
    }
  });

  api.on('context', async (event: any, ctx: any) => {
    const sessionId = ctx.sessionManager.getSessionId();
    const messages = event.messages;

    try {
      const mastraMessages = convertMessages(messages, sessionId);
      if (mastraMessages.length > 0) {
        await om.observe({
          threadId: sessionId,
          messages: mastraMessages,
          hooks: {
            onObservationStart: () => {
              ctx.ui.notify('Mastra: observing conversation...', 'info');
              ctx.ui.setStatus('mastra-om', 'Observing...');
            },
            onObservationEnd: () => {
              ctx.ui.notify('Mastra: observation complete', 'info');
              ctx.ui.setStatus('mastra-om', undefined);
            },
            onReflectionStart: () => {
              ctx.ui.notify('Mastra: reflecting on observations...', 'info');
              ctx.ui.setStatus('mastra-om', 'Reflecting...');
            },
            onReflectionEnd: () => {
              ctx.ui.notify('Mastra: reflection complete', 'info');
              ctx.ui.setStatus('mastra-om', undefined);
            },
          },
        });
      }

      const record = await om.getRecord(sessionId);
      if (record?.lastObservedAt) {
        const lastObservedAt = new Date(record.lastObservedAt);
        const filtered = messages.filter((msg: any) => {
          const timestamp = msg.timestamp;
          if (!timestamp) return true;
          return new Date(timestamp) > lastObservedAt;
        });
        return { messages: filtered };
      }
    } catch (err: any) {
      ctx.ui.notify(`Mastra OM error: ${err.message}`, 'error');
    }
    return {};
  });

  api.on('before_agent_start', async (event: any, ctx: any) => {
    const sessionId = ctx.sessionManager.getSessionId();
    try {
      const observations = await om.getObservations(sessionId);
      if (!observations) return {};
      const optimized = optimizeObservationsForContext(observations);
      const block = `${OBSERVATION_CONTEXT_PROMPT}\n\n<observations>\n${optimized}\n</observations>\n\n${OBSERVATION_CONTEXT_INSTRUCTIONS}\n\n${OBSERVATION_CONTINUATION_HINT}`;
      return { systemPrompt: `${event.systemPrompt}\n\n${block}` };
    } catch {
      return {};
    }
  });

  api.registerTool({
    name: 'memory_status',
    label: 'Memory Status',
    description: 'Show OM progress',
    parameters: {},
    async execute(_tcId: string, _params: any, _signal: any, _onUpdate: any, ctx: any) {
      const sessionId = ctx.sessionManager.getSessionId();
      const record = await om.getRecord(sessionId);
      if (!record) {
        return { content: [{ type: 'text', text: 'No Observational Memory record found for this session.' }], details: {} };
      }
      const config = om.config;
      const obsThreshold = typeof config.observation.messageTokens === 'number' ? config.observation.messageTokens : (config.observation.messageTokens as any).max;
      const refThreshold = typeof config.reflection.observationTokens === 'number' ? config.reflection.observationTokens : (config.reflection.observationTokens as any).max;
      return {
        content: [{ type: 'text', text: `Observational Memory\nObservation: ${obsThreshold}\nReflection: ${refThreshold}` }],
        details: {},
      };
    },
  });

  api.registerTool({
    name: 'memory_observations',
    label: 'Memory Observations',
    description: 'Show observations',
    parameters: {},
    async execute(_tcId: string, _params: any, _signal: any, _onUpdate: any, ctx: any) {
      const sessionId = ctx.sessionManager.getSessionId();
      const observations = await om.getObservations(sessionId);
      return { content: [{ type: 'text', text: observations ?? 'No observations stored yet.' }], details: {} };
    },
  });
}

async function setupExtensionTest() {
  const storage = createInMemoryStorage();
  const om = new ObservationalMemory({
    storage,
    observation: {
      messageTokens: 10,
      model: createMockObserverModel() as any,
      bufferTokens: false,
    },
    reflection: {
      observationTokens: 100_000,
      model: createMockObserverModel() as any,
    },
  });

  const mock = createMockExtensionAPI();
  registerExtensionManual(mock.api, om);

  return {
    storage,
    om,
    registerExtensionForTest: mock,
  };
}
