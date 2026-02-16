import type { InMemoryMemory } from '@mastra/core/storage';
import { ObservationalMemory } from '@mastra/memory/processors';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  convertMessages,
  createMastraOM,
  loadConfig,
  progressBar,
  formatTokens,
  resolveThreshold,
  type CreateMastraOMOptions,
} from '../index.js';

import {
  createInMemoryStorage,
  createMockObserverModel,
  piMessage,
  createMessagesExceedingThreshold,
} from './helpers.js';

// ============================================================================
// convertMessages
// ============================================================================

describe('convertMessages', () => {
  const sessionId = 'test-session';

  it('should convert a simple text user message', () => {
    const messages = [piMessage('user', 'Hello world')];
    const result = convertMessages(messages, sessionId);

    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe('user');
    expect(result[0]!.threadId).toBe(sessionId);
    expect(result[0]!.resourceId).toBe(sessionId);
    expect(result[0]!.content.format).toBe(2);
    expect(result[0]!.content.parts).toEqual([{ type: 'text', text: 'Hello world' }]);
  });

  it('should convert assistant messages', () => {
    const messages = [piMessage('assistant', 'I can help with that.')];
    const result = convertMessages(messages, sessionId);

    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe('assistant');
  });

  it('should filter out toolResult messages', () => {
    const messages = [
      { role: 'toolResult', content: [{ type: 'text', text: 'result' }], timestamp: Date.now() },
    ];
    const result = convertMessages(messages as any, sessionId);
    expect(result).toHaveLength(0);
  });

  it('should handle string content (Pi user shorthand)', () => {
    const messages = [{ role: 'user', content: 'plain string', timestamp: Date.now() }];
    const result = convertMessages(messages as any, sessionId);

    expect(result).toHaveLength(1);
    expect(result[0]!.content.parts).toEqual([{ type: 'text', text: 'plain string' }]);
  });

  it('should convert toolCall content parts', () => {
    const messages = [
      {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            toolCallId: 'tc-1',
            name: 'read_file',
            args: { path: '/foo.txt' },
          },
        ],
        timestamp: Date.now(),
      },
    ];
    const result = convertMessages(messages as any, sessionId);

    expect(result).toHaveLength(1);
    const part = result[0]!.content.parts[0] as any;
    expect(part.type).toBe('tool-invocation');
    expect(part.toolInvocation.toolCallId).toBe('tc-1');
    expect(part.toolInvocation.toolName).toBe('read_file');
    expect(part.toolInvocation.args).toEqual({ path: '/foo.txt' });
  });

  it('should convert image content parts', () => {
    const messages = [
      {
        role: 'user',
        content: [{ type: 'image', data: 'base64data' }],
        timestamp: Date.now(),
      },
    ];
    const result = convertMessages(messages as any, sessionId);

    expect(result).toHaveLength(1);
    expect(result[0]!.content.parts[0]).toEqual({ type: 'image', image: 'base64data' });
  });

  it('should convert thinking content parts to reasoning', () => {
    const messages = [
      {
        role: 'assistant',
        content: [{ type: 'thinking', thinking: 'Let me think...' }],
        timestamp: Date.now(),
      },
    ];
    const result = convertMessages(messages as any, sessionId);

    expect(result).toHaveLength(1);
    expect(result[0]!.content.parts[0]).toEqual({ type: 'reasoning', reasoning: 'Let me think...' });
  });

  it('should skip messages with empty content', () => {
    const messages = [{ role: 'user', content: [], timestamp: Date.now() }];
    const result = convertMessages(messages as any, sessionId);
    expect(result).toHaveLength(0);
  });

  it('should skip messages with no content', () => {
    const messages = [{ role: 'user', timestamp: Date.now() }];
    const result = convertMessages(messages as any, sessionId);
    expect(result).toHaveLength(0);
  });

  it('should handle mixed content parts, skipping unknown types', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'hello' },
          { type: 'unknown_widget', data: {} },
          { type: 'image', data: 'img' },
        ],
        timestamp: Date.now(),
      },
    ];
    const result = convertMessages(messages as any, sessionId);

    expect(result).toHaveLength(1);
    expect(result[0]!.content.parts).toHaveLength(2);
    expect(result[0]!.content.parts[0]).toEqual({ type: 'text', text: 'hello' });
    expect(result[0]!.content.parts[1]).toEqual({ type: 'image', image: 'img' });
  });

  it('should use message timestamp for createdAt', () => {
    const ts = new Date('2026-01-15T12:00:00Z').getTime();
    const messages = [piMessage('user', 'hello', ts)];
    const result = convertMessages(messages, sessionId);

    expect(result[0]!.createdAt).toEqual(new Date(ts));
  });

  it('should convert multiple messages preserving order', () => {
    const now = Date.now();
    const messages = [
      piMessage('user', 'first', now - 2000),
      piMessage('assistant', 'second', now - 1000),
      piMessage('user', 'third', now),
    ];
    const result = convertMessages(messages, sessionId);

    expect(result).toHaveLength(3);
    expect(result[0]!.content.parts[0]).toEqual({ type: 'text', text: 'first' });
    expect(result[1]!.content.parts[0]).toEqual({ type: 'text', text: 'second' });
    expect(result[2]!.content.parts[0]).toEqual({ type: 'text', text: 'third' });
  });
});

// ============================================================================
// createMastraOM
// ============================================================================

describe('createMastraOM', () => {
  let storage: InMemoryMemory;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  /** Helper: create integration with a mock model (OM requires a model). */
  function createIntegration(overrides?: Partial<CreateMastraOMOptions>) {
    return createMastraOM({
      storage,
      model: createMockObserverModel() as any,
      ...overrides,
    });
  }

  it('should create an integration with all expected methods', () => {
    const integration = createIntegration();

    expect(integration.om).toBeInstanceOf(ObservationalMemory);
    expect(typeof integration.createTransformContext).toBe('function');
    expect(typeof integration.getSystemPromptBlock).toBe('function');
    expect(typeof integration.wrapSystemPrompt).toBe('function');
    expect(typeof integration.getStatus).toBe('function');
    expect(typeof integration.getObservations).toBe('function');
    expect(typeof integration.initSession).toBe('function');
  });

  it('should accept custom model and observation config', () => {
    const integration = createIntegration({
      observation: { messageTokens: 50_000 },
      reflection: { observationTokens: 100_000 },
    });

    expect(integration.om).toBeInstanceOf(ObservationalMemory);
    const config = integration.om.config;
    expect(resolveThreshold(config.observation.messageTokens)).toBe(50_000);
    expect(resolveThreshold(config.reflection.observationTokens)).toBe(100_000);
  });

  it('should accept scope and shareTokenBudget options', () => {
    const integration = createIntegration({
      scope: 'resource',
      shareTokenBudget: true,
    });

    expect(integration.om.config.scope).toBe('resource');
  });

  describe('initSession', () => {
    it('should create an OM record for a new session', async () => {
      const integration = createIntegration();
      await integration.initSession({ sessionId: 'session-1' });

      const record = await integration.om.getRecord('session-1');
      expect(record).not.toBeNull();
      expect(record!.scope).toBe('thread');
    });

    it('should be idempotent', async () => {
      const integration = createIntegration();
      await integration.initSession({ sessionId: 'session-1' });
      await integration.initSession({ sessionId: 'session-1' });

      const record = await integration.om.getRecord('session-1');
      expect(record).not.toBeNull();
    });
  });

  describe('getObservations', () => {
    it('should return undefined when no observations exist', async () => {
      const integration = createIntegration();
      const result = await integration.getObservations({ sessionId: 'session-1' });
      expect(result).toBeUndefined();
    });

    it('should return observations after they are stored', async () => {
      const integration = createIntegration();
      await integration.initSession({ sessionId: 'session-1' });

      // Manually set observations via storage
      const record = await integration.om.getRecord('session-1');
      await storage.updateActiveObservations({
        id: record!.id,
        observations: '## Observations\n- User likes TypeScript',
        observationTokenCount: 50,
        lastObservedAt: new Date(),
        lastObservedMessageId: 'msg-1',
        pendingMessageTokens: 0,
      });

      const result = await integration.getObservations({ sessionId: 'session-1' });
      expect(result).toContain('User likes TypeScript');
    });
  });

  describe('getSystemPromptBlock', () => {
    it('should return empty string when no observations exist', async () => {
      const integration = createIntegration();
      const block = await integration.getSystemPromptBlock({ sessionId: 'session-1' });
      expect(block).toBe('');
    });

    it('should return formatted block with observations', async () => {
      const integration = createIntegration();
      await integration.initSession({ sessionId: 'session-1' });

      const record = await integration.om.getRecord('session-1');
      await storage.updateActiveObservations({
        id: record!.id,
        observations: '## Observations\n- User prefers Postgres',
        observationTokenCount: 40,
        lastObservedAt: new Date(),
        lastObservedMessageId: 'msg-1',
        pendingMessageTokens: 0,
      });

      const block = await integration.getSystemPromptBlock({ sessionId: 'session-1' });
      expect(block).toContain('<observations>');
      expect(block).toContain('</observations>');
      expect(block).toContain('User prefers Postgres');
      expect(block).toContain('observations block contains your memory');
    });
  });

  describe('wrapSystemPrompt', () => {
    it('should return base prompt unchanged when no observations', async () => {
      const integration = createIntegration();
      const result = await integration.wrapSystemPrompt({ basePrompt: 'You are helpful.', sessionId: 'session-1' });
      expect(result).toBe('You are helpful.');
    });

    it('should append observations to base prompt', async () => {
      const integration = createIntegration();
      await integration.initSession({ sessionId: 'session-1' });

      const record = await integration.om.getRecord('session-1');
      await storage.updateActiveObservations({
        id: record!.id,
        observations: '- User likes tests',
        observationTokenCount: 20,
        lastObservedAt: new Date(),
        lastObservedMessageId: 'msg-1',
        pendingMessageTokens: 0,
      });

      const result = await integration.wrapSystemPrompt({ basePrompt: 'You are helpful.', sessionId: 'session-1' });
      expect(result).toContain('You are helpful.');
      expect(result).toContain('<observations>');
      expect(result).toContain('User likes tests');
    });
  });

  describe('getStatus', () => {
    it('should return "no record" when session is not initialized', async () => {
      const integration = createIntegration();
      const status = await integration.getStatus({ sessionId: 'no-such-session' });
      expect(status).toContain('No Observational Memory record');
    });

    it('should return formatted status for initialized session', async () => {
      const integration = createIntegration();
      await integration.initSession({ sessionId: 'session-1' });

      const status = await integration.getStatus({ sessionId: 'session-1' });
      expect(status).toContain('Observational Memory');
      expect(status).toContain('Observation');
      expect(status).toContain('Reflection');
      expect(status).toContain('Last observed: never');
    });
  });

  describe('createTransformContext', () => {
    it('should return a function', () => {
      const integration = createIntegration();
      const transform = integration.createTransformContext({ sessionId: 'session-1' });
      expect(typeof transform).toBe('function');
    });

    it('should pass through messages when below threshold', async () => {
      const integration = createMastraOM({
        storage,
        observation: {
          messageTokens: 100_000,
          model: createMockObserverModel() as any,
          bufferTokens: false,
        },
        reflection: {
          observationTokens: 100_000,
          model: createMockObserverModel() as any,
        },
      });
      await integration.initSession({ sessionId: 'session-1' });

      const transform = integration.createTransformContext({ sessionId: 'session-1' });
      const messages = [piMessage('user', 'hello'), piMessage('assistant', 'hi')];

      const result = await transform(messages);
      expect(result).toHaveLength(2);
    });

    it('should invoke observation hooks when provided', async () => {
      const hooks = {
        onObservationStart: vi.fn(),
        onObservationEnd: vi.fn(),
      };

      const integration = createMastraOM({
        storage,
        observation: {
          messageTokens: 10, // Very low threshold
          model: createMockObserverModel() as any,
          bufferTokens: false,
        },
        reflection: {
          observationTokens: 100_000,
          model: createMockObserverModel() as any,
        },
      });
      await integration.initSession({ sessionId: 'session-1' });

      const transform = integration.createTransformContext({ sessionId: 'session-1', hooks });
      const messages = createMessagesExceedingThreshold(20);
      await transform(messages);

      expect(hooks.onObservationStart).toHaveBeenCalled();
      expect(hooks.onObservationEnd).toHaveBeenCalled();
    });

    it('should filter out observed messages after observation triggers', async () => {
      const integration = createMastraOM({
        storage,
        observation: {
          messageTokens: 10, // Very low threshold to trigger observation
          model: createMockObserverModel() as any,
          bufferTokens: false,
        },
        reflection: {
          observationTokens: 100_000,
          model: createMockObserverModel() as any,
        },
      });
      await integration.initSession({ sessionId: 'session-1' });

      const transform = integration.createTransformContext({ sessionId: 'session-1' });
      const messages = createMessagesExceedingThreshold(20);

      const result = await transform(messages);
      // After observation, older messages should be filtered out
      expect(result.length).toBeLessThan(messages.length);
    });
  });
});

// ============================================================================
// loadConfig
// ============================================================================

describe('loadConfig', () => {
  it('should return empty object for missing config file', async () => {
    const config = await loadConfig('/nonexistent/path');
    expect(config).toEqual({});
  });
});

// ============================================================================
// Formatting helpers
// ============================================================================

describe('formatting helpers', () => {
  describe('progressBar', () => {
    it('should show empty bar at 0%', () => {
      const bar = progressBar(0, 100);
      expect(bar).toContain('0.0%');
      expect(bar).toContain('░'.repeat(20));
    });

    it('should show full bar at 100%', () => {
      const bar = progressBar(100, 100);
      expect(bar).toContain('100.0%');
      expect(bar).toContain('█'.repeat(20));
    });

    it('should show half bar at 50%', () => {
      const bar = progressBar(50, 100);
      expect(bar).toContain('50.0%');
    });

    it('should clamp at 100% when over', () => {
      const bar = progressBar(200, 100);
      expect(bar).toContain('100.0%');
    });

    it('should handle zero total', () => {
      const bar = progressBar(0, 0);
      expect(bar).toContain('0.0%');
    });
  });

  describe('formatTokens', () => {
    it('should format small numbers as-is', () => {
      expect(formatTokens(500)).toBe('500');
    });

    it('should format thousands with k suffix', () => {
      expect(formatTokens(1000)).toBe('1.0k');
      expect(formatTokens(30000)).toBe('30.0k');
    });

    it('should handle 999', () => {
      expect(formatTokens(999)).toBe('999');
    });
  });

  describe('resolveThreshold', () => {
    it('should return number directly', () => {
      expect(resolveThreshold(5000)).toBe(5000);
    });

    it('should return max from range object', () => {
      expect(resolveThreshold({ min: 1000, max: 5000 })).toBe(5000);
    });
  });
});
