/**
 * Simple verification test to ensure no console.log and logger is used correctly
 */
import type { KVNamespace } from '@cloudflare/workers-types';
import {
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import { Miniflare } from 'miniflare';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudflareWorkersConfig } from './types';
import { CloudflareStore } from './index';

describe('Logger Verification - No PII Leakage', () => {
  let mf: Miniflare;
  let store: CloudflareStore;

  beforeEach(async () => {
    mf = new Miniflare({
      script: 'export default {};',
      modules: true,
      kvNamespaces: [
        TABLE_THREADS,
        TABLE_MESSAGES,
        TABLE_RESOURCES,
        TABLE_WORKFLOW_SNAPSHOT,
        TABLE_TRACES,
        TABLE_SCORERS,
      ],
    });

    const kvBindings = {
      [TABLE_THREADS]: (await mf.getKVNamespace(TABLE_THREADS)) as KVNamespace,
      [TABLE_MESSAGES]: (await mf.getKVNamespace(TABLE_MESSAGES)) as KVNamespace,
      [TABLE_RESOURCES]: (await mf.getKVNamespace(TABLE_RESOURCES)) as KVNamespace,
      [TABLE_WORKFLOW_SNAPSHOT]: (await mf.getKVNamespace(TABLE_WORKFLOW_SNAPSHOT)) as KVNamespace,
      [TABLE_TRACES]: (await mf.getKVNamespace(TABLE_TRACES)) as KVNamespace,
      [TABLE_SCORERS]: (await mf.getKVNamespace(TABLE_SCORERS)) as KVNamespace,
    };

    const config: CloudflareWorkersConfig = {
      id: 'logger-test',
      bindings: kvBindings as any,
      keyPrefix: 'test',
    };

    store = new CloudflareStore(config);
  });

  afterEach(async () => {
    await mf.dispose();
  });

  it('should NOT use console.log anywhere', async () => {
    // Spy on console methods
    const consoleLogSpy = vi.spyOn(console, 'log');
    const consoleInfoSpy = vi.spyOn(console, 'info');

    const resourceId = 'test-resource';
    const threadId = 'test-thread';

    // Create resource and thread
    const memoryStore = await store.getStore('memory');
    expect(memoryStore).toBeDefined();
    await memoryStore?.saveResource({
      resource: { id: resourceId, createdAt: new Date(), updatedAt: new Date() },
    });

    await memoryStore?.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Save message with SENSITIVE content
    const SENSITIVE_DATA = 'SSN: 123-45-6789, Password: secret123';
    await memoryStore?.saveMessages({
      messages: [
        {
          id: 'msg-1',
          threadId,
          resourceId,
          role: 'user',
          content: [{ type: 'text' as const, text: SENSITIVE_DATA }],
          createdAt: new Date(),
          type: 'v2',
        },
      ],
    });

    // Retrieve messages
    await memoryStore?.listMessages({ threadId, resourceId });

    // CRITICAL: Verify NO console.log/info was called
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();

    // CRITICAL: Verify SENSITIVE_DATA never appeared in any console output
    const allConsoleCalls = [...consoleLogSpy.mock.calls, ...consoleInfoSpy.mock.calls].flat();

    const hasLeakedPII = allConsoleCalls.some(
      arg => String(arg).includes('123-45-6789') || String(arg).includes('secret123'),
    );

    expect(hasLeakedPII).toBe(false);

    consoleLogSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  it('should use logger.debug with content summary (not raw content)', async () => {
    // Mock logger to capture what gets logged
    const mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      trackException: vi.fn(),
    };

    const resourceId = 'test-resource-2';
    const threadId = 'test-thread-2';

    const memoryStore = await store.getStore('memory');
    // Inject logger
    expect(memoryStore).toBeDefined();
    (memoryStore as any).logger = mockLogger;

    await memoryStore?.saveResource({
      resource: { id: resourceId, createdAt: new Date(), updatedAt: new Date() },
    });

    await memoryStore?.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Save message with SENSITIVE content
    const SENSITIVE_DATA = 'Credit Card: 4532-1234-5678-9010';
    await memoryStore?.saveMessages({
      messages: [
        {
          id: 'msg-2',
          threadId,
          resourceId,
          role: 'user',
          content: [{ type: 'text' as const, text: SENSITIVE_DATA }],
          createdAt: new Date(),
          type: 'v2',
        },
      ],
    });

    // Verify logger.debug WAS called
    expect(mockLogger.debug).toHaveBeenCalled();

    // Verify it was called with contentSummary, NOT raw content
    const debugCalls = mockLogger.debug.mock.calls;
    const saveCall = debugCalls.find((call: any) => call[0]?.includes('Saving message'));

    expect(saveCall).toBeDefined();
    expect(saveCall?.[1]).toHaveProperty('contentSummary');
    expect(saveCall?.[1].contentSummary).toHaveProperty('type');

    // CRITICAL: Verify NO sensitive data in logger calls
    const allLoggerCalls = JSON.stringify(debugCalls);
    expect(allLoggerCalls).not.toContain('4532-1234-5678-9010');
    expect(allLoggerCalls).not.toContain('Credit Card');
  });
});
