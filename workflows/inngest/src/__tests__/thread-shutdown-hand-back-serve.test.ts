/**
 * #30480 for Inngest agents in serve topology: the thread runtime registers an
 * Inngest run under the Inngest agent proxy, so the run-completed event it
 * publishes when shutdown hands the run back must carry `status: 'interrupted'`
 * (followers map that to `thread-run-status: interrupted`), not a bare
 * run-completed that followers read as `failed`.
 *
 * Shutdown also closes this process's own subscriptions, so the test reads the
 * event off the pubsub the run publishes to rather than from a local follower.
 */
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Agent } from '@mastra/core/agent';
import { EventEmitterPubSub } from '@mastra/core/events';
import { DefaultStorage } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createInngestAgent } from '../durable-agent';
import {
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 150_000, hookTimeout: 90_000 });

const originalPublish = EventEmitterPubSub.prototype.publish;
const dbUrl = pathToFileURL(path.join(tmpdir(), `mastra-shutdown-hand-back-serve-${Date.now()}.db`)).href;

/** Streams one text delta, then hangs until aborted, like a model call cut off by a rolling restart. */
function hangingModel(): any {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'shutdown-hand-back-model',
    supportedUrls: {},
    async doGenerate() {
      throw new Error('not used');
    },
    async doStream({ abortSignal }: { abortSignal?: AbortSignal }) {
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'working' });
            abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason ?? new Error('aborted')));
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

describe('Inngest agent run handed back at shutdown (serve topology)', () => {
  beforeAll(async () => {
    await setupSharedTestInfrastructure();
  });

  afterAll(async () => {
    await teardownSharedTestInfrastructure({ forceClose: true });
  });

  it('publishes a handed-back run as interrupted, not as a bare run-completed', async () => {
    const suffix = Date.now();
    const threadId = `shutdown-hand-back-thread-${suffix}`;
    const resourceId = `shutdown-hand-back-resource-${suffix}`;
    const storage = new DefaultStorage({ id: `shutdown-hand-back-${suffix}`, url: dbUrl });
    const agent = new Agent({
      id: `shutdown-hand-back-agent-${suffix}`,
      name: 'Shutdown Hand Back Agent',
      instructions: 'Reply briefly.',
      model: hangingModel(),
      memory: new Memory({ storage }),
    });
    const inngestAgent = createInngestAgent({ agent, inngest: getSharedInngest() });
    getSharedMastra().addAgent(inngestAgent);

    const published: any[] = [];
    const publish = vi.spyOn(EventEmitterPubSub.prototype, 'publish').mockImplementation(function (
      this: EventEmitterPubSub,
      ...args
    ) {
      published.push(args[1]);
      return originalPublish.apply(this, args);
    });

    const result = await inngestAgent.stream([{ role: 'user', content: 'hi' }], {
      memory: { thread: threadId, resource: resourceId },
    });
    const types: string[] = [];
    void (async () => {
      for await (const part of result.output.fullStream as AsyncIterable<any>) types.push(part.type);
    })().catch(() => undefined);
    await vi.waitFor(() => expect(types).toContain('text-delta'), { timeout: 30_000 });

    await getSharedMastra().shutdown({ drainTimeout: 200 });

    const handBacks = () =>
      published
        .map(event => event?.data ?? event)
        .filter(event => event?.type === 'run-completed' && event?.runId === result.runId);
    await vi.waitFor(() => expect(handBacks().length).toBeGreaterThan(0), { timeout: 15_000 });
    expect(handBacks()).toEqual([expect.objectContaining({ persisted: false, status: 'interrupted' })]);

    publish.mockRestore();
    result.cleanup();
  });
});
