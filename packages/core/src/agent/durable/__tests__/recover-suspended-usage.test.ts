/**
 * Token usage of a recovered run that had suspended.
 *
 * Each suspension records the model calls made so far on its MODEL_GENERATION span, which is where
 * token and cost metrics come from. A run that suspends on two steps, and whose process stops inside
 * an approved tool, is then recovered: the recovered part must record only the model calls it makes
 * itself.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { captureOutcomeEvents } from '../../../loop/test-utils/aimock/outcome-test-utils';
import { SpanType } from '../../../observability';
import { createGate, createRestartScenario } from './restart-harness';

// One model call per entry: two that each call the approval tool, then the final answer.
const INPUT_TOKENS = [100, 10, 1];

function model() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const call = prompt.filter(message => message.role === 'tool').length;
      const usage = { inputTokens: INPUT_TOKENS[call], outputTokens: 1, totalTokens: INPUT_TOKENS[call]! + 1 };
      const answer =
        call < 2
          ? [{ type: 'tool-call', toolCallId: `call-${call}`, toolName: 'approve', input: '{}' }]
          : [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `r-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          ...answer,
          { type: 'finish', finishReason: call < 2 ? 'tool-calls' : 'stop', usage },
        ] as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

async function untilApprovalNeeded(stream: AsyncIterable<any>) {
  for await (const chunk of stream) {
    if (chunk.type === 'tool-call-approval') return;
  }
}

describe('token usage of a recovered run that had suspended', () => {
  let stop: (() => Promise<void>) | undefined;
  afterEach(() => stop?.());

  const cases = [
    { kind: 'durable', crashIn: 'call-1', recovery: 'auto' },
    { kind: 'evented', crashIn: 'call-1', recovery: 'auto' },
    // Without checkpoints the saved run is still the suspended one, and the recovered run asks again.
    { kind: 'durable', crashIn: 'call-0', recovery: 'off' },
    { kind: 'durable', crashIn: 'call-1', recovery: 'off' },
  ] as const;
  for (const { kind, crashIn, recovery } of cases) {
    it(`[${kind}] records each model call once after a crash in ${crashIn}, recovery ${recovery}`, async () => {
      const runId = `recover-suspended-usage-${kind}-${crashIn}-${recovery}`;
      const gate = createGate();
      const captures: Array<ReturnType<typeof captureOutcomeEvents>> = [];
      const scenario = createRestartScenario({
        kind,
        runId,
        recovery,
        observability: () => {
          captures.push(captureOutcomeEvents());
          return captures.at(-1)!.observability;
        },
        onRecoveredChunk: (chunk, { agent }) => {
          if (chunk.type === 'tool-call-approval')
            void agent.approveToolCall({ runId, toolCallId: chunk.payload.toolCallId });
        },
        build: ({ core, generation }) =>
          new core.Agent({
            id: 'approving-agent',
            name: 'approving-agent',
            instructions: 'Use your tools.',
            model: model(),
            tools: {
              approve: core.createTool({
                id: 'approve',
                description: 'Needs approval',
                inputSchema: z.object({}),
                requireApproval: true,
                execute: async (_input: unknown, context: any) => {
                  // The first process stops inside this approved tool.
                  if (generation === 1 && context?.agent?.toolCallId === crashIn) await gate.wait();
                  return { ok: true };
                },
              }),
            },
          }),
      });
      stop = async () => {
        gate.release();
        await scenario.stop();
      };

      const original = await scenario.start(async ({ agent }) => {
        await untilApprovalNeeded((await agent.stream('go', { runId })).fullStream);
        if (crashIn === 'call-1')
          await untilApprovalNeeded((await agent.approveToolCall({ runId, toolCallId: 'call-0' })).fullStream);
        void agent.approveToolCall({ runId, toolCallId: crashIn });
      });
      await gate.reached;
      const recovered = await scenario.restart(await original.checkpoint());
      expect(recovered.text).toBe('done');

      const recordedInputTokens = () =>
        captures
          .flatMap(capture => capture.ended(SpanType.MODEL_GENERATION))
          .map(span => span.attributes?.usage?.inputTokens ?? 0)
          .filter(tokens => tokens > 0);
      await expect.poll(recordedInputTokens).toEqual(INPUT_TOKENS);
    }, 30_000);
  }
});
