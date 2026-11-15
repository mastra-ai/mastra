import { setTimeout as sleep } from 'node:timers/promises';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { createTool } from '@mastra/core/tools';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Observability } from './default';
import { TestExporter } from './exporters';

type Reply = 'tool-call' | 'text' | 'error';

function createModel(replies: Reply[]) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      const reply = replies[call++];
      if (reply === 'error') throw new Error('provider unavailable');
      const usage = { inputTokens: call * 10, outputTokens: 1, totalTokens: call * 10 + 1 };
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(
          reply === 'tool-call'
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: `call-${call}`, toolName: 'lookup', input: '{}' },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'done' },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage },
              ],
        ),
      };
    },
  });
}

describe('model spans when onStepFinish is slow', () => {
  let exporter: TestExporter;
  let observability: Observability;

  beforeEach(() => {
    exporter = new TestExporter();
  });

  afterEach(async () => {
    await observability?.shutdown();
  });

  async function run(replies: Reply[]) {
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up',
      inputSchema: z.object({}),
      execute: async () => 'found',
    });
    observability = new Observability({
      configs: { default: { serviceName: 'slow-step-callback', exporters: [exporter] } },
    });
    const agent = new Agent({
      id: 'slow-callback-agent',
      name: 'Slow Callback Agent',
      instructions: 'Test',
      model: createModel(replies),
      tools: { lookup },
    });
    const mastra = new Mastra({ logger: false, agents: { agent }, observability });

    const output = await mastra.getAgent('agent').stream('question', {
      maxSteps: 5,
      errorProcessors: [],
      onStepFinish: () => sleep(50),
    });
    for await (const _ of output.fullStream) {
    }

    const steps = exporter.getSpansByType(SpanType.MODEL_STEP);
    const inferences = exporter.getSpansByType(SpanType.MODEL_INFERENCE);
    return steps.map(step => ({
      step,
      inferences: inferences.filter(inference => inference.parentSpanId === step.id),
    }));
  }

  it('records one step and one inference with its own tokens for each model call', async () => {
    const steps = await run(['tool-call', 'tool-call', 'text']);

    expect(
      steps.map(({ inferences }) => inferences.map(inference => inference.attributes?.usage?.inputTokens)),
    ).toEqual([[10], [20], [30]]);
  });

  it('records a failed model call once', async () => {
    const steps = await run(['tool-call', 'error']);

    expect(steps.map(({ step, inferences }) => [Boolean(step.errorInfo), inferences.length])).toEqual([
      [false, 1],
      [true, 1],
    ]);
  });
});
