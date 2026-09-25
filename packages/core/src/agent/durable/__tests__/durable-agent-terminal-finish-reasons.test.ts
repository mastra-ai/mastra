/**
 * DurableAgent terminal finish reason tests (#17893 / #15717 parity port).
 *
 * A pending tool call must never override a terminal finish reason. Before the
 * fix, durable's continuation check was `toolCalls.length > 0 && finishReason
 * !== 'stop'`, so a content-filter refusal (or max_tokens truncation) that
 * arrived alongside a tool call kept the loop running: the tool executed, the
 * request was re-sent, the model re-triggered the same refusal, and the run
 * spun until maxSteps.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

describe('DurableAgent terminal finish reasons', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it.each(['content-filter', 'length'] as const)(
    'does not continue the loop when finishReason "%s" arrives alongside a tool call',
    async finishReason => {
      let doStreamCalls = 0;
      const model = new MockLanguageModelV2({
        doStream: async () => {
          doStreamCalls++;
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: `id-${doStreamCalls}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'partial output before the terminal finish' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'echo',
                input: JSON.stringify({ msg: 'hi' }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason,
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      });

      const echoTool = createTool({
        id: 'echo',
        description: 'Echoes input',
        inputSchema: z.object({ msg: z.string() }),
        execute: async () => 'echo:hi',
      });

      const baseAgent = new Agent({
        id: `terminal-${finishReason}-agent`,
        name: 'Terminal Finish Reason Agent',
        instructions: 'noop',
        model: model as LanguageModelV2,
        tools: { echo: echoTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { output, cleanup } = await durableAgent.stream('go', { maxSteps: 4 });
      const chunks = await drain(output.fullStream as unknown as ReadableStream<any>);
      await cleanup();

      // The request must not be re-issued — the terminal reason reproduces the
      // same refusal/truncation on every retry, so one attempt only.
      expect(doStreamCalls).toBe(1);

      // The step-finish chunk carries the model's raw finish reason.
      const stepFinishChunk = chunks.findLast((c: any) => c.type === 'step-finish');
      expect(stepFinishChunk?.payload?.stepResult?.reason).toBe(finishReason);

      // The terminal finish event carries llm-mapping's continuation decision.
      const finishChunk = chunks.findLast((c: any) => c.type === 'finish');
      expect(finishChunk?.payload?.stepResult).toMatchObject({ reason: finishReason, isContinued: false });
    },
  );
});
