import { it, expect, vi } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  useLoopScenarioAimock,
  describeForAllEngines,
  isDurableEngineVariant,
} from '../aimock-scenario';

/**
 * Regression classes (#27539): an `untilIdle` stream whose run is parked on a
 * tool approval or a tool `suspend()`.
 *
 *  - breaking out of `for await` at the pause chunk only detaches the reader;
 *    `resumeStreamUntilIdle` still resumes the run on every engine,
 *  - a request `abortSignal` that fires after the run parked detaches the same
 *    way (server routes wire the HTTP request signal into this option),
 *  - breaking out while a tool is still executing (not parked) still aborts
 *    the run,
 *  - an explicit `result.abort()` on a parked run still releases it.
 */

const BG_CONFIG = { enabled: true, globalConcurrency: 5, perAgentConcurrency: 3 };

type Chunk = { type: string; payload?: any };
type Mode = 'approval' | 'suspend';

async function collect(stream: AsyncIterable<unknown>): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  for await (const chunk of stream) chunks.push(chunk as Chunk);
  return chunks;
}

function textOf(chunks: Chunk[]) {
  return chunks
    .filter(c => c.type === 'text-delta')
    .map(c => c.payload?.text ?? '')
    .join('');
}

const pauseChunkType = (mode: Mode) => (mode === 'approval' ? 'tool-call-approval' : 'tool-call-suspended');

describeForAllEngines('AIMock loop scenario: cancelling an untilIdle stream while its run is parked', engine => {
  const getMock = useLoopScenarioAimock();

  async function setup(mode: Mode, name: string) {
    const llm = getMock();
    const memory = new MockMemory();
    const thread = { thread: `${name}-${mode}-thread`, resource: `${name}-${mode}-user` };
    const lookup = createTool({
      id: 'lookup',
      description: 'Look up a user record',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ id: z.string(), email: z.string() }),
      ...(mode === 'approval' ? { requireApproval: true } : {}),
      suspendSchema: z.object({ ask: z.string() }),
      resumeSchema: z.object({ domain: z.string() }),
      execute: async ({ name }, options) => {
        const domain = mode === 'approval' ? 'example.com' : options?.agent?.resumeData?.domain;
        if (!domain) return options?.agent?.suspend?.({ ask: 'email-domain' }) as any;
        return { id: `user-${name.toLowerCase()}`, email: `${name.toLowerCase()}@${domain}` };
      },
    });
    const research = createTool({
      id: 'research',
      description: 'Research a topic in the background',
      inputSchema: z.object({ topic: z.string() }),
      background: { enabled: true },
      execute: async () => ({ summary: 'done' }),
    });
    const shared = await createSharedAgent(llm, {
      tools: { lookup, research },
      agentBackgroundTasks: { tools: { research: true } },
      backgroundTasks: BG_CONFIG,
      memory,
      engine,
    });
    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { toolCalls: [{ id: 'call-lookup-1', name: 'lookup', arguments: { name: 'Dero' } }] },
    );
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Dero is dero@example.com.' });

    const resume = (runId: string) =>
      shared.agent.resumeStreamUntilIdle(mode === 'approval' ? { approved: true } : { domain: 'example.com' }, {
        runId,
        toolCallId: 'call-lookup-1',
        memory: thread,
      });

    return { shared, thread, resume };
  }

  async function expectResumes(resume: () => Promise<any>) {
    const resumed = await resume();
    const chunks = await collect(resumed.fullStream as AsyncIterable<unknown>);
    const lookupResult = chunks.find(c => c.type === 'tool-result' && c.payload?.toolName === 'lookup');
    expect(lookupResult?.payload.result).toEqual({ id: 'user-dero', email: 'dero@example.com' });
    expect(textOf(chunks)).toBe('Dero is dero@example.com.');
  }

  for (const mode of ['approval', 'suspend'] as const) {
    it(`breaking out of the stream at ${pauseChunkType(mode)} keeps the run resumable`, async () => {
      const { shared, thread, resume } = await setup(mode, 'break');
      const result = await shared.agent.streamUntilIdle('Look up Dero', { memory: thread });

      let pause: Chunk | undefined;
      for await (const chunk of result.fullStream as AsyncIterable<Chunk>) {
        if (chunk.type === pauseChunkType(mode)) {
          pause = chunk;
          break;
        }
      }
      expect(pause?.payload.toolCallId).toBe('call-lookup-1');

      await expectResumes(() => resume(result.runId));
    }, 30_000);

    it(`a request abortSignal firing at ${pauseChunkType(mode)} keeps the run resumable`, async () => {
      const { shared, thread, resume } = await setup(mode, 'signal');
      const request = new AbortController();
      const result = await shared.agent.streamUntilIdle('Look up Dero', {
        memory: thread,
        abortSignal: request.signal,
      });

      const chunks: Chunk[] = [];
      for await (const chunk of result.fullStream as AsyncIterable<Chunk>) {
        chunks.push(chunk);
        if (chunk.type === pauseChunkType(mode)) request.abort();
      }
      expect(chunks.find(c => c.type === pauseChunkType(mode))?.payload.toolCallId).toBe('call-lookup-1');

      await expectResumes(() => resume(result.runId));
    }, 30_000);

    // The normal engine keeps a suspended run resumable from its snapshot
    // even after abort(), so only durable engines release it.
    it.runIf(isDurableEngineVariant(engine))(
      `an explicit abort() at ${pauseChunkType(mode)} still releases the parked run`,
      async () => {
        const { shared, thread, resume } = await setup(mode, 'abort');
        const result = await shared.agent.streamUntilIdle('Look up Dero', { memory: thread });

        const reader = (result.fullStream as ReadableStream<Chunk>).getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done || value.type === pauseChunkType(mode)) break;
        }
        reader.releaseLock();

        await result.abort();

        await expect(resume(result.runId)).rejects.toThrow(/cannot resume/i);
      },
      30_000,
    );
  }

  it('breaking out of the stream while a tool is still running aborts the run', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    let toolSignal: AbortSignal | undefined;
    let markStarted!: () => void;
    const started = new Promise<void>(resolve => (markStarted = resolve));
    const slow = createTool({
      id: 'slow',
      description: 'Takes a while',
      inputSchema: z.object({ name: z.string() }),
      execute: async (_input, context) => {
        toolSignal = context?.abortSignal;
        markStarted();
        await new Promise<void>(resolve => {
          if (toolSignal?.aborted) return resolve();
          toolSignal?.addEventListener('abort', () => resolve(), { once: true });
        });
        return { ok: true };
      },
    });
    const research = createTool({
      id: 'research',
      description: 'Research a topic in the background',
      inputSchema: z.object({ topic: z.string() }),
      background: { enabled: true },
      execute: async () => ({ summary: 'done' }),
    });
    const shared = await createSharedAgent(llm, {
      tools: { slow, research },
      agentBackgroundTasks: { tools: { research: true } },
      backgroundTasks: BG_CONFIG,
      memory,
      engine,
    });
    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { toolCalls: [{ id: 'call-slow-1', name: 'slow', arguments: { name: 'Dero' } }] },
    );
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Done.' });

    const result = await shared.agent.streamUntilIdle('Run slow', {
      memory: { thread: 'running-thread', resource: 'running-user' },
    });
    for await (const chunk of result.fullStream as AsyncIterable<Chunk>) {
      if (chunk.type === 'tool-call') {
        await started;
        break;
      }
    }

    await vi.waitFor(() => expect(toolSignal?.aborted).toBe(true), { timeout: 10_000, interval: 20 });
    expect(llm.getRequests()).toHaveLength(1);
  }, 30_000);
});
