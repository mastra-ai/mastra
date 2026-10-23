/**
 * Thread history + topic trimming for Inngest agents in serve topology.
 *
 * A completed durable run's parts must be trimmed from the thread topic once
 * its messages are saved, and a subscriber that joins afterwards with
 * `withInitialHistory` must get the run from storage exactly once — not again
 * as replayed live parts.
 */
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Agent } from '@mastra/core/agent';
import { PubSub } from '@mastra/core/events';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { simulateReadableStream } from 'ai';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createInngestAgent } from '../durable-agent';
import {
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 150_000, hookTimeout: 90_000 });

const dbUrl = pathToFileURL(path.join(tmpdir(), `mastra-thread-history-serve-${Date.now()}.db`)).href;

function mockModel(): any {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'thread-history-serve-model',
    supportedUrls: {},
    async doGenerate() {
      throw new Error('not used');
    },
    async doStream() {
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'r1', modelId: 'thread-history-serve-model', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'stored once' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

describe('Inngest agent thread history (serve topology)', () => {
  beforeAll(async () => {
    await setupSharedTestInfrastructure();
  });

  afterAll(async () => {
    await teardownSharedTestInfrastructure();
  });

  it('trims a completed run from the thread topic and serves it from history once', async () => {
    const suffix = Date.now();
    const threadId = `thread-history-serve-thread-${suffix}`;
    const resourceId = `thread-history-serve-resource-${suffix}`;
    const trimSpy = vi.spyOn(PubSub.prototype, 'trimTopic');

    const storage = new DefaultStorage({ id: `thread-history-serve-${suffix}`, url: dbUrl });
    const agent = new Agent({
      id: `thread-history-serve-agent-${suffix}`,
      name: 'Thread History Serve Agent',
      instructions: 'Reply briefly.',
      model: mockModel(),
      memory: new Memory({ storage }),
    });
    const inngestAgent = createInngestAgent({ agent, inngest: getSharedInngest() });
    getSharedMastra().addAgent(inngestAgent);

    const result = await inngestAgent.stream([{ role: 'user', content: 'hi' }], {
      memory: { thread: threadId, resource: resourceId },
    });
    try {
      for await (const _ of result.output.fullStream) {
        // drain
      }
    } finally {
      result.cleanup();
    }

    const threadTrims = () =>
      trimSpy.mock.calls.filter(
        ([topic, options]) => topic.includes(encodeURIComponent(threadId)) && options.runId === result.runId,
      );
    await vi.waitFor(() => expect(threadTrims().length).toBeGreaterThan(0), { timeout: 15_000 });

    const subscription = await inngestAgent.subscribeToThread({
      resourceId,
      threadId,
      withInitialHistory: { perPage: 20 },
    } as any);
    const chunks: any[] = [];
    const reader = (async () => {
      for await (const chunk of subscription.stream as AsyncIterable<any>) chunks.push(chunk);
    })();
    await vi.waitFor(() => expect(chunks.some(chunk => chunk.type === 'thread-history')).toBe(true), {
      timeout: 15_000,
    });
    await new Promise(resolve => setTimeout(resolve, 1_000));
    subscription.unsubscribe();
    await reader.catch(() => undefined);

    const history = chunks.find(chunk => chunk.type === 'thread-history');
    const historyText = history.payload.messages
      .filter((message: any) => message.role === 'assistant')
      .flatMap((message: any) => message.content.parts)
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('');
    expect(historyText).toBe('stored once');
    expect(chunks.filter(chunk => chunk.type === 'text-delta')).toEqual([]);
    trimSpy.mockRestore();
  });
});
