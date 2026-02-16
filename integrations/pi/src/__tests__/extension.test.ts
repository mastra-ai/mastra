import type { InMemoryMemory } from '@mastra/core/storage';
import { ObservationalMemory } from '@mastra/memory/processors';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { convertMessages, createMastraOM, type MastraOMIntegration } from '../index.js';
import { registerExtension } from '../extension.js';

import {
  createInMemoryStorage,
  createMockObserverModel,
  piMessage,
  createMessagesExceedingThreshold,
  createMockExtensionAPI,
  createMockContext,
} from './helpers.js';

/**
 * These tests exercise the extension's `registerExtension` logic directly
 * by passing a mock ExtensionAPI and verifying hooks + tools.
 */

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

    const messages = createMessagesExceedingThreshold(20);
    const mastraMessages = convertMessages(messages, sessionId);

    await om.observe({ threadId: sessionId, messages: mastraMessages });

    const record = await om.getRecord(sessionId);
    const lastObservedAt = new Date(record!.lastObservedAt!);

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
// Mock ExtensionAPI registration tests — using real registerExtension
// ============================================================================

describe('Extension API registration contract', () => {
  function setupExtensionTest() {
    const storage = createInMemoryStorage();
    const integration = createMastraOM({
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
    registerExtension(mock.api as any, integration);

    return { storage, integration, om: integration.om, mock };
  }

  it('should register expected event handlers and tools', () => {
    const { mock } = setupExtensionTest();

    const eventNames = mock.handlers.map(h => h.event);
    expect(eventNames).toContain('session_start');
    expect(eventNames).toContain('context');
    expect(eventNames).toContain('before_agent_start');

    const toolNames = mock.tools.map(t => t.name);
    expect(toolNames).toContain('memory_status');
    expect(toolNames).toContain('memory_observations');
  });

  it('session_start handler should initialize OM record', async () => {
    const { mock, om } = setupExtensionTest();
    const sessionStartHandler = mock.getHandler('session_start');

    const ctx = createMockContext('init-session');
    await sessionStartHandler!({}, ctx);

    const record = await om.getRecord('init-session');
    expect(record).not.toBeNull();
  });

  it('session_start handler should notify on error', async () => {
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

    // Build a minimal integration wrapping the broken OM
    const brokenIntegration: MastraOMIntegration = {
      om: brokenOm,
      createTransformContext: () => async (msgs: any) => msgs,
      getSystemPromptBlock: async () => '',
      wrapSystemPrompt: async (p: string) => p,
      getStatus: async () => 'error',
      getObservations: async () => undefined,
      initSession: async () => { await brokenOm.getOrCreateRecord('x'); },
    };

    const mock = createMockExtensionAPI();
    registerExtension(mock.api as any, brokenIntegration);

    const handler = mock.getHandler('session_start');
    const ctx = createMockContext('broken-session');
    await handler!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining('failed to initialize'),
      'error',
    );
  });

  it('context handler should return filtered messages after observation', async () => {
    const { mock, om } = setupExtensionTest();
    const contextHandler = mock.getHandler('context');

    const sessionId = 'ctx-session';
    await om.getOrCreateRecord(sessionId);

    const ctx = createMockContext(sessionId);
    const messages = createMessagesExceedingThreshold(20);

    const result = await contextHandler!({ messages }, ctx);

    // With a 10-token threshold and 20 large messages, observation should
    // trigger — assert that filtering was applied (messages property exists)
    // and the result count is strictly less than the input count.
    expect(result).toHaveProperty('messages');
    expect(Array.isArray(result.messages)).toBe(true);
    expect(result.messages.length).toBeLessThan(messages.length);
  });

  it('context handler should notify on observation lifecycle', async () => {
    const { mock, om } = setupExtensionTest();
    const contextHandler = mock.getHandler('context');

    const sessionId = 'notify-session';
    await om.getOrCreateRecord(sessionId);

    const ctx = createMockContext(sessionId);
    const messages = createMessagesExceedingThreshold(30);

    await contextHandler!({ messages }, ctx);

    const notifyCalls = ctx.ui.notify.mock.calls.map((c: any[]) => c[0]);
    const hasObservationNotification = notifyCalls.some(
      (msg: string) => msg.includes('observing') || msg.includes('observation'),
    );
    expect(hasObservationNotification).toBe(true);
  });

  it('before_agent_start handler should inject observations into system prompt', async () => {
    const { mock, om, storage } = setupExtensionTest();
    const handler = mock.getHandler('before_agent_start');

    const sessionId = 'prompt-session';
    await om.getOrCreateRecord(sessionId);

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
    const { mock } = setupExtensionTest();
    const handler = mock.getHandler('before_agent_start');

    const ctx = createMockContext('empty-session');
    const result = await handler!(
      { systemPrompt: 'You are helpful.', prompt: 'hi', images: [] },
      ctx,
    );

    expect(result).toEqual({});
  });

  it('memory_status tool should return formatted status', async () => {
    const { mock, om } = setupExtensionTest();
    const tool = mock.getTool('memory_status');

    const sessionId = 'tool-session';
    await om.getOrCreateRecord(sessionId);

    const ctx = createMockContext(sessionId);
    const result = await tool!.execute('tc-1', {}, undefined, undefined, ctx);

    expect(result.content[0].text).toContain('Observational Memory');
    expect(result.content[0].text).toContain('Observation');
    expect(result.content[0].text).toContain('Reflection');
  });

  it('memory_status tool should handle missing record', async () => {
    const { mock } = setupExtensionTest();
    const tool = mock.getTool('memory_status');

    const ctx = createMockContext('nonexistent');
    const result = await tool!.execute('tc-1', {}, undefined, undefined, ctx);

    expect(result.content[0].text).toContain('No Observational Memory record');
  });

  it('memory_observations tool should return observations', async () => {
    const { mock, om, storage } = setupExtensionTest();
    const tool = mock.getTool('memory_observations');

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
    const { mock } = setupExtensionTest();
    const tool = mock.getTool('memory_observations');

    const ctx = createMockContext('empty');
    const result = await tool!.execute('tc-1', {}, undefined, undefined, ctx);

    expect(result.content[0].text).toContain('No observations stored yet');
  });
});
