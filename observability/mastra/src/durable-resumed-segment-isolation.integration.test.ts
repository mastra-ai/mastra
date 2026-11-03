/**
 * A resumed durable segment is isolated from the run's first segment and from user code: the span
 * pair it carries to the workers stays out of the request context a tool sees, and the clocks an
 * older snapshot persisted for the first segment are never reported on the resumed pair.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent, DurableStepIds, globalRunRegistry } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Observability } from './default';
import { TestExporter } from './exporters';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const CARRIER_KEY = 'mastra__durableSegments';
const CLAIM_KEY = 'mastra__durableExecutions';

function observability(exporter: TestExporter) {
  return new Observability({ configs: { test: { serviceName: 'resumed-segment', exporters: [exporter] } } });
}

describe('a resumed segment keeps its span pair private to the engine', () => {
  for (const engine of ['durable', 'evented'] as const) {
    it(`${engine}: a tool run by the resumed segment sees no segment carrier in its request context`, async () => {
      let calls = 0;
      const model = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            ...(++calls === 1
              ? [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'inspect', input: '{}' }]
              : [
                  { type: 'text-start', id: 't' },
                  { type: 'text-delta', id: 't', delta: 'done' },
                  { type: 'text-end', id: 't' },
                ]),
            { type: 'finish', finishReason: calls === 1 ? 'tool-calls' : 'stop', usage },
          ] as any[]),
        }),
      });
      const seen: Array<{ get: unknown; entries: string[]; json: string[] }> = [];
      const agent = new Agent({
        id: `inspect-${engine}`,
        name: 'inspect',
        instructions: 'Use tools.',
        model,
        tools: {
          inspect: createTool({
            id: 'inspect',
            description: 'Reports the request context it ran with',
            inputSchema: z.object({}),
            requireApproval: true,
            execute: async (_input, context) => {
              const requestContext = context!.requestContext!;
              seen.push({
                get: requestContext.get(CARRIER_KEY),
                entries: [...requestContext.entries()].map(([key]) => key),
                json: Object.keys(requestContext.toJSON()),
              });
              return { ok: true };
            },
          }),
        },
      });
      const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
      const exporter = new TestExporter({ validateLifecycle: false, logMetricsOnFlush: false });
      const mastra = new Mastra({
        agents: { runner },
        storage: new InMemoryStore(),
        logger: false,
        observability: observability(exporter),
      });
      try {
        const first = await runner.generate('Inspect.', { maxSteps: 5 });
        expect(first.finishReason).toBe('suspended');
        const detail = await runner.getWorkflow().getWorkflowRunById(first.runId, { fields: ['requestContext'] });
        expect(Object.keys(detail?.requestContext ?? {}).filter(key => key.startsWith('mastra__'))).toEqual([]);

        const resumed = await runner.resumeGenerate(
          first.runId,
          { approved: true },
          { toolCallId: 'call-1', maxSteps: 5 },
        );
        expect(resumed.finishReason).toBe('stop');
        await mastra.observability?.flush();

        // The resumed segment opened its own pair: the worker ran the tool under it.
        expect(exporter.getSpansByType(SpanType.AGENT_RUN).map(span => span.metadata?.resumed)).toEqual([
          undefined,
          true,
        ]);
        expect(seen).toHaveLength(1);
        expect(seen[0]!.get).toBeUndefined();
        expect(seen[0]!.entries).not.toContain(CARRIER_KEY);
        expect(seen[0]!.json).not.toContain(CARRIER_KEY);
      } finally {
        await mastra.shutdown();
      }
    }, 30_000);
  }
});

describe('a resumed segment keeps the engine keys out of processors', () => {
  const PROCESSOR_SURFACES = ['processInputStep', 'processOutputStep', 'processOutputResult'] as const;
  for (const engine of ['durable', 'evented'] as const) {
    for (const [cold, clear] of [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ]) {
      it(`${engine} ${cold ? 'cold' : 'warm'} ${clear ? 'clear' : 'read'}: processors see neither the segment carrier nor the execution claim`, async () => {
        let calls = 0;
        const model = new MockLanguageModelV2({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              ...(++calls === 1
                ? [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'inspect', input: '{}' }]
                : [
                    { type: 'text-start', id: 't' },
                    { type: 'text-delta', id: 't', delta: 'done' },
                    { type: 'text-end', id: 't' },
                  ]),
              { type: 'finish', finishReason: calls === 1 ? 'tool-calls' : 'stop', usage },
            ] as any[]),
          }),
        });
        const seen: Record<string, string[][]> = {};
        const record = (surface: string, requestContext: RequestContext | undefined) => {
          if (!requestContext) return;
          (seen[surface] ??= []).push([...requestContext.entries()].map(([key]) => key));
        };
        const storage = new InMemoryStore();
        const exporter = new TestExporter({ validateLifecycle: false, logMetricsOnFlush: false });
        const build = () => {
          const agent = new Agent({
            id: `processor-keys-${engine}`,
            name: 'processor keys',
            instructions: ({ requestContext }) => {
              record('instructions', requestContext);
              return 'Use tools.';
            },
            model,
            inputProcessors: [
              {
                id: 'record-input',
                processInputStep: async ({ requestContext, messageList }: any) => {
                  record('processInputStep', requestContext);
                  if (clear) requestContext.clear();
                  return messageList;
                },
              } as any,
            ],
            outputProcessors: [
              {
                id: 'record-output',
                processOutputStep: async ({ requestContext, messages }: any) => {
                  record('processOutputStep', requestContext);
                  return messages;
                },
                processOutputResult: async ({ requestContext, messages }: any) => {
                  record('processOutputResult', requestContext);
                  return messages;
                },
              } as any,
            ],
            tools: {
              inspect: createTool({
                id: 'inspect',
                description: 'Records the request context it ran with',
                inputSchema: z.object({}),
                requireApproval: true,
                execute: async (_input, context) => {
                  record('tool', context!.requestContext);
                  return { ok: true };
                },
              }),
            },
          });
          const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
          const mastra = new Mastra({
            agents: { runner },
            storage,
            logger: false,
            observability: observability(exporter),
          });
          return { runner, mastra };
        };
        let { runner, mastra } = build();
        try {
          const first = await runner.generate('Inspect.', { maxSteps: 5 });
          expect(first.finishReason).toBe('suspended');
          if (cold) {
            await mastra.shutdown();
            globalRunRegistry.clear();
            ({ runner, mastra } = build());
          }
          const before = Object.fromEntries(Object.entries(seen).map(([surface, list]) => [surface, list.length]));
          const resumed = await runner.resumeGenerate(
            first.runId,
            { approved: true },
            { toolCallId: 'call-1', maxSteps: 5 },
          );
          expect(resumed.finishReason).toBe('stop');

          if (clear && engine === 'durable') {
            await mastra.observability?.flush();
            for (const type of [SpanType.AGENT_RUN, SpanType.MODEL_GENERATION]) {
              const started = exporter.events.filter(
                event => event.type === TracingEventType.SPAN_STARTED && event.exportedSpan.type === type,
              );
              expect(started).toHaveLength(2);
              for (const event of started) {
                const ends = exporter.events.filter(
                  end => end.type === TracingEventType.SPAN_ENDED && end.exportedSpan.id === event.exportedSpan.id,
                );
                expect(ends, `${type} ${event.exportedSpan.id} ends once`).toHaveLength(1);
              }
            }
          }

          for (const [surface, list] of Object.entries(seen)) {
            for (const keys of list) expect(keys, `${surface} never sees the carrier`).not.toContain(CARRIER_KEY);
          }
          for (const surface of PROCESSOR_SURFACES) {
            const afterResume = (seen[surface] ?? []).slice(before[surface] ?? 0);
            expect(afterResume.length, `${surface} ran on the resumed segment`).toBeGreaterThan(0);
            for (const keys of afterResume) expect(keys, `${surface} never sees the claim`).not.toContain(CLAIM_KEY);
          }
        } finally {
          await mastra.shutdown();
        }
      }, 30_000);
    }
  }
});

describe('a resumed segment reports only clocks measured under its own MODEL_GENERATION', () => {
  it('does not borrow the first segment clocks from a snapshot persisted before clockSpanId existed', async () => {
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'wait', input: '{}' },
            { type: 'finish', finishReason: 'tool-calls', usage },
          ] as any[]),
        };
      },
    });
    const storage = new InMemoryStore();
    const exporter = new TestExporter({ validateLifecycle: false, logMetricsOnFlush: false });
    const runId = 'legacy-clocks';
    const process = () => {
      globalRunRegistry.clear();
      const agent = new Agent({
        id: 'wait-agent',
        name: 'wait',
        instructions: 'Wait.',
        model,
        tools: {
          wait: createTool({
            id: 'wait',
            description: 'Waits for another approval',
            inputSchema: z.object({}),
            suspendSchema: z.object({ again: z.boolean() }),
            resumeSchema: z.object({ approved: z.boolean() }),
            execute: async (_input, context) => {
              await context!.agent!.suspend({ again: true });
              return { ok: false };
            },
          }),
        },
      });
      const runner = createDurableAgent({ agent });
      const mastra = new Mastra({ agents: { runner }, storage, logger: false, observability: observability(exporter) });
      return { runner, mastra };
    };

    const start = process();
    try {
      const started = await start.runner.generate('Wait.', { runId, maxSteps: 5 });
      expect(started.finishReason).toBe('suspended');
      expect(calls).toBe(1);
    } finally {
      await start.mastra.shutdown();
    }

    // The run's snapshots (loop and nested execution) as an older core persisted them: clocks with
    // no owner, on the loop state and on the suspended tool call's input.
    const workflows = (await storage.getStore('workflows'))!;
    let stripped = 0;
    for (const workflowName of [DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION]) {
      const snapshot = await workflows.loadWorkflowSnapshot({ workflowName, runId });
      const legacy = JSON.parse(JSON.stringify(snapshot), (key, value) => {
        if (key !== 'clockSpanId') return value;
        stripped++;
        return undefined;
      });
      await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: legacy });
    }
    expect(stripped).toBeGreaterThan(0);

    const resume = process();
    try {
      const resumed = await resume.runner.resumeGenerate(
        runId,
        { approved: true },
        { toolCallId: 'call-1', maxSteps: 5 },
      );
      expect(resumed.finishReason).toBe('suspended');
      expect(calls, 'the resumed tool suspends again before any inference').toBe(1);
      await resume.mastra.observability?.flush();
    } finally {
      await resume.mastra.shutdown();
    }

    const generations = exporter.getSpansByType(SpanType.MODEL_GENERATION);
    expect(generations.map(span => span.metadata?.resumed)).toEqual([undefined, true]);
    const [first, second] = generations.map(span => span.attributes as any);
    expect(first?.timeToFirstTokenMs).toBeGreaterThan(0);
    expect(second?.completionStartTime).toBeUndefined();
    expect(second?.timeToFirstTokenMs).toBeUndefined();
  }, 30_000);
});

describe('resumed run listings keep the carrier in storage only', () => {
  it.each(['durable', 'evented'] as const)(
    '%s lists user values and the claim without changing the stored snapshot',
    async engine => {
      let calls = 0;
      const model = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'tool-call', toolCallId: `call-${++calls}`, toolName: 'approve', input: '{}' },
            { type: 'finish', finishReason: 'tool-calls', usage },
          ]),
        }),
      });
      const agent = new Agent({
        id: `listing-${engine}`,
        name: 'listing',
        instructions: 'Use tools.',
        model,
        tools: {
          approve: createTool({
            id: 'approve',
            description: 'Wait for approval',
            inputSchema: z.object({}),
            requireApproval: true,
            execute: async () => ({ approved: true }),
          }),
        },
      });
      const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
      const storage = new InMemoryStore();
      const mastra = new Mastra({ agents: { runner }, storage, logger: false });
      try {
        const first = await runner.generate('Approve twice.', {
          maxSteps: 5,
          requestContext: new RequestContext([
            ['tag', 'customer'],
            ['mastra__other', 'keep'],
          ]),
        });
        expect(first.finishReason).toBe('suspended');
        const resumed = await runner.resumeGenerate(
          first.runId,
          { approved: true },
          { toolCallId: 'call-1', maxSteps: 5 },
        );
        expect(resumed.finishReason).toBe('suspended');
        const workflow = runner.getWorkflow();
        const store = (await storage.getStore('workflows'))!;
        const stored = await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: first.runId });
        expect(stored?.requestContext?.[CARRIER_KEY]).toBeDefined();
        const before = structuredClone(stored);
        for (const listed of [
          await workflow.listWorkflowRuns(),
          await mastra.getWorkflow(workflow.id).listWorkflowRuns(),
        ]) {
          const row = listed.runs.find(run => run.runId === first.runId)!;
          if (typeof row.snapshot === 'string') throw new Error('Expected parsed snapshot');
          expect(row.snapshot.requestContext).not.toHaveProperty(CARRIER_KEY);
          expect(row.snapshot.requestContext).toEqual({
            tag: 'customer',
            mastra__other: 'keep',
            [CLAIM_KEY]: stored!.requestContext![CLAIM_KEY],
          });
          expect(row.snapshot.requestContext?.[CLAIM_KEY]).toBeDefined();
        }
        expect(await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: first.runId })).toEqual(before);
        expect(JSON.stringify(await runner.listSuspendedRuns())).not.toContain(CARRIER_KEY);
      } finally {
        await mastra.shutdown();
      }
    },
    30_000,
  );
});
