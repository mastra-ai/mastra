import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

export interface DurableDisconnectTestConfig {
  setupModel: () => Promise<{
    model: ConstructorParameters<typeof Agent>[0]['model'];
    addResponse: (
      sequenceIndex: number,
      response: {
        content?: string;
        toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
      },
    ) => void;
    getRequestCount: () => number;
    close: () => Promise<void>;
  }>;
  startServer: (
    mastra: Mastra,
    onDisconnect: (path: string) => void,
  ) => Promise<{
    baseUrl: string;
    close: () => Promise<void>;
  }>;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

// Real TCP disconnects exercise both request-signal propagation and reader cancellation.
export function createDurableDisconnectTestSuite(config: DurableDisconnectTestConfig) {
  describe.each(['plain', 'durable', 'evented'] as const)('HTTP observer disconnect: %s (COR-1489)', kind => {
    let server: Awaited<ReturnType<DurableDisconnectTestConfig['startServer']>> | undefined;
    let fixture: Awaited<ReturnType<DurableDisconnectTestConfig['setupModel']>> | undefined;
    let mastra: Mastra | undefined;
    afterEach(async () => {
      if (mastra) await mastra.shutdown();
      if (server) await server.close();
      if (fixture) await fixture.close();
      server = undefined;
      mastra = undefined;
      fixture = undefined;
    });

    it('forwards history and ordered run outcomes without closing the thread subscription (COR-1500)', async () => {
      fixture = await config.setupModel();
      fixture.addResponse(0, { content: 'first answer' });
      fixture.addResponse(1, { content: 'second answer' });
      const inner = new Agent({
        id: 'subscription-agent',
        name: 'Subscription agent',
        instructions: 'Answer briefly.',
        model: fixture.model,
        memory: new MockMemory({ storage: new InMemoryStore() }),
      });
      const agent =
        kind === 'durable'
          ? createDurableAgent({ agent: inner })
          : kind === 'evented'
            ? createEventedAgent({ agent: inner })
            : inner;
      mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore() });
      server = await config.startServer(mastra, () => {});
      const controller = new AbortController();
      const coordinates = { resourceId: 'subscription-user', threadId: `subscription-${kind}` };
      const response = await fetch(`${server.baseUrl}/api/agents/agent/threads/subscribe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...coordinates, withInitialHistory: true, withRunStatus: true }),
        signal: controller.signal,
      });
      expect(response.status).toBe(200);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      async function nextChunk(): Promise<{ type: string; runId: string; payload: Record<string, unknown> }> {
        for (;;) {
          const boundary = buffered.indexOf('\n\n');
          if (boundary !== -1) {
            const frame = buffered.slice(0, boundary);
            buffered = buffered.slice(boundary + 2);
            const data = frame.split('\n').find(line => line.startsWith('data: '));
            if (data) return JSON.parse(data.slice(6));
          } else {
            const next = await reader.read();
            expect(next.done).toBe(false);
            buffered += decoder.decode(next.value, { stream: true });
          }
        }
      }
      try {
        expect(await nextChunk()).toMatchObject({ type: 'thread-history', payload: { activeRunId: null } });
        for (const answer of ['first answer', 'second answer']) {
          const reading = (async () => {
            let text = '';
            for (;;) {
              const chunk = await nextChunk();
              if (chunk.type === 'text-delta') text += chunk.payload.text;
              if (chunk.type === 'thread-run-status') return { text, runId: chunk.runId, status: chunk.payload.status };
            }
          })();
          const output = await agent.stream('Hello', {
            memory: { thread: coordinates.threadId, resource: coordinates.resourceId },
          });
          for await (const _chunk of output.fullStream) {
            /* Drain the producer as well as its HTTP observer. */
          }
          expect(await reading).toEqual({ text: answer, runId: output.runId, status: 'success' });
        }
      } finally {
        controller.abort();
        await reader.cancel().catch(() => {});
      }
    }, 30_000);

    for (const route of [
      'stream',
      'stream-alias',
      'stream-until-idle',
      'resume-stream',
      'resume-alias',
      'resume-stream-until-idle',
      'approve-tool-call',
      'decline-tool-call',
    ] as const) {
      for (const explicitAbort of [false, true, 'run', 'threadless'] as const) {
        if (typeof explicitAbort === 'string' && (kind === 'plain' || !['stream', 'stream-alias'].includes(route)))
          continue;
        const threadless = explicitAbort === 'threadless';
        it(`${route}: disconnect ${explicitAbort ? `then explicit ${explicitAbort === true ? 'thread' : explicitAbort} abort stops execution` : 'preserves durable execution and replay'}`, async () => {
          fixture = await config.setupModel();
          const entered = deferred();
          const gate = deferred();
          const disconnected = deferred();
          const calls: number[] = [];
          let toolSignal: AbortSignal | undefined;
          const storage = new InMemoryStore();
          const memory = new MockMemory({ storage });
          const slow = createTool({
            id: 'slow',
            description: 'Execute a numbered step',
            inputSchema: z.object({ n: z.number() }),
            execute: async ({ n }, context) => {
              calls.push(n);
              if (n === 1) {
                toolSignal = context?.abortSignal;
                entered.resolve();
                await Promise.race([
                  gate.promise,
                  new Promise<void>(resolve => {
                    if (toolSignal?.aborted) return resolve();
                    toolSignal?.addEventListener('abort', () => resolve(), { once: true });
                  }),
                ]);
              }
              return { n };
            },
          });
          const research = createTool({
            id: 'research',
            description: 'Background research',
            inputSchema: z.object({}),
            background: { enabled: true },
            execute: async () => ({ done: true }),
          });
          let authorizations = 0;
          const authorize = createTool({
            id: 'authorize',
            description: 'Authorize the steps',
            inputSchema: z.object({}),
            requireApproval: true,
            execute: async () => {
              authorizations++;
              return { approved: true };
            },
          });
          const resumed = route.startsWith('resume') || route.endsWith('tool-call');
          const offset = resumed ? 1 : 0;
          const inner = new Agent({
            id: 'disconnect-agent',
            name: 'Disconnect agent',
            instructions: 'Execute three steps.',
            model: fixture.model,
            ...(threadless ? {} : { memory }),
            tools: { slow, research, authorize },
            backgroundTasks: { tools: { research: true } },
          });
          const agent =
            kind === 'durable'
              ? createDurableAgent({ agent: inner })
              : kind === 'evented'
                ? createEventedAgent({ agent: inner })
                : inner;
          const otherAgent = createDurableAgent({
            agent: new Agent({
              id: 'other-agent',
              name: 'Other agent',
              instructions: 'Do not run.',
              model: fixture.model,
            }),
          });
          mastra = new Mastra({
            agents: { agent, otherAgent },
            storage,
            logger: false,
            backgroundTasks: { enabled: true, globalConcurrency: 5, perAgentConcurrency: 3 },
          });
          server = await config.startServer(mastra, path => {
            if (!resumed || !path.endsWith('/stream')) disconnected.resolve();
          });
          const base = `${server.baseUrl}/api/agents/agent`;
          if (resumed)
            fixture.addResponse(0, {
              toolCalls: [{ id: 'authorize-1', name: 'authorize', arguments: {} }],
            });
          for (let n = 1; n <= 3; n++)
            fixture.addResponse(offset + n - 1, {
              toolCalls: [{ id: `slow-${n}`, name: 'slow', arguments: { n } }],
            });
          fixture.addResponse(offset + 3, { content: 'done: 3 results' });
          const runId = `disconnect-${kind}-${route}-${explicitAbort}`;
          const thread = { thread: runId, resource: 'disconnect-user' };
          if (resumed) {
            const parked = await fetch(`${base}/stream`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ messages: 'Start', runId, memory: thread, maxSteps: 6 }),
            });
            expect(parked.status).toBe(200);
            const reader = parked.body!.getReader();
            let received = '';
            while (!received.includes('tool-call-approval')) {
              const { done, value } = await reader.read();
              expect(done).toBe(false);
              received += new TextDecoder().decode(value);
            }
            await reader.cancel();
          }
          const client = new AbortController();
          const endpoint = route === 'stream-alias' ? 'stream' : route === 'resume-alias' ? 'resume-stream' : route;
          const request = fetch(`${base}/${endpoint}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal: client.signal,
            body: JSON.stringify({
              ...(resumed ? { resumeData: { approved: true }, toolCallId: 'authorize-1' } : { messages: 'Start' }),
              runId,
              ...(threadless ? {} : { memory: thread }),
              maxSteps: 6,
              ...(['stream-alias', 'resume-alias'].includes(route) ? { untilIdle: true } : {}),
            }),
          })
            .then(async response => {
              expect(response.status).toBe(200);
              await response.text();
            })
            .catch(error => {
              if (error.name !== 'AbortError') throw error;
            });
          try {
            await entered.promise;
            client.abort();
            await disconnected.promise;
            await request;
            if (kind !== 'plain' && explicitAbort) {
              const runScoped = typeof explicitAbort === 'string';
              if (runScoped) {
                const denied = await fetch(`${server.baseUrl}/api/agents/otherAgent/runs/${runId}/abort`, {
                  method: 'POST',
                });
                expect(denied.status).toBe(403);
                expect(toolSignal?.aborted).toBe(false);
              }
              const response = await fetch(`${base}/${runScoped ? `runs/${runId}/abort` : 'threads/abort'}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                ...(runScoped
                  ? {}
                  : { body: JSON.stringify({ threadId: runId, resourceId: thread.resource, expectedRunId: runId }) }),
              });
              const result = await response.json();
              expect(response.status).toBe(200);
              expect(result).toEqual({ aborted: true });
            }
            const completes = kind !== 'plain' && !explicitAbort;
            if (!completes) await vi.waitFor(() => expect(toolSignal?.aborted).toBe(true));
            else expect(toolSignal?.aborted).toBe(false);
            const observing =
              kind === 'plain'
                ? undefined
                : fetch(`${base}/observe`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ runId }),
                  });
            gate.resolve();
            if (observing) {
              const response = await observing;
              expect(response.status).toBe(200);
              const replay = await response.text();
              expect(replay).toContain('finish');
              if (completes) expect(replay).toContain('done: 3 results');
              else expect(replay).toContain('abort');
            }
            await vi.waitFor(() => expect(calls).toEqual(completes ? [1, 2, 3] : [1]));
            expect(fixture.getRequestCount()).toBe(offset + (completes ? 4 : 1));
            if (resumed) expect(authorizations).toBe(route === 'decline-tool-call' ? 0 : 1);
            if (kind !== 'plain') {
              const workflows = (await storage.getStore('workflows'))!;
              await vi.waitFor(async () => {
                for (const workflowName of ['durable-agentic-loop', 'durable-agentic-execution']) {
                  expect(await workflows.loadWorkflowSnapshot({ workflowName, runId })).toBeFalsy();
                }
              });
            }
            if (completes) {
              await vi.waitFor(async () => {
                const { messages } = await memory.recall({ threadId: runId, resourceId: thread.resource });
                expect(
                  messages
                    .flatMap(m => m.content.parts ?? [])
                    .some(p => p.type === 'text' && p.text === 'done: 3 results'),
                ).toBe(true);
              });
              const replay = await fetch(`${base}/observe`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ runId }),
              }).then(response => response.text());
              expect(replay).toContain('done: 3 results');
              expect(replay).toContain('finish');
              const lateAbort = await fetch(`${base}/runs/${runId}/abort`, { method: 'POST' });
              expect(lateAbort.status).toBe(200);
              expect(await lateAbort.json()).toEqual({ aborted: false });
              expect(fixture.getRequestCount()).toBe(offset + 4);
            }
          } finally {
            gate.resolve();
            client.abort();
          }
        }, 30_000);
      }
    }
  });
}
