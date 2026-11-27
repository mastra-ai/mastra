/**
 * Regression test for #28229: a cold durable resume with data that fails the suspended tool's
 * resumeSchema must reject before it touches the run, so a corrected retry still resumes it.
 * Warm resumes keep the tools the run was registered with and are left to the tool-call step.
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
import type { AgentConfig } from '../../types';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

type Engine = 'durable' | 'evented';
type AgentOverrides = Pick<AgentConfig, 'tools' | 'inputProcessors'>;

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const pubsubs: EventEmitterPubSub[] = [];
const fga: IFGAProvider = {
  check: async () => true,
  require: async (user, input) => {
    if (user.id === 'denied') throw new FGADeniedError(user, input.resource, input.permission);
  },
  filterAccessible: async () => [],
};

function confirmTool(seen: unknown[], resumeSchema: z.ZodType = z.object({ confirmed: z.boolean() })) {
  return createTool({
    id: 'confirm',
    description: 'Asks the user to confirm',
    inputSchema: z.object({}),
    resumeSchema,
    execute: async (_input, context) => {
      if (!context?.agent?.resumeData) return context?.agent?.suspend?.({ question: 'Confirm?' });
      seen.push({ ...context.agent.resumeData, tenant: context.requestContext?.get('tenant') });
      return { ok: true };
    },
  });
}

function startProcess(engine: Engine, storage: InMemoryStore, seen: unknown[], overrides?: AgentOverrides) {
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
  const agent = new Agent({
    id: 'confirmer',
    name: 'confirmer',
    instructions: 'Confirm.',
    model,
    tools: { confirm: confirmTool(seen) },
    ...overrides,
  });
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

async function suspend(engine: Engine, overrides?: (seen: unknown[]) => AgentOverrides) {
  globalRunRegistry.clear();
  const storage = new InMemoryStore();
  const seen: unknown[] = [];
  const agent = startProcess(engine, storage, seen, overrides?.(seen));
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

async function suspendCold(engine: Engine) {
  const run = await suspend(engine);
  globalRunRegistry.clear();
  return { ...run, agent: startProcess(engine, run.storage, run.seen) };
}

afterEach(async () => {
  globalRunRegistry.clear();
  await Promise.allSettled(pubsubs.splice(0).map(pubsub => pubsub.close()));
});

describe.each(['durable', 'evented'] as const)(
  '%s agent resume with data that fails the resumeSchema (#28229)',
  engine => {
    it.each([false, true])(
      'cold (untilIdle: %s): rejects without touching the run, and a corrected retry sees the original context',
      async untilIdle => {
        const run = await suspendCold(engine);

        await expect(
          run.agent.resume(run.runId, { confirmed: 'yes' }, { untilIdle, requestContext: tenant('rejected') }),
        ).rejects.toMatchObject({ id: 'AGENT_RESUME_INVALID_DATA' });
        expect(run.seen).toEqual([]);
        expect(globalRunRegistry.get(run.runId)).toBeUndefined();

        expect(await drain(await run.agent.resumeStream({ confirmed: true }, { runId: run.runId }))).toBe('done');
        expect(run.seen).toEqual([{ confirmed: true, tenant: 'original' }]);
      },
    );

    it('cold: reports an authorization denial before invalid resume data', async () => {
      const run = await suspendCold(engine);

      await expect(
        run.agent.resumeStream({ confirmed: 'yes' }, { runId: run.runId, requestContext: tenant('other', 'denied') }),
      ).rejects.toThrow(FGADeniedError);
    });

    describe('warm resumes run the tool the run was registered with', () => {
      it('a call-time toolset that shadows the suspended tool', async () => {
        const run = await suspend(engine);
        const toolsets = { replacement: { confirm: confirmTool([], z.object({ confirmed: z.string() })) } };

        expect(await drain(await run.agent.resumeStream({ confirmed: true }, { runId: run.runId, toolsets }))).toBe(
          'done',
        );
        expect(run.seen).toEqual([{ confirmed: true, tenant: 'original' }]);
      });

      it.each(['changes schema', 'throws'] as const)('a dynamic tools resolver that now %s', async change => {
        let resolved = 0;
        const run = await suspend(engine, seen => ({
          tools: () => {
            resolved++;
            if (resolved === 1) return { confirm: confirmTool(seen) };
            if (change === 'throws') throw new Error('resolver unavailable');
            return { confirm: confirmTool(seen, z.object({ confirmed: z.string() })) };
          },
        }));

        expect(await drain(await run.agent.resumeStream({ confirmed: true }, { runId: run.runId }))).toBe('done');
        expect(run.seen).toEqual([{ confirmed: true, tenant: 'original' }]);
      });

      it('a processor that replaces an assigned tool under the same name', async () => {
        const run = await suspend(engine, seen => ({
          tools: { confirm: confirmTool(seen, z.object({ confirmed: z.string() })) },
          inputProcessors: [
            {
              id: 'replace-confirm',
              processInputStep: ({ tools }: { tools?: Record<string, unknown> }) => ({
                tools: { ...tools, confirm: confirmTool(seen) },
              }),
            },
          ],
        }));

        expect(await drain(await run.agent.resumeStream({ confirmed: true }, { runId: run.runId }))).toBe('done');
        expect(run.seen).toEqual([{ confirmed: true, tenant: 'original' }]);
      });
    });
  },
);
