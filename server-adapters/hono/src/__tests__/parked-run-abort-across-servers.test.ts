import { EventEmitter, once } from 'node:events';
import type { Server } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
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
        pubsub: new EventEmitterPubSub(bus),
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

    return { executor, other, runId, storage, toolRuns: () => toolRuns };
  }

  async function abort(peer: { post: (path: string, body: unknown) => Promise<Response> }, runId: string) {
    const res = await peer.post(`runs/${runId}/abort`, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ aborted: true });
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
    await abort(setupResult[abortOn], runId);

    const approved = await setupResult[approveOn].post('approve-tool-call', { runId, toolCallId: 'call-fetch-1' });
    const text = await approved.text();
    expect({ status: approved.status, toolRuns: toolRuns() }).toEqual({ status: 409, toolRuns: 0 });
    expect(JSON.parse(text)).toMatchObject({ error: expect.stringContaining(`cannot resume aborted run "${runId}"`) });
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
