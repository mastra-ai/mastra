/**
 * Regression test for #28229: a durable resume with data that fails the suspended tool's
 * resumeSchema must reject before it touches the run, so a corrected retry still resumes it.
 */
import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { FGADeniedError } from '../../../auth/ee/fga-check';
import type { IFGAProvider } from '../../../auth/ee/interfaces/fga';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import type { ChunkType } from '../../../stream/types';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const pubsubs: EventEmitterPubSub[] = [];
const fga: IFGAProvider = {
  check: async () => true,
  require: async (user, input) => {
    if (user.id === 'denied') throw new FGADeniedError(user, input.resource, input.permission);
  },
  filterAccessible: async () => [],
};

function startProcess(engine: 'durable' | 'evented', storage: InMemoryStore, seen: unknown[]) {
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const parts: LanguageModelV2StreamPart[] = prompt.some(message => message.role === 'tool')
        ? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage },
          ]
        : [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'confirm', input: '{}' },
            { type: 'finish', finishReason: 'tool-calls', usage },
          ];
      return {
        stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
          { type: 'stream-start', warnings: [] },
          ...parts,
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
  const confirm = createTool({
    id: 'confirm',
    description: 'Asks the user to confirm',
    inputSchema: z.object({}),
    resumeSchema: z.object({ confirmed: z.boolean() }),
    execute: async (_input, context) => {
      if (!context?.agent?.resumeData) return context?.agent?.suspend?.({ question: 'Confirm?' });
      seen.push({ ...context.agent.resumeData, tenant: context.requestContext?.get('tenant') });
      return { ok: true };
    },
  });
  const agent = new Agent({ id: 'confirmer', name: 'confirmer', instructions: 'Confirm.', model, tools: { confirm } });
  const pubsub = new EventEmitterPubSub();
  pubsubs.push(pubsub);
  const durable = engine === 'durable' ? createDurableAgent({ agent, pubsub }) : createEventedAgent({ agent, pubsub });
  new Mastra({ agents: { confirmer: durable }, storage, logger: false, server: { fga } });
  return durable;
}

function tenant(name: string, userId = 'allowed') {
  return new RequestContext<unknown>([
    ['tenant', name],
    ['user', { id: userId }],
  ]);
}

async function drain(stream: { fullStream: AsyncIterable<ChunkType> }) {
  const text: string[] = [];
  for await (const chunk of stream.fullStream) if (chunk.type === 'text-delta') text.push(chunk.payload.text);
  return text.join('');
}

async function suspend(engine: 'durable' | 'evented') {
  globalRunRegistry.clear();
  const storage = new InMemoryStore();
  const seen: unknown[] = [];
  const agent = startProcess(engine, storage, seen);
  const started = await agent.stream('go', { requestContext: tenant('original'), closeOnSuspend: true });
  await drain(started);
  const workflows = (await storage.getStore('workflows'))!;
  await vi.waitFor(async () => {
    const snapshot = await workflows.loadWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      runId: started.runId,
    });
    expect(snapshot?.status).toBe('suspended');
  });
  return { agent, storage, seen, runId: started.runId };
}

afterEach(async () => {
  globalRunRegistry.clear();
  await Promise.allSettled(pubsubs.splice(0).map(pubsub => pubsub.close()));
});

describe.each(['durable', 'evented'] as const)(
  '%s agent resume with data that fails the resumeSchema (#28229)',
  engine => {
    it.each(['warm', 'cold'] as const)(
      '%s: rejects without touching the run, and a corrected retry sees the original context',
      async mode => {
        const run = await suspend(engine);
        let agent = run.agent;
        if (mode === 'cold') {
          globalRunRegistry.clear();
          agent = startProcess(engine, run.storage, run.seen);
        }

        await expect(
          agent.resumeStream({ confirmed: 'yes' }, { runId: run.runId, requestContext: tenant('rejected') }),
        ).rejects.toMatchObject({ id: 'AGENT_RESUME_INVALID_DATA' });
        expect(run.seen).toEqual([]);
        if (mode === 'warm') expect(globalRunRegistry.get(run.runId)?.requestContext?.get('tenant')).toBe('original');
        else expect(globalRunRegistry.get(run.runId)).toBeUndefined();

        expect(await drain(await agent.resumeStream({ confirmed: true }, { runId: run.runId }))).toBe('done');
        expect(run.seen).toEqual([{ confirmed: true, tenant: 'original' }]);
      },
    );

    it('reports an authorization denial before invalid resume data', async () => {
      const run = await suspend(engine);

      await expect(
        run.agent.resumeStream({ confirmed: 'yes' }, { runId: run.runId, requestContext: tenant('other', 'denied') }),
      ).rejects.toThrow(FGADeniedError);
    });

    it('rejects the outer call when untilIdle is set', async () => {
      const run = await suspend(engine);

      await expect(run.agent.resume(run.runId, { confirmed: 'yes' }, { untilIdle: true })).rejects.toMatchObject({
        id: 'AGENT_RESUME_INVALID_DATA',
      });
      expect(run.seen).toEqual([]);
    });
  },
);
