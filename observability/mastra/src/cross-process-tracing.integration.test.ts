/**
 * Runs continued by another process, after a restart or a crash, must stay on the trace they
 * started in, end every span they open, and store their scores against that trace.
 *
 * Each "process" is a fresh Mastra with a fresh agent or workflow. A resume shares the storage
 * of the process that suspended the run. A crashed run is copied into fresh storage instead,
 * which leaves the dead process's ownership lease behind, as a real crash does. Agent crash
 * recovery refuses a run this process still executes, so it is covered at the workflow level,
 * where `restart()` hands the engine its run span.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgent } from '@mastra/core/agent/durable';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { SamplingStrategyType, SpanType, TracingEventType } from '@mastra/core/observability';
import type { SamplingStrategy } from '@mastra/core/observability';
import type { Processor } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createEventedWorkflow, createStep } from '@mastra/core/workflows';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Observability } from './default';
import { TestExporter } from './exporters';

const hosts: Mastra[] = [];
const unblock: Array<() => void> = [];
afterEach(async () => {
  for (const release of unblock.splice(0)) release();
  await Promise.all(hosts.splice(0).map(host => host.shutdown()));
});

function observability(exporter: TestExporter, sampling?: SamplingStrategy) {
  return new Observability({ configs: { test: { serviceName: 'cross-process', exporters: [exporter], sampling } } });
}

/** Calls `pay` until the prompt carries its result, then answers, so every process agrees on the next turn. */
function payModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const paid = prompt.some(message => message.role === 'tool');
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          ...(paid
            ? [
                { type: 'text-start' as const, id: 't' },
                { type: 'text-delta' as const, id: 't', delta: 'paid' },
                { type: 'text-end' as const, id: 't' },
              ]
            : [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'pay', input: '{}' }]),
          {
            type: 'finish',
            finishReason: paid ? 'stop' : 'tool-calls',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ]),
      };
    },
  });
}

const always = createScorer({ id: 'always', description: 'Always 1', type: 'agent' }).generateScore(() => 1);

function startAgentProcess(
  storage: InMemoryStore,
  exporter: TestExporter,
  { inputProcessors = [], sampling }: { inputProcessors?: Processor[]; sampling?: SamplingStrategy } = {},
) {
  const pay = createTool({
    id: 'pay',
    description: 'Pay the bill',
    inputSchema: z.object({}),
    requireApproval: true,
    execute: async () => ({ paid: true }),
  });
  const agent = new Agent({
    id: 'payer',
    name: 'payer',
    instructions: 'Pay the bill, then answer.',
    model: payModel(),
    tools: { pay },
    scorers: { always: { scorer: always } },
    inputProcessors,
  });
  const mastra = new Mastra({
    agents: { payer: createDurableAgent({ agent }) },
    scorers: { always },
    storage,
    logger: false,
    observability: observability(exporter, sampling),
  });
  hosts.push(mastra);
  return mastra.getAgent('payer') as unknown as DurableAgent;
}

async function drain(output: { fullStream: AsyncIterable<{ type: string; payload?: any }> }) {
  let approvalToolCallId: string | undefined;
  for await (const chunk of output.fullStream) {
    if (chunk.type === 'tool-call-approval') approvalToolCallId = chunk.payload.toolCallId;
  }
  return approvalToolCallId;
}

async function scoreOf(storage: InMemoryStore, runId: string) {
  const scores = await storage.getStore('scores');
  const list = async () => (await scores!.listScoresByRunId({ runId, pagination: { page: 0, perPage: 10 } })).scores;
  await expect.poll(async () => (await list()).length, { timeout: 5_000 }).toBe(1);
  return (await list())[0]!;
}

/** Copies every workflow snapshot into fresh storage, the way a new process finds a crashed run. */
async function copyWorkflowRuns(from: InMemoryStore) {
  const source = await from.getStore('workflows');
  const storage = new InMemoryStore();
  const target = await storage.getStore('workflows');
  const { runs } = await source!.listWorkflowRuns();
  for (const run of runs) {
    const snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
    await target!.persistWorkflowSnapshot({ workflowName: run.workflowName, runId: run.runId, snapshot });
  }
  return storage;
}

describe('a durable agent run resumed by another process', () => {
  it('keeps one trace and stores its score against it', async () => {
    const storage = new InMemoryStore();
    const exporter = new TestExporter();

    const started = await startAgentProcess(storage, exporter).stream('Pay the bill.', { closeOnSuspend: true });
    const toolCallId = await drain(started);
    expect(toolCallId).toBe('call-1');
    const resumed = await startAgentProcess(storage, exporter).approveToolCall({
      runId: started.runId,
      toolCallId: toolCallId!,
    });
    await drain(resumed);

    const score = await scoreOf(storage, started.runId);
    const agentRuns = exporter.getSpansByType(SpanType.AGENT_RUN);
    const traceId = agentRuns.find(span => span.isRootSpan)!.traceId;
    expect(agentRuns.map(span => span.name)).toEqual(["agent run: 'payer'", "agent run: 'payer' (resumed)"]);
    expect(new Set(agentRuns.map(span => span.traceId))).toEqual(new Set([traceId]));
    expect(exporter.getIncompleteSpans()).toEqual([]);
    expect(score.traceId).toBe(traceId);
    expect(exporter.getByTraceId(traceId).spans.map(span => span.id)).toContain(score.spanId);
  });

  it('leaves the suspended run span as saved when the resume fails to start', async () => {
    const storage = new InMemoryStore();
    const exporter = new TestExporter();
    const started = await startAgentProcess(storage, exporter).stream('Pay the bill.', { closeOnSuspend: true });
    const toolCallId = await drain(started);
    const [original] = exporter.getSpansByType(SpanType.AGENT_RUN);

    const unavailable: Processor = {
      id: 'unavailable',
      processInput: () => {
        throw new Error('processor unavailable');
      },
    };
    await expect(
      startAgentProcess(storage, exporter, { inputProcessors: [unavailable] }).approveToolCall({
        runId: started.runId,
        toolCallId: toolCallId!,
      }),
    ).rejects.toThrow('Input processor error');

    const ends = exporter.getBySpanId(original!.id).events.filter(event => event.type === TracingEventType.SPAN_ENDED);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.exportedSpan.errorInfo).toBeUndefined();
  });

  it('still resumes when the saved run span cannot be rebuilt', async () => {
    const storage = new InMemoryStore();
    const exporter = new TestExporter();
    const started = await startAgentProcess(storage, exporter).stream('Pay the bill.', { closeOnSuspend: true });
    const toolCallId = await drain(started);

    const workflows = await storage.getStore('workflows');
    const snapshot = await workflows!.loadWorkflowSnapshot({
      workflowName: 'durable-agentic-loop',
      runId: started.runId,
    });
    (snapshot!.context.input as { agentSpanData: { links: unknown } }).agentSpanData.links = 'not a list';
    await workflows!.persistWorkflowSnapshot({
      workflowName: 'durable-agentic-loop',
      runId: started.runId,
      snapshot: snapshot!,
    });

    await drain(
      await startAgentProcess(storage, exporter).approveToolCall({ runId: started.runId, toolCallId: toolCallId! }),
    );

    expect((await scoreOf(storage, started.runId)).score).toBe(1);
  });

  it('leaves a run its sampler skipped unrecorded when another process resumes it', async () => {
    const storage = new InMemoryStore();
    const exporter = new TestExporter();
    let sampleResume = false;
    const sampling: SamplingStrategy = { type: SamplingStrategyType.CUSTOM, sampler: () => sampleResume };
    const passThrough: Processor = { id: 'pass-through', processInput: ({ messages }) => messages };

    const started = await startAgentProcess(storage, exporter, { sampling }).stream('Pay the bill.', {
      closeOnSuspend: true,
    });
    const toolCallId = await drain(started);
    sampleResume = true;
    const consoleError = vi.spyOn(console, 'error');
    await drain(
      await startAgentProcess(storage, exporter, { sampling, inputProcessors: [passThrough] }).approveToolCall({
        runId: started.runId,
        toolCallId: toolCallId!,
      }),
    );
    await scoreOf(storage, started.runId);

    const inputProcessorSpans = exporter.getAllSpans().filter(span => span.name === 'input processor: pass-through');
    expect(inputProcessorSpans).toEqual([]);
    expect(exporter.getIncompleteSpans().map(({ span }) => `${span?.type} ${span?.name}`)).toEqual([]);
    expect(consoleError.mock.calls.filter(([message]) => String(message).includes('Invalid traceId'))).toEqual([]);
    consoleError.mockRestore();
  });
});

describe('an evented workflow run continued after it stopped', () => {
  const makeWorkflow = (work: () => Promise<void>) => {
    const step = createStep({
      id: 'work',
      inputSchema: z.object({}),
      outputSchema: z.object({ done: z.boolean() }),
      execute: async () => {
        await work();
        return { done: true };
      },
    });
    return createEventedWorkflow({
      id: 'cross-process-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ done: z.boolean() }),
      steps: [step],
    })
      .then(step)
      .commit();
  };

  /** Wrapped because a workflow's `.then()` builder makes it look like a promise to `await`. */
  async function startWorkflowProcess(storage: InMemoryStore, exporter: TestExporter, work: () => Promise<void>) {
    const workflow = makeWorkflow(work);
    const mastra = new Mastra({
      storage,
      logger: false,
      workflows: { 'cross-process-workflow': workflow },
      observability: observability(exporter),
    });
    hosts.push(mastra);
    await mastra.startWorkers();
    return { workflow };
  }

  /** The run span ended and every step span nests under it. */
  function expectStepsUnderEndedRunSpan(exporter: TestExporter) {
    const [runSpan, ...others] = exporter.getSpansByType(SpanType.WORKFLOW_RUN);
    expect(others).toEqual([]);
    const steps = exporter.getSpansByType(SpanType.WORKFLOW_STEP);
    expect(steps.map(span => span.name)).toEqual(["workflow step: 'work'"]);
    expect(steps[0]!.parentSpanId).toBe(runSpan!.id);
    expect(exporter.getIncompleteSpans()).toEqual([]);
  }

  it('runs the restarted steps under a run span that ends', async () => {
    const crashedStorage = new InMemoryStore();
    let stepStarted!: () => void;
    const inStep = new Promise<void>(resolve => (stepStarted = resolve));
    const { workflow: crashed } = await startWorkflowProcess(crashedStorage, new TestExporter(), () => {
      stepStarted();
      return new Promise<void>(resolve => unblock.push(resolve));
    });
    const crashedRun = await crashed.createRun();
    void crashedRun.start({ inputData: {} });
    await inStep;

    const exporter = new TestExporter();
    const { workflow } = await startWorkflowProcess(await copyWorkflowRuns(crashedStorage), exporter, async () => {});
    const restarted = await (await workflow.createRun({ runId: crashedRun.runId })).restart();

    expect(restarted.status).toBe('success');
    expectStepsUnderEndedRunSpan(exporter);
  });

  it('runs a time-travelled step under a run span that ends', async () => {
    const storage = new InMemoryStore();
    const { workflow } = await startWorkflowProcess(storage, new TestExporter(), async () => {});
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('success');

    const exporter = new TestExporter();
    const { workflow: replaying } = await startWorkflowProcess(storage, exporter, async () => {});
    const replayed = await (
      await replaying.createRun({ runId: run.runId })
    ).timeTravel({ step: 'work', inputData: {} });

    expect(replayed.status).toBe('success');
    expectStepsUnderEndedRunSpan(exporter);
  });

  it('still traces a later resume after a time-travelled run suspends', async () => {
    const ask = createStep({
      id: 'ask',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      resumeSchema: z.object({ ok: z.boolean() }),
      execute: async ({ resumeData, suspend }) => {
        if (!resumeData) return suspend({});
        return { ok: resumeData.ok };
      },
    });
    const workflow = createEventedWorkflow({
      id: 'ask-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      steps: [ask],
    })
      .then(ask)
      .commit();
    const exporter = new TestExporter();
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      logger: false,
      workflows: { 'ask-workflow': workflow },
      observability: observability(exporter),
    });
    hosts.push(mastra);
    await mastra.startWorkers();

    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    expect((await run.timeTravel({ step: 'ask', inputData: {} })).status).toBe('suspended');
    expect((await run.resume({ step: 'ask', resumeData: { ok: true } })).status).toBe('success');

    const askSpans = exporter
      .getSpansByType(SpanType.WORKFLOW_STEP)
      .filter(span => span.name === "workflow step: 'ask'");
    expect(askSpans.map(span => span.output)).toContainEqual({ ok: true });
  });
});
