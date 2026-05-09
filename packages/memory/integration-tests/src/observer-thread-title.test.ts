import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { google } from '@ai-sdk/google-v5';
import { getLLMTestMode } from '@internal/llm-recorder';
import { setupDummyApiKeys, createGatewayMock } from '@internal/test-utils';
import type { MastraDBMessage } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { transformRequest } from './transform-request';

const RECORDING_NAME = 'memory-integration-tests-src-observer-thread-title';
const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['google']);

const createMessage = (
  id: string,
  threadId: string,
  resourceId: string,
  role: 'user' | 'assistant',
  text: string,
  createdAt: string,
): MastraDBMessage => ({
  id,
  threadId,
  resourceId,
  role,
  createdAt: new Date(createdAt),
  content: {
    format: 2,
    parts: [{ type: 'text', text }],
  },
});

describe('Observer thread title generation', () => {
  let dbDir: string;
  const mock = createGatewayMock({
    name: RECORDING_NAME,
    exactMatch: true,
    transformRequest,
  });

  beforeAll(async () => {
    dbDir = await mkdtemp(join(tmpdir(), 'memory-om-thread-title-'));
    await mock.start();
  });

  afterAll(async () => {
    await rm(dbDir, { recursive: true, force: true });
    await mock.saveAndStop();
  });

  it('should generate and persist a thread title through Memory observational memory', async () => {
    const threadId = randomUUID();
    const resourceId = randomUUID();
    const storage = new LibSQLStore({
      id: randomUUID(),
      url: `file:${join(dbDir, `${threadId}.db`)}`,
    });
    await storage.init();

    const memory = new Memory({
      storage,
      options: {
        observationalMemory: {
          enabled: true,
          observation: {
            model: google('gemini-2.5-flash'),
            messageTokens: 100,
            bufferTokens: false,
            previousObserverTokens: 1000,
            threadTitle: true,
          },
        },
      },
    });

    await memory.createThread({
      threadId,
      resourceId,
      title: 'New Thread',
    });

    await memory.saveMessages({
      messages: [
        createMessage(
          'm1',
          threadId,
          resourceId,
          'user',
          'I am building a React dashboard for our support team. It needs filters, charts, and a ticket queue.',
          '2026-04-02T18:00:00.000Z',
        ),
        createMessage(
          'm2',
          threadId,
          resourceId,
          'assistant',
          "Let's break the dashboard into layout, filtering state, chart summaries, and queue table components.",
          '2026-04-02T18:00:10.000Z',
        ),
        createMessage(
          'm3',
          threadId,
          resourceId,
          'user',
          'Start with the analytics summary cards and the queue table. I also want the thread title to reflect the dashboard work.',
          '2026-04-02T18:00:20.000Z',
        ),
      ],
    });

    const omEngine = await memory.omEngine;
    expect(omEngine).toBeDefined();

    const result = await omEngine!.observe({ threadId, resourceId });
    expect(result.observed).toBe(true);
    expect(result.record.activeObservations.trim().length).toBeGreaterThan(0);

    const updatedThread = await memory.getThreadById({ threadId });
    expect(updatedThread).toBeDefined();
    expect(updatedThread?.title).toBeDefined();
    expect(updatedThread?.title).not.toBe('New Thread');
    expect(updatedThread?.title?.trim().length).toBeGreaterThanOrEqual(3);
    expect(updatedThread?.title).toMatch(/dashboard|support|queue|analytics|react/i);

    const metadata = updatedThread?.metadata as Record<string, any> | undefined;
    expect(metadata?.mastra?.om?.threadTitle).toBe(updatedThread?.title);
  });
});
