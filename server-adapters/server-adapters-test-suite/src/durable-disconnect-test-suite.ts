import { Agent } from '@mastra/core/agent';
import {
  AGENT_STREAM_TOPIC,
  createDurableAgent,
  createDurableAgentStream,
  createEventedAgent,
} from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import type { ChunkType } from '@mastra/core/stream';
import { createTool } from '@mastra/core/tools';
import { serializeStreamChunk } from '@mastra/server/server-adapter';
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
  observeWithClient?: (baseUrl: string, runId: string, offset?: number) => Promise<ChunkType<unknown>[]>;
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

async function collectPublicFrames(response: Response, onFrame?: (frame: ChunkType<unknown>) => void) {
  const frames: ChunkType<unknown>[] = [];
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return frames;
      buffer += value;
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop()!;
      for (const event of events) {
        for (const line of event.split(/\r?\n/)) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          const frame: ChunkType<unknown> = JSON.parse(data);
          frames.push(frame);
          onFrame?.(frame);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
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

    if (kind !== 'plain') {
      it.each(['error', 'abort', 'abort-without-text', 'aborted-finish'] as const)(
        'replays %s as public terminal frames (COR-1498)',
        async terminal => {
          fixture = await config.setupModel();
          const agent = (kind === 'durable' ? createDurableAgent : createEventedAgent)({
            agent: new Agent({
              id: 'terminal-agent',
              name: 'Terminal agent',
              instructions: 'Unused',
              model: fixture.model,
            }),
            cleanupTimeoutMs: 60_000,
          });
          mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
          server = await config.startServer(mastra, () => {});
          const runId = `observe-terminal-${kind}-${terminal}`;
          const topic = AGENT_STREAM_TOPIC(runId);
          // Exercise the real replay log and core adapter as the reference, including
          // lifecycle records that consume offsets but must not leak onto the wire.
          await agent.pubsub.publish(topic, { runId, type: 'iteration-complete', data: {} });
          await agent.pubsub.publish(topic, { runId, type: 'suspended', data: { type: 'suspension' } });
          await agent.pubsub.publish(topic, {
            runId,
            type: terminal === 'aborted-finish' ? 'finish' : terminal === 'abort-without-text' ? 'abort' : terminal,
            data:
              terminal === 'error'
                ? {
                    error: {
                      id: 'TEST_ERROR',
                      name: 'ProviderError',
                      message: 'Provider unavailable',
                      stack: 'producer-stack',
                    },
                  }
                : terminal === 'abort' || terminal === 'abort-without-text'
                  ? { ...(terminal === 'abort' ? { text: 'partial answer' } : {}), steps: [] }
                  : {
                      output: {
                        text: 'partial answer',
                        steps: [],
                        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
                      },
                      stepResult: { reason: 'abort' },
                    },
          });
          const reference = createDurableAgentStream({
            pubsub: agent.pubsub,
            runId,
            messageId: 'reference',
            model: { version: 'v3', modelId: undefined, provider: undefined },
          });
          const expected: unknown[] = [];
          try {
            for await (const chunk of reference.output.fullStream) {
              const serialized = serializeStreamChunk(chunk);
              if (!serialized.ok) throw serialized.error;
              expected.push(JSON.parse(serialized.json));
            }
          } finally {
            await reference.cleanup();
          }
          for (const offset of [0, 1, 2]) {
            const response = await fetch(`${server.baseUrl}/api/agents/agent/observe`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ runId, offset }),
            });
            expect(response.status).toBe(200);
            expect(await collectPublicFrames(response)).toEqual(expected);
          }
          expect(expected).toHaveLength(terminal === 'error' ? 1 : 2);
          if (config.observeWithClient) expect(await config.observeWithClient(server.baseUrl, runId)).toEqual(expected);
        },
      );

      it('preserves finish metadata after a model error chunk (COR-1498)', async () => {
        fixture = await config.setupModel();
        const agent = (kind === 'durable' ? createDurableAgent : createEventedAgent)({
          agent: new Agent({ id: 'error-agent', name: 'Error agent', instructions: 'Unused', model: fixture.model }),
        });
        mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
        server = await config.startServer(mastra, () => {});
        const runId = `observe-model-error-${kind}`;
        const usage = { inputTokens: 1, outputTokens: 2, totalTokens: 3 };
        const output = { text: '', steps: [], usage };
        const stepResult = { reason: 'error', warnings: [], isContinued: false };
        await agent.pubsub.publish(AGENT_STREAM_TOPIC(runId), {
          runId,
          type: 'chunk',
          data: { type: 'error', runId, from: 'AGENT', payload: { error: { message: 'Provider unavailable' } } },
        });
        await agent.pubsub.publish(AGENT_STREAM_TOPIC(runId), {
          runId,
          type: 'chunk',
          data: { type: 'step-finish', runId, from: 'AGENT', payload: { output, stepResult, metadata: {} } },
        });
        await agent.pubsub.publish(AGENT_STREAM_TOPIC(runId), { runId, type: 'finish', data: { output, stepResult } });
        const reference = createDurableAgentStream({
          pubsub: agent.pubsub,
          runId,
          messageId: 'reference',
          model: { version: 'v3', modelId: undefined, provider: undefined },
        });
        const expected: unknown[] = [];
        try {
          for await (const chunk of reference.output.fullStream) {
            const serialized = serializeStreamChunk(chunk);
            if (!serialized.ok) throw serialized.error;
            expected.push(JSON.parse(serialized.json));
          }
        } finally {
          await reference.cleanup();
        }
        const response = await fetch(`${server.baseUrl}/api/agents/agent/observe`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ runId }),
        });
        const frames = await collectPublicFrames(response);
        expect(frames.map(frame => frame.type)).toEqual(['error', 'step-finish', 'finish']);
        expect(frames).toEqual(expected);
        expect(frames.at(-1)).toMatchObject({ payload: { output: { usage }, stepResult: { reason: 'error' } } });
        if (config.observeWithClient) expect(await config.observeWithClient(server.baseUrl, runId)).toEqual(expected);
      });

      it.each([false, true])(
        'matches public finish usage when terminal raw is present: %s (COR-1498)',
        async explicit => {
          fixture = await config.setupModel();
          const agent = (kind === 'durable' ? createDurableAgent : createEventedAgent)({
            agent: new Agent({ id: 'usage-agent', name: 'Usage agent', instructions: 'Unused', model: fixture.model }),
          });
          mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
          server = await config.startServer(mastra, () => {});
          const runId = `observe-usage-${kind}-${explicit}`;
          const usage = { inputTokens: 1, outputTokens: 2, totalTokens: 3 };
          const raw = { source: 'first step' };
          const steps = [{ usage: { ...usage, raw } }, { usage }];
          for (const step of steps) {
            await agent.pubsub.publish(AGENT_STREAM_TOPIC(runId), {
              runId,
              type: 'chunk',
              data: {
                type: 'step-finish',
                runId,
                from: 'AGENT',
                payload: {
                  output: step,
                  stepResult: { reason: 'stop', warnings: [], isContinued: false },
                  metadata: {},
                },
              },
            });
          }
          await agent.pubsub.publish(AGENT_STREAM_TOPIC(runId), {
            runId,
            type: 'finish',
            data: {
              output: { text: '', steps, usage: { ...usage, ...(explicit ? { raw: { source: 'finish' } } : {}) } },
              stepResult: { reason: 'stop' },
            },
          });
          const reference = createDurableAgentStream({
            pubsub: agent.pubsub,
            runId,
            messageId: 'reference',
            model: { version: 'v3', modelId: undefined, provider: undefined },
          });
          let expected: unknown;
          try {
            for await (const chunk of reference.output.fullStream) {
              if (chunk.type === 'finish') {
                const serialized = serializeStreamChunk(chunk);
                if (!serialized.ok) throw serialized.error;
                expected = JSON.parse(serialized.json).payload.output.usage;
              }
            }
          } finally {
            await reference.cleanup();
          }
          expect(expected).toEqual({ ...usage, raw });
          const response = await fetch(`${server.baseUrl}/api/agents/agent/observe`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ runId }),
          });
          const frames = await collectPublicFrames(response);
          const finish = frames.find(frame => frame.type === 'finish');
          expect(finish?.payload.output.usage).toEqual(expected);
        },
      );

      it('drains replay before a rejecting error without emitting DONE (COR-1498)', async () => {
        fixture = await config.setupModel();
        const agent = (kind === 'durable' ? createDurableAgent : createEventedAgent)({
          agent: new Agent({ id: 'reject-agent', name: 'Reject agent', instructions: 'Unused', model: fixture.model }),
        });
        mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
        server = await config.startServer(mastra, () => {});
        const runId = `observe-reject-${kind}`;
        const prefix = { type: 'text-delta', runId, from: 'AGENT', payload: { text: 'before rejection' } };
        await agent.pubsub.publish(AGENT_STREAM_TOPIC(runId), { runId, type: 'chunk', data: prefix });
        await agent.pubsub.publish(AGENT_STREAM_TOPIC(runId), {
          runId,
          type: 'error',
          data: { delivery: 'reject', error: { name: 'Error', message: 'Run superseded' } },
        });
        const response = await fetch(`${server.baseUrl}/api/agents/agent/observe`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ runId }),
        });
        expect(response.status).toBe(200);
        const wire = await response.text();
        expect(wire).toContain(JSON.stringify(prefix));
        expect(wire).not.toContain('[DONE]');
        expect(wire).not.toContain('"type":"error"');
      });

      it('reattaches with the same public frames as stream, including tools and finish metadata (COR-1498)', async () => {
        fixture = await config.setupModel();
        const entered = deferred();
        const gate = deferred();
        const liveFrames: ChunkType<unknown>[] = [];
        const tool = createTool({
          id: 'lookup',
          description: 'Look up an answer',
          inputSchema: z.object({}),
          execute: async () => {
            entered.resolve();
            await gate.promise;
            return { answer: 42 };
          },
        });
        let processedChunks = 0;
        const inner = new Agent({
          id: 'observe-agent',
          name: 'Observe agent',
          instructions: 'Look up the answer.',
          model: fixture.model,
          tools: { lookup: tool },
          outputProcessors: [
            {
              id: 'count-output-chunks',
              async processOutputStream({ part }) {
                processedChunks++;
                return part;
              },
            },
          ],
        });
        const agent = (kind === 'durable' ? createDurableAgent : createEventedAgent)({
          agent: inner,
          cleanupTimeoutMs: 60_000,
        });
        mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
        server = await config.startServer(mastra, () => {});
        fixture.addResponse(0, {
          content: 'Looking up',
          toolCalls: [{ id: 'lookup-1', name: 'lookup', arguments: {} }],
        });
        fixture.addResponse(1, { content: 'The answer is 42.' });
        const runId = `observe-parity-${kind}`;
        const base = `${server.baseUrl}/api/agents/agent`;
        const post = async (route: string, body: object) => {
          const response = await fetch(`${base}/${route}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          expect(response.status).toBe(200);
          return response;
        };
        const original = collectPublicFrames(await post('stream', { messages: 'Find the answer', runId, maxSteps: 3 }));
        try {
          await entered.promise;
          const live = collectPublicFrames(await post('observe', { runId, offset: 0 }), frame => {
            liveFrames.push(frame);
          });
          await expect.poll(() => liveFrames.some(frame => frame.type === 'tool-call'), { timeout: 2000 }).toBe(true);
          // Detaching another observer must not cancel the gated tool or erase replay history.
          const detached = await post('observe', { runId });
          await detached.body!.cancel();
          gate.resolve();
          const frames = await original;
          expect(await live).toEqual(frames);
          expect(
            frames
              .filter(frame => frame.type === 'text-delta')
              .map(frame => frame.payload.text)
              .join(''),
          ).toBe('Looking upThe answer is 42.');
          expect(frames.some(frame => frame.type === 'tool-result')).toBe(true);
          expect(frames.filter(frame => frame.type === 'step-start')).toHaveLength(2);
          expect(frames.at(-1)).toMatchObject({ type: 'finish', runId, payload: { stepResult: { reason: 'stop' } } });
          const processedAtFinish = processedChunks;
          expect(processedAtFinish).toBeGreaterThan(0);
          for (const offset of [undefined, 0]) {
            expect(await collectPublicFrames(await post('observe', { runId, offset }))).toEqual(frames);
            if (config.observeWithClient) {
              expect(await config.observeWithClient(server.baseUrl, runId, offset)).toEqual(frames);
            }
          }
          const history = await agent.pubsub.getHistory(AGENT_STREAM_TOPIC(runId));
          const delta = history.find(event => event.type === 'chunk' && event.data?.type === 'text-delta');
          expect(delta).toBeDefined();
          const firstDelta = frames.findIndex(frame => frame.type === 'text-delta');
          expect(await collectPublicFrames(await post('observe', { runId, offset: delta!.index }))).toEqual(
            frames.slice(firstDelta),
          );
          expect(await collectPublicFrames(await post('observe', { runId, offset: delta!.index! + 1 }))).toEqual(
            frames.slice(firstDelta + 1),
          );
          if (config.observeWithClient) {
            expect(await config.observeWithClient(server.baseUrl, runId, delta!.index)).toEqual(
              frames.slice(firstDelta),
            );
          }
          expect(processedChunks).toBe(processedAtFinish);
        } finally {
          gate.resolve();
          await original;
        }
      });
    }

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
        if (typeof explicitAbort === 'string' && (kind === 'plain' || !['stream', 'stream-alias'].includes(route))) {
          continue;
        }
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
          if (resumed) {
            fixture.addResponse(0, {
              toolCalls: [{ id: 'authorize-1', name: 'authorize', arguments: {} }],
            });
          }
          for (let n = 1; n <= 3; n++) {
            fixture.addResponse(offset + n - 1, {
              toolCalls: [{ id: `slow-${n}`, name: 'slow', arguments: { n } }],
            });
          }
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
