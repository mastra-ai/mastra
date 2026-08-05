import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import { LibSQLStore } from '@mastra/libsql';
import { Extractor, Memory, WorkingMemoryExtractor } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

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

  it('updates markdown working memory from an end-to-end LibSQL observation run', async () => {
    const threadId = randomUUID();
    const resourceId = randomUUID();
    const observerOutput = `<observations>
- User shared durable profile details.
</observations>
<working-memory># User Profile
- Name: Tyler
- Location: Seattle
</working-memory>`;
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'obs-wm-1', modelId: 'mock-observer', timestamp: new Date() },
          { type: 'text-start', id: 'text-wm-1' },
          { type: 'text-delta', id: 'text-wm-1', delta: observerOutput },
          { type: 'text-end', id: 'text-wm-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const workingMemory = new Memory({
      storage: memory.storage,
      options: {
        workingMemory: {
          enabled: true,
          template: '# User Profile\n- Name:\n- Location:',
          agentManaged: false,
        },
        observationalMemory: {
          enabled: true,
          observation: {
            model,
            messageTokens: 1,
            bufferTokens: false,
            previousObserverTokens: 1000,
            extract: [new WorkingMemoryExtractor()],
          },
        },
      },
    });

    await workingMemory.createThread({ threadId, resourceId, title: 'Working Memory Markdown' });
    await workingMemory.saveMessages({
      messages: [
        createMessage(
          threadId,
          resourceId,
          'user',
          'My name is Tyler and I live in Seattle.',
          '2026-06-24T18:00:00.000Z',
        ),
      ],
    });

    const omEngine = await workingMemory.omEngine;
    const result = await omEngine!.observe({ threadId, resourceId });

    expect(result.observed).toBe(true);
    await expect(workingMemory.getWorkingMemory({ threadId, resourceId })).resolves.toContain('Name: Tyler');
    await expect(workingMemory.getWorkingMemory({ threadId, resourceId })).resolves.toContain('Location: Seattle');
  });

  it('replaces schema-backed working memory from an end-to-end LibSQL observation run', async () => {
    const threadId = randomUUID();
    const resourceId = randomUUID();
    const observerOutput = `<observations>
- User shared durable schema-backed profile details.
</observations>`;
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'obs-wm-2', modelId: 'mock-observer', timestamp: new Date() },
          { type: 'text-start', id: 'text-wm-2' },
          { type: 'text-delta', id: 'text-wm-2', delta: observerOutput },
          { type: 'text-end', id: 'text-wm-2' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 80, outputTokens: 10, totalTokens: 90 },
        warnings: [],
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 'working-memory': { profile: { location: 'Seattle' }, preferences: ['weather'] } }),
          },
        ],
      }),
    });

    const workingMemory = new Memory({
      storage: memory.storage,
      options: {
        workingMemory: {
          enabled: true,
          schema: z.object({
            profile: z.object({ name: z.string().optional(), location: z.string().optional() }).optional(),
            preferences: z.array(z.string()).optional(),
          }),
          agentManaged: false,
        },
        observationalMemory: {
          enabled: true,
          observation: {
            model,
            messageTokens: 1,
            bufferTokens: false,
            previousObserverTokens: 1000,
            extract: [new WorkingMemoryExtractor()],
          },
        },
      },
    });

    await workingMemory.createThread({ threadId, resourceId, title: 'Working Memory Schema' });
    await workingMemory.updateWorkingMemory({
      threadId,
      resourceId,
      workingMemory: JSON.stringify({ profile: { name: 'Tyler' } }),
    });
    await workingMemory.saveMessages({
      messages: [
        createMessage(
          threadId,
          resourceId,
          'user',
          'I live in Seattle and like weather updates.',
          '2026-06-24T18:05:00.000Z',
        ),
      ],
    });

    const omEngine = await workingMemory.omEngine;
    const result = await omEngine!.observe({ threadId, resourceId });

    expect(result.observed).toBe(true);
    await expect(workingMemory.getWorkingMemory({ threadId, resourceId })).resolves.toBe(
      JSON.stringify({ profile: { location: 'Seattle' }, preferences: ['weather'] }),
    );
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
