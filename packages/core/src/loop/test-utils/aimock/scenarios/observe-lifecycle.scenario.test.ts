/**
 * AIMock Scenario: observe() lifecycle
 *
 * `agent.observe(runId)` attaches to a durable run without driving it. It must close
 * on its own when nothing will ever publish to the run again (unknown, finished,
 * or errored runs) and must stay open while a live run is merely quiet (slow
 * first token, slow tool between steps) or suspended for approval, so an
 * existing observer follows the approved run to its finish without reconnecting.
 * An abort request against a suspended run does not end the suspension, so the
 * observation stays open until the run unwinds with its abort `finish`.
 *
 * observe() exists only on the durable engines, so `normal` and `fs` are skipped.
 */
import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { SUSPENDED_RUN_LOG_RETENTION_MS } from '../../../../agent/durable/constants';
import { InMemoryServerCache } from '../../../../cache/inmemory';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

/** Records every retention refresh so a parked run's log lifetime is assertable. */
class RecordingCache extends InMemoryServerCache {
  expirations: Array<[string, number]> = [];

  async expire(key: string, ttlMs: number): Promise<void> {
    this.expirations.push([key, ttlMs]);
    await super.expire(key, ttlMs);
  }
}

/** Long enough that a hanging observation is unambiguous, short enough for CI. */
const CLOSE_WITHIN_MS = 3_000;
/** A live run stays silent this long; observation must survive it. */
const SILENCE_MS = 2_500;

type Observation = { fullStream: AsyncIterable<{ type: string; payload?: any }>; detach: () => void };

/** Drains an observation; reports whether it closed on its own before `ms`. */
async function drain(observation: Observation, ms: number) {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    observation.detach();
  }, ms);
  const chunks: { type: string; payload?: any }[] = [];
  try {
    for await (const chunk of observation.fullStream) chunks.push(chunk);
  } finally {
    clearTimeout(timer);
    observation.detach();
  }
  return { types: chunks.map(chunk => chunk.type), chunks, timedOut };
}

const textOf = (chunks: { type: string; payload?: any }[]) =>
  chunks
    .filter(chunk => chunk.type === 'text-delta')
    .map(chunk => chunk.payload?.text ?? '')
    .join('');

describeForAllEngines(
  'AIMock loop scenario: observe lifecycle',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('closes an observation of a run that never existed', async () => {
      const { agent } = await createSharedAgent(getMock(), { engine });

      const observed = await drain(await agent.observe('run-that-never-existed'), CLOSE_WITHIN_MS);

      expect(observed).toMatchObject({ types: [], timedOut: false });
    });

    it('replays a finished run, then closes', async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: 'Finished reply.' });
      const { agent } = await createSharedAgent(llm, { engine });
      const run = await agent.stream('Go', { maxSteps: 2 });
      await run.output.consumeStream();

      try {
        const replay = await drain(await agent.observe(run.runId), CLOSE_WITHIN_MS);
        expect(replay.timedOut).toBe(false);
        expect(textOf(replay.chunks)).toBe('Finished reply.');
        expect(replay.types.at(-1)).toBe('finish');

        const beyond = await drain(await agent.observe(run.runId, { offset: 1_000_000 }), CLOSE_WITHIN_MS);
        expect(beyond).toMatchObject({ types: [], timedOut: false });
      } finally {
        run.cleanup?.();
      }
    });

    it('replays a run that ended in a provider error, then closes', async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { error: { message: 'Provider down', type: 'invalid_request_error' }, status: 400 });
      const { agent } = await createSharedAgent(llm, { engine });
      const run = await agent.stream('Go', { maxSteps: 2 });
      await run.output.consumeStream().catch(() => undefined);

      try {
        const replay = await drain(await agent.observe(run.runId), CLOSE_WITHIN_MS);
        expect(replay.timedOut).toBe(false);
        expect(replay.types).toContain('error');

        const beyond = await drain(await agent.observe(run.runId, { offset: 1_000_000 }), CLOSE_WITHIN_MS);
        expect(beyond).toMatchObject({ types: [], timedOut: false });
      } finally {
        run.cleanup?.();
      }
    });

    it('stays open through a slow first token and receives the finish', async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: 'Slow but alive.' }, { streamingProfile: { ttft: SILENCE_MS } });
      const { agent } = await createSharedAgent(llm, { engine });
      const run = await agent.stream('Go', { maxSteps: 2 });
      const producerDone = run.output.consumeStream();

      try {
        const startedAt = Date.now();
        const observed = await drain(await agent.observe(run.runId), SILENCE_MS * 4);
        expect(observed.timedOut).toBe(false);
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(SILENCE_MS - 200);
        expect(textOf(observed.chunks)).toBe('Slow but alive.');
        expect(observed.types.at(-1)).toBe('finish');
        await producerDone;
      } finally {
        run.cleanup?.();
      }
    }, 30_000);

    it('stays open while a slow tool runs between steps and receives the finish', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_slow', name: 'slow_lookup', arguments: { query: 'q' } }] },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Lookup finished.' });
      let toolStarted!: () => void;
      const toolStartedPromise = new Promise<void>(resolve => (toolStarted = resolve));
      const slowLookup = createTool({
        id: 'slow_lookup',
        description: 'A slow lookup.',
        inputSchema: z.object({ query: z.string() }),
        execute: async () => {
          toolStarted();
          await new Promise(resolve => setTimeout(resolve, SILENCE_MS));
          return { ok: true };
        },
      });
      const { agent } = await createSharedAgent(llm, { engine, tools: { slow_lookup: slowLookup } });
      const run = await agent.stream('Go', { stopWhen: stepCountIs(3), maxSteps: 3 });
      const producerDone = run.output.consumeStream();

      try {
        await toolStartedPromise;
        const startedAt = Date.now();
        const observed = await drain(await agent.observe(run.runId), SILENCE_MS * 4);
        expect(observed.timedOut).toBe(false);
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(SILENCE_MS - 500);
        expect(observed.types).toContain('tool-result');
        expect(textOf(observed.chunks)).toBe('Lookup finished.');
        expect(observed.types.at(-1)).toBe('finish');
        await producerDone;
      } finally {
        run.cleanup?.();
      }
    }, 30_000);

    it('keeps observing across an approval suspend and follows the approved run to its finish', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_approve', name: 'lookup_status', arguments: { query: 'alpha' } }] },
      );
      // A slow resumed turn widens the window between approval and the first resumed event.
      llm.on(
        { endpoint: 'chat', hasToolResult: true },
        { content: 'Approved and done.' },
        { streamingProfile: { ttft: 1_500 } },
      );
      const lookup = createTool({
        id: 'lookup_status',
        description: 'Look up a status.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => ({ status: `OK:${query}` }),
      });
      const { agent } = await createSharedAgent(llm, { engine, tools: { lookup_status: lookup } });
      const run = await agent.stream('Look up alpha', { requireToolApproval: true, maxSteps: 5 });
      let toolCallId: string | undefined;
      for await (const chunk of run.fullStream) {
        if (chunk.type === 'tool-call-approval') {
          toolCallId = chunk.payload.toolCallId;
          break;
        }
      }
      expect(toolCallId).toBe('call_approve');

      let resumed: any;
      try {
        // An observer attached while the run waits for approval replays up to the request and stays open.
        const observing = drain(await agent.observe(run.runId), 20_000);
        await new Promise(resolve => setTimeout(resolve, SILENCE_MS));

        resumed = await agent.approveToolCall({ runId: run.runId, toolCallId: toolCallId! });
        // A client that reconnects right after approving, before the resumed turn produces output.
        const afterApproval = await drain(await agent.observe(run.runId), 15_000);
        const acrossSuspend = await observing;

        for (const observed of [acrossSuspend, afterApproval]) {
          expect(observed.timedOut).toBe(false);
          expect(observed.types).toContain('tool-result');
          expect(textOf(observed.chunks)).toContain('Approved and done.');
          expect(observed.types.at(-1)).toBe('finish');
        }
        expect(acrossSuspend.types).toContain('tool-call-approval');
        await resumed.consumeStream();
      } finally {
        resumed?.cleanup?.();
        run.cleanup?.();
      }
    }, 30_000);

    it('keeps observing a suspended run after an abort request and closes on the abort finish', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_abort', name: 'lookup_status', arguments: { query: 'alpha' } }] },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Should never be generated.' });
      const executed: string[] = [];
      const lookup = createTool({
        id: 'lookup_status',
        description: 'Look up a status.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          executed.push(query);
          return { status: `OK:${query}` };
        },
      });
      const { agent } = await createSharedAgent(llm, { engine, tools: { lookup_status: lookup } });
      const run = await agent.stream('Look up alpha', { requireToolApproval: true, maxSteps: 5 });
      for await (const chunk of run.fullStream) if (chunk.type === 'tool-call-approval') break;

      try {
        let closed = false;
        const observing = drain(await agent.observe(run.runId), 20_000).finally(() => (closed = true));

        // Aborting a run parked on approval records the intent; the run stays suspended,
        // so nothing terminal is published and the observer must not close yet.
        expect(agent.abortRunStream(run.runId)).toBe(true);
        await new Promise(resolve => setTimeout(resolve, SILENCE_MS));
        expect(closed).toBe(false);

        // The abort fenced the run (#27617): the approval is rejected, and the observer
        // still attached to the parked run closes on the abort finish.
        await expect(agent.approveToolCall({ runId: run.runId, toolCallId: 'call_abort' })).rejects.toMatchObject({
          id: 'AGENT_RESUME_ABORTED_RUN',
        });
        const acrossAbort = await observing;

        expect(acrossAbort.timedOut).toBe(false);
        expect(acrossAbort.types).toContain('tool-call-approval');
        expect(acrossAbort.types).toContain('abort');
        expect(acrossAbort.types.at(-1)).toBe('finish');
        expect(textOf(acrossAbort.chunks)).toBe('');
        expect(llm.getRequests()).toHaveLength(1);
        expect(executed).toEqual([]);

        // Observing the aborted run afterwards replays it and closes.
        const replay = await drain(await agent.observe(run.runId), CLOSE_WITHIN_MS);
        expect(replay.timedOut).toBe(false);
        expect(replay.types).toContain('abort');
        expect(replay.types.at(-1)).toBe('finish');
      } finally {
        run.cleanup?.();
      }
    }, 30_000);

    it('extends the run log retention while the run waits for approval', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_retain', name: 'lookup_status', arguments: { query: 'alpha' } }] },
      );
      const lookup = createTool({
        id: 'lookup_status',
        description: 'Look up a status.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => ({ status: `OK:${query}` }),
      });
      const cache = new RecordingCache();
      const { agent } = await createSharedAgent(llm, { engine, cache, tools: { lookup_status: lookup } });

      const run = await agent.stream('Look up alpha', { requireToolApproval: true, maxSteps: 5 });
      try {
        let toolCallId: string | undefined;
        for await (const chunk of run.fullStream) {
          if (chunk.type === 'tool-call-approval') {
            toolCallId = chunk.payload.toolCallId;
            break;
          }
        }
        expect(toolCallId).toBe('call_retain');

        // The retention bump lands once the leg has settled as suspended, which is
        // after the approval chunk reached the stream.
        await vi.waitFor(
          () => {
            const extended = cache.expirations.filter(([, ttl]) => ttl === SUSPENDED_RUN_LOG_RETENTION_MS);
            const keys = extended.map(([key]) => key);
            expect(keys.some(key => key.includes(run.runId) && !key.endsWith(':counter'))).toBe(true);
            // The counter has to outlive the list, so both carry the new deadline.
            expect(keys.some(key => key.includes(run.runId) && key.endsWith(':counter'))).toBe(true);
          },
          { timeout: 5_000 },
        );
      } finally {
        run.cleanup?.();
      }
    }, 30_000);
  },
  { skip: ['normal', 'fs'] },
);
