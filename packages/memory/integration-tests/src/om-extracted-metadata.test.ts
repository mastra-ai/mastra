import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import { LibSQLStore } from '@mastra/libsql';
import { Extractor, Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const createMessage = (
  threadId: string,
  resourceId: string,
  role: 'user' | 'assistant',
  text: string,
  createdAt: string,
): MastraDBMessage => ({
  id: randomUUID(),
  threadId,
  resourceId,
  role,
  createdAt: new Date(createdAt),
  content: {
    format: 2,
    parts: [{ type: 'text', text }],
  },
});

describe('Observational Memory extracted metadata persistence', () => {
  let dbDir: string;
  let memory: Memory;

  beforeEach(async () => {
    dbDir = await mkdtemp(join(tmpdir(), 'memory-om-extracted-metadata-'));
    const storage = new LibSQLStore({
      id: randomUUID(),
      url: `file:${join(dbDir, 'test.db')}`,
    });
    await storage.init();
    memory = new Memory({ storage });
  });

  afterEach(async () => {
    await rm(dbDir, { recursive: true, force: true });
  });

  it('persists extracted values through LibSQL thread metadata helpers', async () => {
    const threadId = randomUUID();
    const resourceId = randomUUID();
    const now = new Date();

    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Extracted Metadata Thread',
        metadata: setThreadOMMetadata(
          { projectId: 'extractors' },
          {
            currentTask: 'Build extractor API',
            extracted: {
              priority: 'high',
              profile: { tier: 'pro', region: 'us' },
            },
          },
        ),
        createdAt: now,
        updatedAt: now,
      },
    });

    const savedThread = await memory.getThreadById({ threadId });
    const savedMetadata = savedThread?.metadata as Record<string, unknown> | undefined;
    expect(savedMetadata?.projectId).toBe('extractors');
    expect(getThreadOMMetadata(savedMetadata)).toMatchObject({
      currentTask: 'Build extractor API',
      extracted: {
        priority: 'high',
        profile: { tier: 'pro', region: 'us' },
      },
    });

    const savedOm = getThreadOMMetadata(savedMetadata);
    await memory.updateThread({
      id: threadId,
      title: savedThread?.title ?? 'Extracted Metadata Thread',
      metadata: setThreadOMMetadata(savedMetadata, {
        suggestedResponse: 'Continue with docs and tests.',
        extracted: {
          ...(savedOm?.extracted ?? {}),
          priority: 'medium',
          status: 'documented',
        },
      }),
    });

    const updatedThread = await memory.getThreadById({ threadId });
    const updatedMetadata = updatedThread?.metadata as Record<string, unknown> | undefined;
    expect(updatedMetadata?.projectId).toBe('extractors');
    expect(getThreadOMMetadata(updatedMetadata)).toMatchObject({
      currentTask: 'Build extractor API',
      suggestedResponse: 'Continue with docs and tests.',
      extracted: {
        priority: 'medium',
        profile: { tier: 'pro', region: 'us' },
        status: 'documented',
      },
    });
  });

  it('persists extracted values from an end-to-end LibSQL observation run', async () => {
    const threadId = randomUUID();
    const resourceId = randomUUID();
    const observerOutput = `<observations>
- User is prioritizing the extractor API and needs documentation coverage.
</observations>
<priority>high</priority>
<status>documented</status>`;
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'obs-1', modelId: 'mock-observer', timestamp: new Date() },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: observerOutput },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const extractionMemory = new Memory({
      storage: memory.storage,
      options: {
        observationalMemory: {
          enabled: true,
          observation: {
            model,
            messageTokens: 1,
            bufferTokens: false,
            previousObserverTokens: 1000,
            extract: [
              new Extractor({ name: 'Priority', instructions: 'Extract the current priority.' }),
              new Extractor({ name: 'Status', instructions: 'Extract the documentation status.' }),
            ],
          },
        },
      },
    });

    await extractionMemory.createThread({ threadId, resourceId, title: 'Extractor E2E' });
    await extractionMemory.saveMessages({
      messages: [
        createMessage(
          threadId,
          resourceId,
          'user',
          'Priority is high. The extractor documentation status is documented.',
          '2026-06-24T17:00:00.000Z',
        ),
        createMessage(
          threadId,
          resourceId,
          'assistant',
          'I will track priority and profile details in observational memory.',
          '2026-06-24T17:00:05.000Z',
        ),
      ],
    });

    const omEngine = await extractionMemory.omEngine;
    const result = await omEngine!.observe({ threadId, resourceId });

    expect(result.observed).toBe(true);

    const updatedThread = await extractionMemory.getThreadById({ threadId });
    expect(getThreadOMMetadata(updatedThread?.metadata)?.extracted).toMatchObject({
      priority: 'high',
      status: 'documented',
    });
  });
});
