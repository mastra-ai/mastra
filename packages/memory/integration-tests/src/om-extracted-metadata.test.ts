import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

  it('persists extracted values in LibSQL thread metadata', async () => {
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
});
