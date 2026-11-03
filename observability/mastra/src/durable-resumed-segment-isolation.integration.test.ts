/**
 * A resumed durable segment is isolated from the run's first segment and from user code: the span
 * pair it carries to the workers stays out of the request context a tool sees, and the clocks an
 * older snapshot persisted for the first segment are never reported on the resumed pair.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent, DurableStepIds, globalRunRegistry } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Observability } from './default';
import { TestExporter } from './exporters';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function observability(exporter: TestExporter) {
  return new Observability({ configs: { test: { serviceName: 'resumed-segment', exporters: [exporter] } } });
}

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
