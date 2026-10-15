import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
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

async function resumeParents(engine: 'normal' | 'durable', recreateAgent = false) {
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
        : agent.resumeGenerate({ approved: true }, { runId, toolCallId, maxSteps: 10 });
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
    expect(new Set(spans.map(span => span.traceId)).size).toBe(1);
    expect(spans.filter(span => !span.parentSpanId)).toHaveLength(1);
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
