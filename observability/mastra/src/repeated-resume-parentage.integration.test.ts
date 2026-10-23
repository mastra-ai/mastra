import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, DurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { Observability } from './default';
import { TestExporter } from './exporters';

/** Two distinct approval requests, then an answer on the third invocation. */
function twoApprovalsModel() {
  let calls = 0;
  const next = () => {
    const call = ++calls;
    const content =
      call <= 2
        ? [{ type: 'tool-call' as const, toolCallId: `call-${call}`, toolName: 'confirm', input: '{}' }]
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

async function resumeParents(engine: 'normal' | 'durable', recreateAgent = false, overrideTrace = false) {
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
      expect(snapshot?.tracingContext).toEqual({
        traceId: added[0]!.traceId,
        spanId: invocationIds[overrideTrace && count === 2 ? 1 : 0],
      });
    }
  }
  try {
    const first = await (durable ?? agent).generate('Start.', { runId, maxSteps: 10 });
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
    return invocationIds.map(id => {
      const span = spans.find(span => span.id === id)!;
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
  } finally {
    for (const host of hosts) await host.shutdown();
  }
}

it('an explicit trace override saves the new agent run as the parent for subsequent resumes', async () => {
  expect(await resumeParents('normal', true, true)).toEqual([
    null,
    null,
    { parentType: SpanType.AGENT_RUN, parentInvocation: 1 },
  ]);
});

it('normal and durable resumes are siblings under the initial agent after two suspensions', async () => {
  const normal = await resumeParents('normal');
  const durable = await resumeParents('durable');
  const expected = [
    null,
    { parentType: SpanType.AGENT_RUN, parentInvocation: 0 },
    { parentType: SpanType.AGENT_RUN, parentInvocation: 0 },
  ];
  expect(normal, 'normal resume parentage').toEqual(expected);
  expect(durable, 'durable resume parentage').toEqual(expected);
  expect(await resumeParents('normal', true), 'fresh agents must recover the initial parent from storage').toEqual(
    expected,
  );
}, 30_000);

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
      expect((await outer.generate('Start.', { runId: outerRunId, maxSteps: 10 })).finishReason).toBe('suspended');
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
        for (const resumed of family.slice(1)) {
          expect(resumed.parentSpanId).toBe(family[0]!.id);
          expect(resumed.metadata?.resumedFromSpanId).toBe(family[0]!.id);
        }
      }
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
