import { ChunkFrom } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { AgentStreamToAISDKTransformer, transformAgent } from '../transformers';

/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/14932
 *
 * transformAgent() emits `data-tool-agent` with the full cumulative buffered
 * state on every change. Three compounding problems caused explosive growth:
 *
 * 1. `step-finish` spread the full `stepRun` (including `steps[]`) into each
 *    stepResult, creating recursive nesting.
 *
 * 2. toolCalls, toolResults, sources, and files accumulated across steps
 *    without being reset, so step N contained ALL data from steps 0..N.
 *
 * 3. text and reasoning were copied cumulatively into each step result,
 *    making steps[i].text contain text from steps 0..i (O(N²) storage).
 */
describe('transformAgent cumulative growth (issue #14932)', () => {
  function makePayload(type: string, runId: string, payload: any) {
    return { type, runId, payload } as any;
  }

  function simulateMultiStepAgentRun(numSteps: number) {
    const bufferedSteps = new Map<string, any>();
    const runId = 'test-run';

    transformAgent(makePayload('start', runId, { id: 'agent-1' }), bufferedSteps);

    const emissions: any[] = [];

    function collect(result: any) {
      if (Array.isArray(result)) {
        emissions.push(...result);
      } else if (result) {
        emissions.push(result);
      }
    }

    for (let step = 0; step < numSteps; step++) {
      collect(
        transformAgent(
          makePayload('text-delta', runId, { text: `Step ${step} response text. `.repeat(10) }),
          bufferedSteps,
        ),
      );

      collect(
        transformAgent(makePayload('reasoning-delta', runId, { text: `Reasoning for step ${step}. ` }), bufferedSteps),
      );

      collect(
        transformAgent(
          makePayload('source', runId, { id: `src-${step}`, url: `https://example.com/${step}` }),
          bufferedSteps,
        ),
      );

      collect(
        transformAgent(
          makePayload('file', runId, { name: `file-${step}.txt`, content: `content-${step}` }),
          bufferedSteps,
        ),
      );

      collect(
        transformAgent(
          makePayload('tool-call', runId, {
            type: 'tool-call',
            toolCallId: `call-${step}`,
            toolName: `tool_${step}`,
            args: { input: `data for step ${step}`.repeat(20) },
            payload: { dynamic: false },
          }),
          bufferedSteps,
        ),
      );

      collect(
        transformAgent(
          makePayload('tool-result', runId, {
            type: 'tool-result',
            toolCallId: `call-${step}`,
            toolName: `tool_${step}`,
            result: { output: `Result from step ${step}. `.repeat(50) },
            payload: { dynamic: false },
          }),
          bufferedSteps,
        ),
      );

      collect(
        transformAgent(
          makePayload('step-finish', runId, {
            id: `step-${step}`,
            stepResult: { reason: 'tool-calls', warnings: [] },
            output: { usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 } },
            metadata: { timestamp: new Date(), modelId: 'test-model' },
          }),
          bufferedSteps,
        ),
      );
    }

    return { emissions, bufferedSteps, runId };
  }

  it('stepResults should not contain nested copies of prior steps', () => {
    const { bufferedSteps, runId } = simulateMultiStepAgentRun(5);
    const finalState = bufferedSteps.get(runId);

    expect(finalState.steps).toHaveLength(5);

    for (let i = 0; i < finalState.steps.length; i++) {
      const nestedSteps = finalState.steps[i].steps;
      expect(
        nestedSteps === undefined || nestedSteps.length === 0,
        `stepResult[${i}] contains ${nestedSteps?.length ?? 0} nested steps — recursive nesting bug`,
      ).toBe(true);
    }
  });

  it('per-step fields (toolCalls, toolResults, sources, files) should not accumulate across steps', () => {
    const { bufferedSteps, runId } = simulateMultiStepAgentRun(5);
    const finalState = bufferedSteps.get(runId);

    for (let i = 0; i < finalState.steps.length; i++) {
      const s = finalState.steps[i];

      // Each step emitted exactly 1 of each — more means cumulative leakage
      expect(s.toolCalls, `stepResult[${i}].toolCalls`).toHaveLength(1);
      expect(s.toolResults, `stepResult[${i}].toolResults`).toHaveLength(1);
      expect(s.sources, `stepResult[${i}].sources`).toHaveLength(1);
      expect(s.files, `stepResult[${i}].files`).toHaveLength(1);

      // Verify correct step ownership
      expect(s.sources[0].id).toBe(`src-${i}`);
      expect(s.files[0].name).toBe(`file-${i}.txt`);
    }
  });

  it('per-step text and reasoning should be isolated; top-level should stay cumulative', () => {
    const { bufferedSteps, runId } = simulateMultiStepAgentRun(5);
    const finalState = bufferedSteps.get(runId);

    // Top-level text and reasoning must be cumulative (consumers read data.text)
    for (let i = 0; i < 5; i++) {
      expect(finalState.text).toContain(`Step ${i} response text.`);
      expect(finalState.reasoning[i]).toBe(`Reasoning for step ${i}. `);
    }

    // Each stepResult should contain only its own text and reasoning
    for (let i = 0; i < finalState.steps.length; i++) {
      const s = finalState.steps[i];

      expect(s.text).toContain(`Step ${i} response text.`);
      for (let j = 0; j < finalState.steps.length; j++) {
        if (j !== i) {
          expect(s.text, `stepResult[${i}].text leaks Step ${j} text`).not.toContain(`Step ${j} response text.`);
        }
      }

      expect(s.reasoning, `stepResult[${i}].reasoning`).toHaveLength(1);
      expect(s.reasoning[0]).toBe(`Reasoning for step ${i}. `);
      expect(s.reasoningText).toBe(`Reasoning for step ${i}. `);
    }
  });

  it('structured object should be preserved after step-finish', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'test-run';

    transformAgent(makePayload('start', runId, { id: 'agent-1' }), bufferedSteps);
    transformAgent({ type: 'object-result', runId, object: { key: 'value', nested: { a: 1 } } } as any, bufferedSteps);
    transformAgent(
      makePayload('step-finish', runId, {
        id: 'step-0',
        stepResult: { reason: 'tool-calls', warnings: [] },
        output: { usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
        metadata: { timestamp: new Date(), modelId: 'test-model' },
      }),
      bufferedSteps,
    );

    expect(bufferedSteps.get(runId).object).toEqual({ key: 'value', nested: { a: 1 } });
  });

  it('emits full completed steps as data-tool-agent-step deltas', () => {
    const { emissions } = simulateMultiStepAgentRun(3);
    const stepChunks = emissions.filter(emission => emission.type === 'data-tool-agent-step');

    expect(stepChunks).toHaveLength(3);
    expect(stepChunks[0]).toMatchObject({
      id: 'test-run:step-0',
      data: {
        runId: 'test-run',
        stepIndex: 0,
        step: {
          text: expect.stringContaining('Step 0 response text.'),
          toolResults: [
            expect.objectContaining({
              result: { output: `Result from step 0. `.repeat(50) },
            }),
          ],
        },
      },
    });
  });

  it('emits data-tool-agent-step deltas through the nested tool-output transformer route', async () => {
    const stream = new ReadableStream<any>({
      start(controller) {
        controller.enqueue({
          type: 'tool-output',
          runId: 'supervisor-run',
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'agent-subAgent',
            output: {
              type: 'start',
              runId: 'sub-agent-run',
              from: ChunkFrom.AGENT,
              payload: { id: 'agent-1' },
            },
          },
        });
        controller.enqueue({
          type: 'tool-output',
          runId: 'supervisor-run',
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'agent-subAgent',
            output: {
              type: 'tool-result',
              runId: 'sub-agent-run',
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: 'call-1',
                toolName: 'search',
                result: { output: 'large result '.repeat(20) },
              },
            },
          },
        });
        controller.enqueue({
          type: 'tool-output',
          runId: 'supervisor-run',
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'agent-subAgent',
            output: {
              type: 'step-finish',
              runId: 'sub-agent-run',
              from: ChunkFrom.AGENT,
              payload: {
                id: 'step-0',
                stepResult: { reason: 'tool-calls', warnings: [] },
                output: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
                metadata: { timestamp: new Date(), modelId: 'test-model' },
              },
            },
          },
        });
        controller.close();
      },
    });

    const chunks: any[] = [];
    for await (const chunk of stream.pipeThrough(
      AgentStreamToAISDKTransformer({ sendStart: false, sendFinish: false }),
    )) {
      chunks.push(chunk);
    }

    expect(chunks.some(chunk => chunk.type === 'data-tool-agent-step')).toBe(true);
  });

  it('keeps intermediate data-tool-agent snapshots from repeating completed step payloads', () => {
    const { emissions } = simulateMultiStepAgentRun(3);
    const snapshots = emissions.filter(emission => emission.type === 'data-tool-agent');

    for (const snapshot of snapshots) {
      for (const step of snapshot.data.steps) {
        expect(step.text).toBe('');
        expect(step.reasoning).toEqual([]);
        expect(step.toolCalls).toEqual([]);
        expect(step.toolResults).toEqual([]);
        expect(step.sources).toEqual([]);
        expect(step.files).toEqual([]);
        expect(step.response.messages).toEqual([]);
      }
    }
  });

  it('payload size should grow linearly, not super-quadratically', () => {
    const { emissions } = simulateMultiStepAgentRun(10);
    const sizes = emissions.map((e: any) => JSON.stringify(e).length);

    // Linear: lastSize ≈ firstSize * N. The original bug produced 50-100x+ ratios.
    const ratio = sizes[sizes.length - 1]! / (sizes[0]! * sizes.length);

    expect(ratio, `Payload growth ratio ${ratio.toFixed(1)}x exceeds linear expectation`).toBeLessThan(3);
  });

  it('emitted payloads should not contain internal tracking fields', () => {
    const { emissions } = simulateMultiStepAgentRun(3);

    for (const emission of emissions) {
      expect(emission.data).not.toHaveProperty('_textOffset');
      expect(emission.data).not.toHaveProperty('_reasoningOffset');
    }
  });
});
