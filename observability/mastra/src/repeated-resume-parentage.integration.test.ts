import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import {
  __resetExecutionFencesForTests,
  createDurableAgent,
  DurableAgent,
  globalRunRegistry,
} from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { InternalSpans, SamplingStrategyType, SpanType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Observability } from './default';
import { MastraStorageExporter, TestExporter } from './exporters';

/** Span ids of the caller's own tracing system, passed as `tracingOptions.parentSpanId`. */
const EXTERNAL_AT_START = 'aaaaaaaaaaaaaaaa';
const EXTERNAL_AT_RESUME = 'bbbbbbbbbbbbbbbb';

/** Two distinct tool calls (approval requests by default), then an answer on the third invocation. */
function twoApprovalsModel(toolNames = ['confirm', 'confirm']) {
  let calls = 0;
  const next = () => {
    const call = ++calls;
    const content =
      call <= 2
        ? [{ type: 'tool-call' as const, toolCallId: `call-${call}`, toolName: toolNames[call - 1]!, input: '{}' }]
        : [{ type: 'text' as const, text: 'Both approvals received.' }];
    return {
      content,
      finishReason: call <= 2 ? ('tool-calls' as const) : ('stop' as const),
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
    };
  };
  return new MockLanguageModelV2({
    doGenerate: async () => next(),
    doStream: async () => {
      const result = next();
      const part = result.content[0]!;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          ...(part.type === 'tool-call'
            ? [{ ...part, providerExecuted: false }]
            : [
                { type: 'text-start' as const, id: 'text' },
                { type: 'text-delta' as const, id: 'text', delta: part.text },
                { type: 'text-end' as const, id: 'text' },
              ]),
          { type: 'finish', finishReason: result.finishReason, usage: result.usage },
        ]),
      };
    },
  });
}

async function resumeParents(
  engine: 'normal' | 'durable',
  {
    recreateAgent = false,
    overrideTrace = false,
    external,
  }: { recreateAgent?: boolean; overrideTrace?: boolean; external?: 'start' | 'resume' } = {},
) {
  const replacementTraceId = '11111111111111111111111111111111';
  const exporter = new TestExporter();
  let executions = 0;
  const model = twoApprovalsModel();
  const makeAgent = () =>
    new Agent({
      id: `repeated-resume-${engine}`,
      name: 'Repeated resume',
      instructions: 'Request two approvals, then answer.',
      model,
      tools: {
        confirm: createTool({
          id: 'confirm',
          description: 'Request approval',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => ({ approval: ++executions }),
        }),
      },
    });
  let agent = makeAgent();
  const durable = engine === 'durable' ? createDurableAgent({ agent }) : undefined;
  const storage = new InMemoryStore();
  const makeHost = () =>
    new Mastra({
      agents: { agent: durable ?? agent },
      storage,
      logger: false,
      observability: new Observability({
        configs: { test: { serviceName: 'repeated-resume', exporters: [exporter] } },
      }),
    });
  const hosts = [makeHost()];
  const runId = `repeated-resume-${engine}`;
  const invocationIds: string[] = [];
  async function captureInvocation(count: number) {
    await expect.poll(() => exporter.getSpansByType(SpanType.AGENT_RUN).length).toBe(count);
    const added = exporter.getSpansByType(SpanType.AGENT_RUN).filter(span => !invocationIds.includes(span.id));
    expect(added).toHaveLength(1);
    invocationIds.push(added[0]!.id);
    if (engine === 'normal' && count < 3) {
      const workflows = await storage.getStore('workflows');
      const snapshot = await workflows!.loadWorkflowSnapshot({ workflowName: 'agentic-loop', runId });
      const anchor = invocationIds[overrideTrace && count === 2 ? 1 : 0];
      expect(snapshot?.tracingContext).toEqual({
        traceId: added[0]!.traceId,
        spanId: anchor,
        resumedFromSpanId: anchor,
        externalParentSpanId:
          external === 'start'
            ? EXTERNAL_AT_START
            : external === 'resume' && count === 2
              ? EXTERNAL_AT_RESUME
              : undefined,
      });
    }
  }
  try {
    const first = await (durable ?? agent).generate('Start.', {
      runId,
      maxSteps: 10,
      ...(external === 'start' ? { tracingOptions: { parentSpanId: EXTERNAL_AT_START } } : {}),
    });
    expect(first.finishReason).toBe('suspended');
    expect(executions).toBe(0);
    await captureInvocation(1);

    const resume = (toolCallId: string) => {
      if (recreateAgent) {
        agent = makeAgent();
        hosts.push(makeHost());
      }
      return durable
        ? durable.resumeGenerate(runId, { approved: true }, { toolCallId, maxSteps: 10 })
        : agent.resumeGenerate(
            { approved: true },
            {
              runId,
              toolCallId,
              maxSteps: 10,
              ...(overrideTrace && toolCallId === 'call-1' ? { tracingOptions: { traceId: replacementTraceId } } : {}),
              ...(external === 'resume' && toolCallId === 'call-1'
                ? { tracingOptions: { parentSpanId: EXTERNAL_AT_RESUME } }
                : {}),
            },
          );
    };
    const second = await resume('call-1');
    expect(second.finishReason).toBe('suspended');
    expect(executions).toBe(1);
    await captureInvocation(2);

    const third = await resume('call-2');
    expect(third.finishReason).toBe('stop');
    expect(third.text).toBe('Both approvals received.');
    expect(executions).toBe(2);
    await captureInvocation(3);

    const spans = exporter.getSpansByType(SpanType.AGENT_RUN);
    expect(new Set(spans.map(span => span.traceId)).size).toBe(overrideTrace ? 2 : 1);
    expect(spans.filter(span => !span.parentSpanId)).toHaveLength(overrideTrace ? 2 : 1);
    if (overrideTrace) {
      expect(spans.find(span => span.id === invocationIds[0])!.traceId).not.toBe(replacementTraceId);
      for (const id of invocationIds.slice(1)) {
        expect(spans.find(span => span.id === id)!.traceId).toBe(replacementTraceId);
      }
    }
    // Compare both the direct parent type and its containing invocation, without
    // prescribing chain vs siblings or assuming the direct parent is AGENT_RUN.
    const allSpans = new Map(exporter.getAllSpans().map(span => [span.id, span]));
    const invocations = invocationIds.map(id => spans.find(span => span.id === id)!);
    const parents = invocations.map(span => {
      if (!span.parentSpanId) return null;
      expect(span.metadata?.resumedFromSpanId).toBe(span.parentSpanId);
      const parent = allSpans.get(span.parentSpanId);
      expect(parent, 'resume parent must be exported').toBeDefined();
      let ancestor = parent;
      const visited = new Set<string>();
      while (ancestor && ancestor.type !== SpanType.AGENT_RUN) {
        expect(visited.has(ancestor.id), 'parent chain must not cycle').toBe(false);
        visited.add(ancestor.id);
        ancestor = ancestor.parentSpanId ? allSpans.get(ancestor.parentSpanId) : undefined;
      }
      expect(ancestor, 'resume parent must belong to an agent invocation').toBeDefined();
      expect(invocationIds).toContain(ancestor!.id);
      return { parentType: parent!.type, parentInvocation: invocationIds.indexOf(ancestor!.id) };
    });
    return {
      parents,
      resumedFrom: invocations.map(span =>
        span.resumedFromSpanId === undefined ? null : invocationIds.indexOf(span.resumedFromSpanId),
      ),
      external: invocations.map(span => span.externalParentSpanId ?? null),
    };
  } finally {
    for (const host of hosts) await host.shutdown();
  }
}

const siblingsUnderInitial = [
  null,
  { parentType: SpanType.AGENT_RUN, parentInvocation: 0 },
  { parentType: SpanType.AGENT_RUN, parentInvocation: 0 },
];

it('an explicit trace override saves the new agent run as the parent for subsequent resumes', async () => {
  // The override starts a new lineage: its run is the next resume's origin, never a run in another trace.
  expect(await resumeParents('normal', { recreateAgent: true, overrideTrace: true })).toEqual({
    parents: [null, null, { parentType: SpanType.AGENT_RUN, parentInvocation: 1 }],
    resumedFrom: [null, null, 1],
    external: [null, null, null],
  });
});

it('normal and durable resumes are siblings under the initial agent after two suspensions', async () => {
  const expected = { parents: siblingsUnderInitial, resumedFrom: [null, 0, 0], external: [null, null, null] };
  expect(await resumeParents('normal'), 'normal resume parentage').toEqual(expected);
  expect(await resumeParents('durable'), 'durable resume parentage').toEqual(expected);
  expect(
    await resumeParents('normal', { recreateAgent: true }),
    'fresh agents must recover the initial parent from storage',
  ).toEqual(expected);
}, 30_000);

it.each([
  ['normal', false],
  ['durable', false],
  ['normal', true],
] as const)(
  '%s resumes (recreated host: %s) keep the external parent the initial run started under',
  async (engine, recreateAgent) => {
    expect(await resumeParents(engine, { recreateAgent, external: 'start' })).toEqual({
      parents: siblingsUnderInitial,
      resumedFrom: [null, 0, 0],
      external: [EXTERNAL_AT_START, EXTERNAL_AT_START, EXTERNAL_AT_START],
    });
  },
  30_000,
);

it('a resume under its own external parent stays in the saved trace under the initial agent', async () => {
  expect(await resumeParents('normal', { external: 'resume' })).toEqual({
    parents: siblingsUnderInitial,
    resumedFrom: [null, 0, 0],
    external: [null, EXTERNAL_AT_RESUME, EXTERNAL_AT_RESUME],
  });
});

it.each(['normal', 'durable'] as const)(
  '%s keeps nested agent resumes under their own initial invocation',
  async engine => {
    const exporter = new TestExporter();
    let innerExecutions = 0;
    let outerExecutions = 0;
    let innerFinishReason: string | undefined;
    const innerRunId = `nested-inner-${engine}`;
    const outerRunId = `nested-outer-${engine}`;
    const innerAgent = new Agent({
      id: 'inner',
      name: 'Inner agent',
      instructions: 'Request two approvals, then answer.',
      model: twoApprovalsModel(),
      tools: {
        confirm: createTool({
          id: 'confirm',
          description: 'Request approval',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => ({ approval: ++innerExecutions }),
        }),
      },
    });
    const inner = engine === 'durable' ? createDurableAgent({ agent: innerAgent }) : innerAgent;
    const outerAgent = new Agent({
      id: 'outer',
      name: 'Outer agent',
      instructions: 'Request two approvals, then answer.',
      model: twoApprovalsModel(),
      tools: {
        confirm: createTool({
          id: 'confirm',
          description: 'Start a nested agent on the first approval',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async (_input, context) => {
            if (++outerExecutions === 1) {
              const result = await inner.generate('Start nested work.', {
                runId: innerRunId,
                tracingContext: context?.tracingContext,
                maxSteps: 10,
              });
              innerFinishReason = result.finishReason;
            }
            return { approval: outerExecutions };
          },
        }),
      },
    });
    const outer = engine === 'durable' ? createDurableAgent({ agent: outerAgent }) : outerAgent;
    const host = new Mastra({
      agents: { outer, inner },
      storage: new InMemoryStore(),
      logger: false,
      observability: new Observability({
        configs: { test: { serviceName: 'nested-resume', exporters: [exporter] } },
      }),
    });
    const resume = (agent: typeof inner | typeof outer, runId: string, toolCallId: string) => {
      if (agent instanceof DurableAgent) {
        return agent.resumeGenerate(runId, { approved: true }, { toolCallId, maxSteps: 10 });
      }
      return agent.resumeGenerate({ approved: true }, { runId, toolCallId, maxSteps: 10 });
    };
    try {
      expect(
        (
          await outer.generate('Start.', {
            runId: outerRunId,
            maxSteps: 10,
            tracingOptions: { parentSpanId: EXTERNAL_AT_START },
          })
        ).finishReason,
      ).toBe('suspended');
      expect((await resume(outer, outerRunId, 'call-1')).finishReason).toBe('suspended');
      expect(innerFinishReason).toBe('suspended');
      expect(innerExecutions).toBe(0);

      expect((await resume(inner, innerRunId, 'call-1')).finishReason).toBe('suspended');
      const innerResult = await resume(inner, innerRunId, 'call-2');
      expect(innerResult.finishReason).toBe('stop');
      expect(innerResult.text).toBe('Both approvals received.');
      expect(innerExecutions).toBe(2);

      const outerResult = await resume(outer, outerRunId, 'call-2');
      expect(outerResult.finishReason).toBe('stop');
      expect(outerResult.text).toBe('Both approvals received.');
      expect(outerExecutions).toBe(2);

      await expect.poll(() => exporter.getSpansByType(SpanType.AGENT_RUN).length).toBe(6);
      const runs = exporter.getSpansByType(SpanType.AGENT_RUN);
      const outerRuns = runs.filter(span => span.entityId === 'outer');
      const innerRuns = runs.filter(span => span.entityId === 'inner');
      expect(outerRuns).toHaveLength(3);
      expect(innerRuns).toHaveLength(3);
      expect(new Set(runs.map(span => span.traceId)).size).toBe(1);
      expect(runs.filter(span => !span.parentSpanId)).toEqual([outerRuns[0]]);
      for (const family of [outerRuns, innerRuns]) {
        expect(family[0]!.resumedFromSpanId).toBeUndefined();
        for (const resumed of family.slice(1)) {
          expect(resumed.parentSpanId).toBe(family[0]!.id);
          expect(resumed.metadata?.resumedFromSpanId).toBe(family[0]!.id);
          expect(resumed.resumedFromSpanId).toBe(family[0]!.id);
        }
      }
      // The outer run's external parent belongs to the outer family only.
      expect(outerRuns.map(span => span.externalParentSpanId)).toEqual(Array(3).fill(EXTERNAL_AT_START));
      expect(innerRuns.map(span => span.externalParentSpanId ?? null)).toEqual([null, null, null]);
      // The inner initial invocation belongs to the outer tool, not the trace root.
      const allSpans = new Map(exporter.getAllSpans().map(span => [span.id, span]));
      let parent = allSpans.get(innerRuns[0]!.parentSpanId!);
      expect(parent?.type).toBe(SpanType.TOOL_CALL);
      const visited = new Set<string>();
      while (parent && parent.type !== SpanType.AGENT_RUN) {
        expect(visited.has(parent.id)).toBe(false);
        visited.add(parent.id);
        parent = parent.parentSpanId ? allSpans.get(parent.parentSpanId) : undefined;
      }
      // Durable tools can retain a span from before approval/resume. Either
      // invocation is valid here; the important boundary is outer versus inner.
      expect(outerRuns.map(span => span.id)).toContain(parent?.id);
    } finally {
      await host.shutdown();
    }
  },
  30_000,
);

/** Crash a durable run mid-tool, recover it in a fresh process, then resume its approval. */
async function recoverThenResume({ sampleCrashedRun }: { sampleCrashedRun: boolean }) {
  const exporter = new TestExporter();
  const storage = new InMemoryStore();
  const runId = 'recovered-resume';
  const model = twoApprovalsModel(['work', 'confirm']);
  let reachCrash!: () => void;
  const crashReached = new Promise<void>(resolve => (reachCrash = resolve));
  let releaseCrashed!: () => void;
  const crashedProcessReleased = new Promise<void>(resolve => (releaseCrashed = resolve));
  const openProcess = (crashes: boolean) => {
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'recovered-resume',
        name: 'Recovered resume',
        instructions: 'Do the work, request approval, then answer.',
        model,
        tools: {
          work: createTool({
            id: 'work',
            description: 'Do the work',
            inputSchema: z.object({}),
            execute: async () => {
              if (crashes) {
                reachCrash();
                await crashedProcessReleased;
              }
              return { done: true };
            },
          }),
          confirm: createTool({
            id: 'confirm',
            description: 'Request approval',
            inputSchema: z.object({}),
            requireApproval: true,
            execute: async () => ({ approved: true }),
          }),
        },
      }),
    });
    const host = new Mastra({
      agents: { agent },
      storage,
      logger: false,
      recovery: { durableAgents: 'auto' },
      observability: new Observability({
        configs: {
          test: {
            serviceName: 'recovered-resume',
            exporters: [exporter],
            sampling: { type: SamplingStrategyType.CUSTOM, sampler: () => sampleCrashedRun || !crashes },
          },
        },
      }),
    });
    return { agent, host };
  };
  const crashed = openProcess(true);
  let recovering: ReturnType<typeof openProcess> | undefined;
  const cleanups: Array<() => void> = [];
  try {
    const started = await crashed.agent.stream('Start.', {
      runId,
      maxSteps: 10,
      tracingOptions: { parentSpanId: EXTERNAL_AT_START },
    });
    await crashReached;
    // The first process stops responding mid-tool; this one knows nothing of its execution.
    started.cleanup();
    globalRunRegistry.clear();
    __resetExecutionFencesForTests();

    recovering = openProcess(false);
    const recovered = await recovering.agent.recover(runId, { force: true });
    cleanups.push(recovered.cleanup);
    const expectedRuns = sampleCrashedRun ? 3 : 2;
    await vi.waitFor(() => expect(exporter.getSpansByType(SpanType.AGENT_RUN)).toHaveLength(expectedRuns - 1), {
      timeout: 10_000,
    });
    const resumed = await recovering.agent.resumeGenerate(runId, { approved: true }, { toolCallId: 'call-2' });
    expect(resumed.text).toBe('Both approvals received.');

    await expect.poll(() => exporter.getSpansByType(SpanType.AGENT_RUN).length).toBe(expectedRuns);
    const runs = exporter.getSpansByType(SpanType.AGENT_RUN);
    return {
      initial: runs.find(span => span.name.endsWith("'recovered-resume'")),
      recoveredRun: runs.find(span => span.name.endsWith('(recovered)'))!,
      laterResume: runs.find(span => span.name.endsWith('(resumed)'))!,
    };
  } finally {
    for (const cleanup of cleanups) cleanup();
    releaseCrashed();
    await crashed.host.shutdown();
    await recovering?.host.shutdown();
  }
}

it('a recovered durable run and a later resume keep the initial invocation as their origin', async () => {
  const { initial, recoveredRun, laterResume } = await recoverThenResume({ sampleCrashedRun: true });
  expect(initial!.externalParentSpanId).toBe(EXTERNAL_AT_START);
  expect(recoveredRun).toMatchObject({
    parentSpanId: initial!.id,
    resumedFromSpanId: initial!.id,
    externalParentSpanId: EXTERNAL_AT_START,
  });
  expect(laterResume).toMatchObject({
    parentSpanId: recoveredRun.id,
    resumedFromSpanId: initial!.id,
    externalParentSpanId: EXTERNAL_AT_START,
  });
}, 30_000);

it('recovering a run whose start was not sampled starts a new lineage at the recovered run', async () => {
  const { initial, recoveredRun, laterResume } = await recoverThenResume({ sampleCrashedRun: false });
  expect(initial).toBeUndefined();
  expect(recoveredRun.resumedFromSpanId).toBeUndefined();
  expect(laterResume).toMatchObject({ parentSpanId: recoveredRun.id, resumedFromSpanId: recoveredRun.id });
}, 30_000);

it('stores the resume lineage of a resumed run in the trace store', async () => {
  const storage = new InMemoryStore();
  const runId = 'stored-resume';
  const agent = new Agent({
    id: 'stored-resume',
    name: 'Stored resume',
    instructions: 'Request two approvals, then answer.',
    model: twoApprovalsModel(),
    tools: {
      confirm: createTool({
        id: 'confirm',
        description: 'Request approval',
        inputSchema: z.object({}),
        requireApproval: true,
        execute: async () => ({ approved: true }),
      }),
    },
  });
  const observability = new Observability({
    configs: {
      test: { serviceName: 'stored-resume', exporters: [new MastraStorageExporter({ strategy: 'realtime' })] },
    },
  });
  const host = new Mastra({ agents: { agent }, storage, logger: false, observability });
  try {
    const first = await agent.generate('Start.', {
      runId,
      maxSteps: 10,
      tracingOptions: { parentSpanId: EXTERNAL_AT_START },
    });
    expect(first.finishReason).toBe('suspended');
    const second = await agent.resumeGenerate({ approved: true }, { runId, toolCallId: 'call-1', maxSteps: 10 });
    expect(second.finishReason).toBe('suspended');
    await observability.getDefaultInstance()!.flush();

    const trace = await (await storage.getStore('observability'))!.getTrace({ traceId: first.traceId! });
    const [initial, resumed] = trace!.spans.filter(span => span.spanType === SpanType.AGENT_RUN);
    expect(initial).toMatchObject({
      parentSpanId: null,
      resumedFromSpanId: null,
      externalParentSpanId: EXTERNAL_AT_START,
    });
    expect(resumed).toMatchObject({
      parentSpanId: initial!.spanId,
      resumedFromSpanId: initial!.spanId,
      externalParentSpanId: EXTERNAL_AT_START,
    });
  } finally {
    await host.shutdown();
  }
});

it('names only the agent run, not its internal loop workflow, as a resume of the initial invocation', async () => {
  const exporter = new TestExporter();
  const runId = 'internal-loop-lineage';
  const agent = new Agent({
    id: 'internal-loop-lineage',
    name: 'Internal loop lineage',
    instructions: 'Request two approvals, then answer.',
    model: twoApprovalsModel(),
    tools: {
      confirm: createTool({
        id: 'confirm',
        description: 'Request approval',
        inputSchema: z.object({}),
        requireApproval: true,
        execute: async () => ({ approved: true }),
      }),
    },
  });
  const host = new Mastra({
    agents: { agent },
    storage: new InMemoryStore(),
    logger: false,
    observability: new Observability({
      configs: { test: { serviceName: 'internal-loop', exporters: [exporter], includeInternalSpans: true } },
    }),
  });
  try {
    expect((await agent.generate('Start.', { runId, maxSteps: 10 })).finishReason).toBe('suspended');
    const resumed = await agent.resumeGenerate({ approved: true }, { runId, toolCallId: 'call-1', maxSteps: 10 });
    expect(resumed.finishReason).toBe('suspended');

    const [initial, resumedRun] = exporter.getSpansByType(SpanType.AGENT_RUN);
    expect(resumedRun!.resumedFromSpanId).toBe(initial!.id);
    const workflows = exporter.getSpansByType(SpanType.WORKFLOW_RUN);
    expect(workflows.map(span => span.name)).toContain("workflow run: 'agentic-loop' (resumed)");
    expect(workflows.filter(span => span.resumedFromSpanId === initial!.id)).toEqual([]);
  } finally {
    await host.shutdown();
  }
});

it.each([
  [true, [null, null]],
  [false, [EXTERNAL_AT_START, EXTERNAL_AT_START]],
] as const)(
  'a resume keeps the external parent its agent run exported (includeInternalSpans: %s)',
  async (includeInternalSpans, expected) => {
    const exporter = new TestExporter();
    const runId = 'under-internal-workflow';
    const agent = new Agent({
      id: 'under-internal-workflow',
      name: 'Under internal workflow',
      instructions: 'Request two approvals, then answer.',
      model: twoApprovalsModel(),
      tools: {
        confirm: createTool({
          id: 'confirm',
          description: 'Request approval',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => ({ approved: true }),
        }),
      },
    });
    const step = createStep({
      id: 'run-agent',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async ({ tracingContext }) => {
        expect((await agent.generate('Start.', { runId, maxSteps: 10, tracingContext })).finishReason).toBe(
          'suspended',
        );
        return {};
      },
    });
    const workflow = createWorkflow({
      id: 'internal-outer',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { tracingPolicy: { internal: InternalSpans.WORKFLOW } },
    })
      .then(step)
      .commit();
    const host = new Mastra({
      agents: { agent },
      workflows: { workflow },
      storage: new InMemoryStore(),
      logger: false,
      observability: new Observability({
        configs: { test: { serviceName: 'under-internal', exporters: [exporter], includeInternalSpans } },
      }),
    });
    try {
      const run = await workflow.createRun();
      const outer = await run.start({ inputData: {}, tracingOptions: { parentSpanId: EXTERNAL_AT_START } });
      expect(outer.status).toBe('success');
      const resumed = await agent.resumeGenerate({ approved: true }, { runId, toolCallId: 'call-1', maxSteps: 10 });
      expect(resumed.finishReason).toBe('suspended');

      const runs = exporter.getSpansByType(SpanType.AGENT_RUN);
      expect(runs[1]!.resumedFromSpanId).toBe(runs[0]!.id);
      // With the internal workflow hidden, the agent run is exported under its external parent; shown, it is not.
      expect(runs.map(span => span.externalParentSpanId ?? null)).toEqual(expected);
    } finally {
      await host.shutdown();
    }
  },
);
