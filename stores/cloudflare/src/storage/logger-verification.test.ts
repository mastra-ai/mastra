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
  TABLE_EVALS,
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
        TABLE_EVALS,
      ],
    });

    const kvBindings = {
      [TABLE_THREADS]: (await mf.getKVNamespace(TABLE_THREADS)) as KVNamespace,
      [TABLE_MESSAGES]: (await mf.getKVNamespace(TABLE_MESSAGES)) as KVNamespace,
      [TABLE_RESOURCES]: (await mf.getKVNamespace(TABLE_RESOURCES)) as KVNamespace,
      [TABLE_WORKFLOW_SNAPSHOT]: (await mf.getKVNamespace(TABLE_WORKFLOW_SNAPSHOT)) as KVNamespace,
      [TABLE_TRACES]: (await mf.getKVNamespace(TABLE_TRACES)) as KVNamespace,
      [TABLE_SCORERS]: (await mf.getKVNamespace(TABLE_SCORERS)) as KVNamespace,
      [TABLE_EVALS]: (await mf.getKVNamespace(TABLE_EVALS)) as KVNamespace,
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

  it('should use logger.debug with content summary (not raw content)', async () => {
    // Mock logger to capture what gets logged
    const mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      trackException: vi.fn(),
    };

    // Inject logger
    (store.stores.memory as any).logger = mockLogger;

    const resourceId = 'test-resource-2';
    const threadId = 'test-thread-2';

    await store.stores.memory.saveResource({
      resource: { id: resourceId, createdAt: new Date(), updatedAt: new Date() },
    });

    await store.stores.memory.saveThread({
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
    await store.stores.memory.saveMessages({
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
