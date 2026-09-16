import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../agent';
import { createTool } from '../../../tools';

type EventName = 'complete-a' | 'later-output' | 'finish' | 'input-available-a' | 'execute-a' | 'result-a';

function createScenario() {
  const events: EventName[] = [];
  const record = (event: EventName) => events.push(event);

  const model = new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'response-1',
            modelId: 'mock-model',
            timestamp: new Date(0),
          });
          record('complete-a');
          controller.enqueue({
            type: 'tool-call',
            toolCallId: 'call-a',
            toolName: 'tool-a',
            input: JSON.stringify({ value: 'a' }),
          });

          await new Promise(resolve => setTimeout(resolve, 100));

          record('later-output');
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'later' });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          record('finish');
          controller.enqueue({
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      }),
    }),
  });

  const tool = createTool({
    id: 'tool-a',
    description: 'Records when execution begins',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    onInputAvailable: async () => {
      record('input-available-a');
    },
    execute: async ({ value }) => {
      record('execute-a');
      record('result-a');
      return { value };
    },
  });

  const agent = new Agent({
    id: 'eager-tool-dispatch-test',
    name: 'Eager tool dispatch test',
    instructions: 'Call tool-a once.',
    model,
    tools: { 'tool-a': tool },
  });

  return { agent, events };
}

async function runScenario(eagerToolExecution?: boolean) {
  const { agent, events } = createScenario();
  const stream = await agent.stream('go', {
    maxSteps: 1,
    ...(eagerToolExecution === undefined ? {} : ({ eagerToolExecution } as Record<string, unknown>)),
  });

  for await (const _ of stream.fullStream) {
    // Drain the stream so the complete iteration executes.
  }

  return events;
}

describe('eager tool dispatch', () => {
  it('preserves delayed tool execution when the option is omitted', async () => {
    const events = await runScenario();

    expect(events).toEqual(['complete-a', 'later-output', 'finish', 'input-available-a', 'execute-a', 'result-a']);
  });

  it('starts a completed tool call before later model output when enabled', async () => {
    const events = await runScenario(true);

    expect(events).toEqual(['complete-a', 'input-available-a', 'execute-a', 'result-a', 'later-output', 'finish']);
  });
});
