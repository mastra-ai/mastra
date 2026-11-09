import { EventEmitter, once } from 'node:events';
import type { Server } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { AGENT_STREAM_TOPIC, createDurableAgent } from '@mastra/core/agent/durable';
import { InMemoryServerCache } from '@mastra/core/cache';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MastraServer } from '../index';

// Two servers share storage, cache and a message bus, but each keeps its own
// in-process run state, like two processes behind a load balancer. A durable run
// parks on a tool approval on the executor; abort and approve requests then land on
// either server over HTTP.
const users: Record<string, { id: string; resourceId: string }> = {
  alice: { id: 'alice', resourceId: 'alice' },
  bob: { id: 'bob', resourceId: 'bob' },
};

// A broker outage that rejects the next abort publish, then recovers.
class FlakyPubSub extends EventEmitterPubSub {
  constructor(
    emitter: EventEmitter,
    private faults: { failNextAbort: boolean },
  ) {
    super(emitter);
  }

  override async publish(...args: Parameters<EventEmitterPubSub['publish']>): Promise<void> {
    if (args[1].type === 'abort' && this.faults.failNextAbort) {
      this.faults.failNextAbort = false;
      throw new Error('broker unavailable');
    }
    return super.publish(...args);
  }
}

let llm: LLMock;
beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});
afterAll(async () => {
  await llm.stop();
});

describe('aborting a parked durable run across servers', () => {
  const mastras: Mastra[] = [];
  const servers: Server[] = [];
  afterEach(async () => {
    await Promise.all(mastras.map(m => m.shutdown()));
    for (const server of servers) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    }
    mastras.length = 0;
    servers.length = 0;
    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();
  });

  async function setup() {
    const bus = new EventEmitter();
    const storage = new InMemoryStore();
    const cache = new InMemoryServerCache();
    const faults = { failNextAbort: false };
    let toolRuns = 0;

    async function startPeer() {
      const fetchRecord = createTool({
        id: 'fetchRecord',
        description: 'Fetch a record',
        inputSchema: z.object({ name: z.string() }),
        requireApproval: true,
        execute: async () => {
          toolRuns++;
          return { amount: 42 };
        },
      });
      const model = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` })('gpt-4o-mini');
      const inner = new Agent({ id: 'agent', name: 'Agent', instructions: 'Fetch.', model, tools: { fetchRecord } });
      const other = new Agent({ id: 'other', name: 'Other', instructions: 'Idle.', model, tools: { fetchRecord } });
      const mastra = new Mastra({
        logger: false,
        storage,
        cache,
        pubsub: new FlakyPubSub(bus, faults),
        agents: { agent: createDurableAgent({ agent: inner }), other: createDurableAgent({ agent: other }) },
        server: {
          auth: {
            authenticateToken: async (token: string) => users[token] ?? null,
            authorizeUser: () => true,
            mapUserToResourceId: (user: { resourceId: string }) => user.resourceId,
          },
        },
      });
      mastras.push(mastra);
      const app = new Hono();
      await new MastraServer({ app, mastra }).init();
      const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }) as Server;
      servers.push(server);
      if (!server.listening) await once(server, 'listening');
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
      const base = `http://127.0.0.1:${address.port}/api/agents`;
      const post = (path: string, body: unknown, token = 'alice', agentId = 'agent') =>
        fetch(`${base}/${agentId}/${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      return { post };
    }

    const executor = await startPeer();
    const other = await startPeer();

    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { toolCalls: [{ id: 'call-fetch-1', name: 'fetchRecord', arguments: '{"name":"proof"}' }] },
    );
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'approved result' });

    // Start on the executor and read until the run parks on the approval.
    const started = await executor.post('stream', { messages: 'Fetch record', maxSteps: 6 });
    expect(started.status).toBe(200);
    const reader = started.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (!text.includes('tool-call-approval')) {
      const { value, done } = await reader.read();
      if (done) throw new Error(`stream ended before approval: ${text}`);
      text += decoder.decode(value, { stream: true });
    }
    await reader.cancel();
    const runId = text.match(/"runId":"([^"]+)"/)?.[1];
    if (!runId) throw new Error(`no runId in stream: ${text}`);

    return { bus, executor, faults, other, runId, storage, toolRuns: () => toolRuns };
  }

  async function abort(peer: { post: (path: string, body: unknown) => Promise<Response> }, runId: string) {
    const res = await peer.post(`runs/${runId}/abort`, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ aborted: true });
  }

  async function observe(peer: { post: (path: string, body: unknown) => Promise<Response> }, runId: string) {
    const res = await peer.post('observe', { runId });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let frames = '';
    const closed = (async () => {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return true;
        frames += decoder.decode(value, { stream: true });
      }
    })();
    return {
      async end() {
        const timeout = new Promise<false>(resolve => setTimeout(() => resolve(false), 2_000));
        const ended = await Promise.race([closed, timeout]);
        if (!ended) await reader.cancel();
        return { ended, aborts: frames.match(/"type":"abort"/g)?.length ?? 0 };
      },
    };
  }

  it('runs the tool when another server approves a run that was not aborted', async () => {
    const { other, runId, toolRuns } = await setup();
    const approved = await other.post('approve-tool-call', { runId, toolCallId: 'call-fetch-1' });
    expect(approved.status).toBe(200);
    await approved.text();
    expect(toolRuns()).toBe(1);
  });

  it.each([
    ['the executing server', 'another server', 'executor', 'other'],
    ['another server', 'that server', 'other', 'other'],
    ['the executing server', 'the same server', 'executor', 'executor'],
  ] as const)('refuses the approval when %s aborted it and %s approves', async (_a, _b, abortOn, approveOn) => {
    const setupResult = await setup();
    const { runId, toolRuns } = setupResult;
    const observers = [await observe(setupResult.executor, runId), await observe(setupResult.other, runId)];
    await abort(setupResult[abortOn], runId);

    const approved = await setupResult[approveOn].post('approve-tool-call', { runId, toolCallId: 'call-fetch-1' });
    const text = await approved.text();
    expect({ status: approved.status, toolRuns: toolRuns() }).toEqual({ status: 409, toolRuns: 0 });
    expect(JSON.parse(text)).toMatchObject({ error: expect.stringContaining(`cannot resume aborted run "${runId}"`) });
    // Observers on both servers close with one abort, whichever server aborted or refused.
    expect(await Promise.all(observers.map(o => o.end()))).toEqual([
      { ended: true, aborts: 1 },
      { ended: true, aborts: 1 },
    ]);
  });

  it('closes an observer of the aborted run once when its approval is refused', async () => {
    const { bus, executor, other, runId, storage, toolRuns } = await setup();
    let published = 0;
    await new EventEmitterPubSub(bus).subscribe(AGENT_STREAM_TOPIC(runId), event => {
      if (event.type === 'abort') published++;
    });
    const observed = await executor.post('observe', { runId });
    expect(observed.status).toBe(200);
    const reader = observed.body!.getReader();
    const decoder = new TextDecoder();
    let frames = '';
    const closed = (async () => {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return true;
        frames += decoder.decode(value, { stream: true });
      }
    })();

    await abort(executor, runId);
    for (let attempt = 0; attempt < 2; attempt++) {
      const approved = await executor.post('approve-tool-call', { runId, toolCallId: 'call-fetch-1' });
      await approved.text();
      expect(approved.status).toBe(409);
    }

    const timeout = new Promise<false>(resolve => setTimeout(() => resolve(false), 2_000));
    const ended = await Promise.race([closed, timeout]);
    if (!ended) await reader.cancel();
    expect(ended).toBe(true);
    expect(frames.match(/"type":"abort"/g)).toHaveLength(1);
    expect(published).toBe(1);
    // The canceled row survives the terminal, so another server still refuses the run.
    const workflows = (await storage.getStore('workflows'))!;
    expect(await workflows.loadWorkflowRunStatus({ workflowName: 'durable-agentic-loop', runId })).toBe('canceled');
    const peerApproval = await other.post('approve-tool-call', { runId, toolCallId: 'call-fetch-1' });
    await peerApproval.text();
    expect({ status: peerApproval.status, toolRuns: toolRuns() }).toEqual({ status: 409, toolRuns: 0 });
  });

  it('closes an observer on the next refused approval when publishing the abort failed', async () => {
    const { bus, executor, faults, runId, toolRuns } = await setup();
    let published = 0;
    await new EventEmitterPubSub(bus).subscribe(AGENT_STREAM_TOPIC(runId), event => {
      if (event.type === 'abort') published++;
    });
    const observed = await executor.post('observe', { runId });
    expect(observed.status).toBe(200);
    const reader = observed.body!.getReader();
    const closed = (async () => {
      for (;;) if ((await reader.read()).done) return true;
    })();

    // The abort's own publish fails; the cancel is stored anyway and the refusal retries it.
    faults.failNextAbort = true;
    await abort(executor, runId);
    for (let attempt = 0; attempt < 2; attempt++) {
      const approved = await executor.post('approve-tool-call', { runId, toolCallId: 'call-fetch-1' });
      await approved.text();
      expect(approved.status).toBe(409);
    }
    expect(faults.failNextAbort).toBe(false);

    const timeout = new Promise<false>(resolve => setTimeout(() => resolve(false), 2_000));
    const ended = await Promise.race([closed, timeout]);
    if (!ended) await reader.cancel();
    expect({ ended, published, toolRuns: toolRuns() }).toEqual({ ended: true, published: 1, toolRuns: 0 });
  });

  it('denies another resource before disclosing that the run was aborted', async () => {
    const { executor, other, runId, toolRuns } = await setup();
    await abort(executor, runId);

    const approved = await other.post('approve-tool-call', { runId, toolCallId: 'call-fetch-1' }, 'bob');
    const text = await approved.text();
    expect({ status: approved.status, toolRuns: toolRuns() }).toEqual({ status: 403, toolRuns: 0 });
    expect(text).not.toContain('aborted');
  });

  it('denies another agent before disclosing that the run was aborted', async () => {
    const { executor, other, runId, toolRuns } = await setup();
    await abort(executor, runId);

    const approved = await other.post('approve-tool-call', { runId, toolCallId: 'call-fetch-1' }, 'alice', 'other');
    const text = await approved.text();
    expect({ status: approved.status, toolRuns: toolRuns() }).toEqual({ status: 403, toolRuns: 0 });
    expect(text).not.toContain('aborted');
  });

  it('leaves a run that a resume already claimed to that resume', async () => {
    const { other, runId, storage } = await setup();
    const workflows = (await storage.getStore('workflows'))!;
    const workflowName = 'durable-agentic-loop';
    // A resume on another server won the claim first: the stored run is running again.
    await workflows.updateWorkflowState({
      workflowName,
      runId,
      opts: { status: 'running', expectedStatus: 'suspended' },
    });

    const res = await other.post(`runs/${runId}/abort`, {});
    expect(res.status).toBe(200);
    expect(await workflows.loadWorkflowRunStatus({ workflowName, runId })).toBe('running');
  });
});
