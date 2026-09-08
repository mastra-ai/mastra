/**
 * Per-step reasoning scoping tests
 *
 * Tests for GitHub issue #21594:
 * In a multi-step run with a reasoning model, each step result reported the
 * cumulative reasoning of all prior steps instead of just its own, because the
 * step result read the run-lifetime reasoning buffers.
 *
 * @see https://github.com/mastra-ai/mastra/issues/21594
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { MockLanguageModelV2, convertArrayToReadableStream } from './mock-model';

function createTwoStepReasoningModel() {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call++;
      const chunks =
        call === 1
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'reasoning-start', id: 'r1' },
              { type: 'reasoning-delta', id: 'r1', delta: 'A' },
              { type: 'reasoning-end', id: 'r1' },
              { type: 'tool-call', toolCallId: 't1', toolName: 'ping', input: '{}' },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'reasoning-start', id: 'r2' },
              { type: 'reasoning-delta', id: 'r2', delta: 'B' },
              { type: 'reasoning-end', id: 'r2' },
              { type: 'text-start', id: 'x' },
              { type: 'text-delta', id: 'x', delta: 'done' },
              { type: 'text-end', id: 'x' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(chunks as any),
      };
    },
  });
}

function createAgent(model: MockLanguageModelV2) {
  return new Agent({
    name: 'per-step-reasoning',
    instructions: 'test agent',
    model,
    tools: {
      ping: createTool({
        id: 'ping',
        description: 'ping',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
      }),
    },
  });
}

describe('per-step reasoning (issue #21594)', () => {
  it('scopes reasoningText and reasoning to the step that produced them', async () => {
    const agent = createAgent(createTwoStepReasoningModel());

    const stepFinishReasoning: { reasoningText: string; reasoning: string[] }[] = [];
    const result = await agent.stream('hi', {
      maxSteps: 3,
      onStepFinish: step => {
        stepFinishReasoning.push({
          reasoningText: step.reasoningText ?? '',
          reasoning: (step.reasoning ?? []).map((part: any) => part.payload.text),
        });
      },
    });
    await result.consumeStream();

    const steps = await result.steps;
    expect(steps).toHaveLength(2);

    expect(steps[0]!.reasoningText).toBe('A');
    expect(steps[0]!.reasoning.map((part: any) => part.payload.text)).toEqual(['A']);

    expect(steps[1]!.reasoningText).toBe('B');
    expect(steps[1]!.reasoning.map((part: any) => part.payload.text)).toEqual(['B']);

    // onStepFinish must observe the same per-step values
    expect(stepFinishReasoning).toEqual([
      { reasoningText: 'A', reasoning: ['A'] },
      { reasoningText: 'B', reasoning: ['B'] },
    ]);

    // Run-level reasoning stays cumulative across every step
    expect(await result.reasoningText).toBe('AB');
    const runReasoning = await result.reasoning;
    expect(runReasoning.map((part: any) => part.payload.text)).toEqual(['A', 'B']);
  });
});
