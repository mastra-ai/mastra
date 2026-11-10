/**
 * COR-1519 cell 4: the Stop and reload path Studio ships today, end to end.
 *
 * Studio's chat (useChat with thread signals on, the default for agents with
 * memory) never calls agent `/observe`. It subscribes to the thread, sends the
 * message as a signal, re-subscribes with initial history after a reload, and
 * stops a run with `abortThread({ expectedRunId })`. These tests drive those
 * exact client-js calls against a real Hono server with real storage and
 * memory; only the model's HTTP endpoint is mocked.
 */
import { once } from 'node:events';
import type { Server } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { serve } from '@hono/node-server';
import { MastraClient } from '@mastra/client-js';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MastraServer } from '../index';

type Chunk = { type: string; runId?: string; payload?: any };

const REPLY = 'The wait is over.';

let llm: LLMock;
beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});
afterAll(async () => {
  await llm.stop();
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}

async function waitFor(check: () => boolean, label: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise(r => setTimeout(r, 25));
  }
}

describe.each(['plain', 'durable'] as const)('Studio Stop and reload on a %s agent (COR-1519)', kind => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();
  });

  async function setup() {
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const toolStarted = deferred();
    const release = deferred();
    const tool = { aborted: false, finished: false };

    const wait = createTool({
      id: 'wait',
      description: 'Wait for the job',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        toolStarted.resolve();
        const signal = context?.abortSignal;
        await Promise.race([
          release.promise,
          new Promise<void>(resolve => signal?.addEventListener('abort', () => resolve(), { once: true })),
          new Promise<void>(resolve => setTimeout(resolve, 30_000)),
        ]);
        if (signal?.aborted) tool.aborted = true;
        else tool.finished = true;
        return { done: true };
      },
    });

    const base = new Agent({
      id: 'chat',
      name: 'chat',
      instructions: 'Use the wait tool, then answer.',
      model: openai('gpt-4o-mini'),
      memory: new Memory(),
      tools: { wait },
    });
    const agent = kind === 'durable' ? createDurableAgent({ agent: base }) : base;

    const mastra = new Mastra({ agents: { chat: agent as Agent }, storage: new InMemoryStore(), logger: false });
    const app = new Hono();
    await new MastraServer({ app, mastra, prefix: '/api' }).init();
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }) as Server;
    if (!server.listening) await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    cleanups.push(async () => {
      release.resolve();
      await mastra.shutdown();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    });

    llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { toolCalls: [{ name: 'wait', arguments: '{}' }] });
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: REPLY });

    return { baseUrl, toolStarted, release, tool };
  }

  // One browser tab: its own client and thread subscription, as useChat opens on mount.
  async function openTab(baseUrl: string, threadId: string, withInitialHistory = false) {
    const controller = new AbortController();
    const client = new MastraClient({ baseUrl, retries: 0, abortSignal: controller.signal });
    const agent = client.getAgent('chat');
    const chunks: Chunk[] = [];
    const subscription = await agent.subscribeToThread({
      resourceId: 'chat',
      threadId,
      withRunStatus: true,
      ...(withInitialHistory ? { withInitialHistory: true } : {}),
    });
    const processing = subscription
      .processDataStream({ onChunk: async chunk => void chunks.push(chunk as Chunk) })
      .catch(() => {});
    const close = async () => {
      subscription.unsubscribe();
      controller.abort();
      await processing;
    };
    cleanups.push(close);
    return { agent, chunks, close };
  }

  const text = (chunks: Chunk[], runId: string) =>
    chunks
      .filter(c => c.type === 'text-delta' && c.runId === runId)
      .map(c => c.payload?.text ?? '')
      .join('');
  const statuses = (chunks: Chunk[], runId: string) =>
    chunks.filter(c => c.type === 'thread-run-status' && c.runId === runId).map(c => c.payload?.status);

  it('a reloaded tab adopts the live run and receives its answer', async () => {
    const { baseUrl, toolStarted, release, tool } = await setup();
    const threadId = `thread-${kind}-reload`;

    const first = await openTab(baseUrl, threadId);
    const sent = await first.agent.sendMessage({ message: 'start the job', resourceId: 'chat', threadId });
    const runId = sent.runId as string;
    expect(runId).toBeTruthy();
    await toolStarted.promise;

    // Reload: the old tab's connection goes away mid-run.
    await first.close();
    const second = await openTab(baseUrl, threadId, true);
    await waitFor(() => second.chunks.some(c => c.type === 'thread-history'), 'thread-history');
    const history = second.chunks.find(c => c.type === 'thread-history')!;
    expect(history.payload.activeRunId).toBe(runId);

    release.resolve();
    await waitFor(() => statuses(second.chunks, runId).length > 0, 'run status after reload');

    expect(tool.finished).toBe(true);
    expect(statuses(second.chunks, runId)).toEqual(['success']);
    expect(text(second.chunks, runId)).toBe(REPLY);
    expect(second.chunks.filter(c => c.type === 'finish' && c.runId === runId)).toHaveLength(1);
  });

  it('Stop from the sending tab aborts the run and reports it on the open subscription', async () => {
    const { baseUrl, toolStarted, tool } = await setup();
    const threadId = `thread-${kind}-stop-same-tab`;

    const tab = await openTab(baseUrl, threadId);
    const sent = await tab.agent.sendMessage({ message: 'start the job', resourceId: 'chat', threadId });
    const runId = sent.runId as string;
    await toolStarted.promise;

    const stopped = await tab.agent.abortThread({ resourceId: 'chat', threadId, expectedRunId: runId });
    expect(stopped.aborted).toBe(true);
    await waitFor(() => statuses(tab.chunks, runId).length > 0, 'run status after stop');
    await waitFor(() => tool.aborted, 'tool to see abort');

    expect(statuses(tab.chunks, runId)).toEqual(['aborted']);
    expect(text(tab.chunks, runId)).toBe('');
    expect(llm.getRequests()).toHaveLength(1);
  });

  it('Stop from a reloaded tab aborts the live run and leaves the thread usable', async () => {
    const { baseUrl, toolStarted, tool } = await setup();
    const threadId = `thread-${kind}-stop`;

    const first = await openTab(baseUrl, threadId);
    const sent = await first.agent.sendMessage({ message: 'start the job', resourceId: 'chat', threadId });
    const runId = sent.runId as string;
    await toolStarted.promise;

    await first.close();
    const second = await openTab(baseUrl, threadId, true);
    await waitFor(() => second.chunks.some(c => c.type === 'thread-history'), 'thread-history');

    // useChat's Stop: abortThread with the run it believes is live.
    const stopped = await second.agent.abortThread({ resourceId: 'chat', threadId, expectedRunId: runId });
    expect(stopped.aborted).toBe(true);
    await waitFor(() => statuses(second.chunks, runId).length > 0, 'run status after stop');

    expect(statuses(second.chunks, runId)).toEqual(['aborted']);
    await waitFor(() => tool.aborted, 'tool to see abort');
    expect(text(second.chunks, runId)).toBe('');
    // The model is never asked for the post-tool answer.
    expect(llm.getRequests()).toHaveLength(1);

    // A stale Stop for the finished run is not acknowledged as an abort.
    const stale = await second.agent.abortThread({ resourceId: 'chat', threadId, expectedRunId: runId });
    expect(stale.aborted).toBe(false);

    // The next message on the same thread runs to completion.
    llm.clearFixtures();
    llm.resetMatchCounts();
    llm.on({ endpoint: 'chat' }, { content: 'Ready again.' });
    const next = await second.agent.sendMessage({ message: 'are you there?', resourceId: 'chat', threadId });
    const nextRunId = next.runId as string;
    expect(nextRunId).not.toBe(runId);
    await waitFor(() => statuses(second.chunks, nextRunId).length > 0, 'next run status');
    expect(statuses(second.chunks, nextRunId)).toEqual(['success']);
    expect(text(second.chunks, nextRunId)).toBe('Ready again.');
  });
});
