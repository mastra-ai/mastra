import { describe, expect, it } from 'vitest';

import { transformAgent } from '../transformers';

/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/14932
 *
 * transformAgent() emits `data-tool-agent` with the full cumulative buffered
 * state on every change. Two compounding problems cause explosive growth:
 *
 * 1. `step-finish` creates stepResult via `{ ...stepRun }`, which copies
 *    stepRun.steps (all previous step results). Each stepResult therefore
 *    contains a nested copy of all prior stepResults — recursively.
 *
 * 2. toolCalls, toolResults, and text are never reset between steps, so
 *    step N's snapshot contains ALL tool data from steps 0..N.
 *
 * Together these cause data-tool-agent payloads to grow super-quadratically,
 * driving Node into OOM on any multi-step nested agent run.
 */
describe('transformAgent cumulative growth (issue #14932)', () => {
  function makePayload(type: string, runId: string, payload: any) {
    return { type, runId, payload } as any;
  }

  function simulateMultiStepAgentRun(numSteps: number) {
    const bufferedSteps = new Map<string, any>();
    const runId = 'test-run';

    // Start the agent run
    transformAgent(makePayload('start', runId, { id: 'agent-1' }), bufferedSteps);

    const emissions: any[] = [];

    function collect(result: any) {
      if (result) emissions.push(result);
    }

    for (let step = 0; step < numSteps; step++) {
      // Each step: text delta + reasoning + source + file + tool call + tool result
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

      // Emit step-finish
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

  it('step-finish stepResult should NOT contain nested copies of prior steps', () => {
    const { bufferedSteps, runId } = simulateMultiStepAgentRun(5);
    const finalState = bufferedSteps.get(runId);

    // After 5 steps, finalState.steps should have 5 entries
    expect(finalState.steps).toHaveLength(5);

    // Each stepResult should NOT contain a nested `steps` array with copies
    // of all prior steps. If it does, we have the recursive nesting bug.
    for (let i = 0; i < finalState.steps.length; i++) {
      const stepResult = finalState.steps[i];
      // stepResult should not carry a `steps` property (or it should be empty/undefined)
      // because stepResults represent a single step, not the full run history.
      const nestedSteps = stepResult.steps;
      expect(
        nestedSteps === undefined || nestedSteps.length === 0,
        `stepResult[${i}] contains ${nestedSteps?.length ?? 0} nested steps — ` +
          `this is the recursive nesting bug from issue #14932. ` +
          `stepResult should not embed prior step history.`,
      ).toBe(true);
    }
  });

  it('stepResult toolCalls/toolResults should only contain data from that step, not cumulative', () => {
    const { bufferedSteps, runId } = simulateMultiStepAgentRun(5);
    const finalState = bufferedSteps.get(runId);

    for (let i = 0; i < finalState.steps.length; i++) {
      const stepResult = finalState.steps[i];

      // Each step added exactly 1 tool call and 1 tool result.
      // If the step contains more, cumulative state is leaking across steps.
      expect(
        stepResult.toolCalls.length,
        `stepResult[${i}] has ${stepResult.toolCalls.length} toolCalls but should have 1. ` +
          `Cumulative toolCalls are leaking across steps (issue #14932).`,
      ).toBe(1);

      expect(
        stepResult.toolResults.length,
        `stepResult[${i}] has ${stepResult.toolResults.length} toolResults but should have 1. ` +
          `Cumulative toolResults are leaking across steps (issue #14932).`,
      ).toBe(1);
    }
  });

  it('top-level text remains cumulative across steps for consumer compatibility', () => {
    const { bufferedSteps, runId } = simulateMultiStepAgentRun(3);
    const finalState = bufferedSteps.get(runId);

    // text is intentionally kept cumulative at the top level because
    // documented consumers read `data.text` (e.g. ai-sdk-ui guide).
    // It should contain text from all 3 steps.
    for (let i = 0; i < 3; i++) {
      expect(finalState.text).toContain(`Step ${i} response text.`);
    }
  });

  it('stepResult sources and files should only contain data from that step, not cumulative', () => {
    const { bufferedSteps, runId } = simulateMultiStepAgentRun(5);
    const finalState = bufferedSteps.get(runId);

    for (let i = 0; i < finalState.steps.length; i++) {
      const stepResult = finalState.steps[i];

      // Each step added exactly 1 source and 1 file.
      expect(
        stepResult.sources.length,
        `stepResult[${i}] has ${stepResult.sources.length} sources but should have 1.`,
      ).toBe(1);
      expect(stepResult.sources[0].id).toBe(`src-${i}`);

      expect(stepResult.files.length, `stepResult[${i}] has ${stepResult.files.length} files but should have 1.`).toBe(
        1,
      );
      expect(stepResult.files[0].name).toBe(`file-${i}.txt`);
    }
  });

  it('stepResult reasoning should be per-step while top-level reasoning stays cumulative', () => {
    const { bufferedSteps, runId } = simulateMultiStepAgentRun(5);
    const finalState = bufferedSteps.get(runId);

    // Top-level reasoning should contain entries from all steps
    expect(finalState.reasoning).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(finalState.reasoning[i]).toBe(`Reasoning for step ${i}. `);
    }

    // Each stepResult should contain only its own reasoning
    for (let i = 0; i < finalState.steps.length; i++) {
      const stepResult = finalState.steps[i];
      expect(
        stepResult.reasoning,
        `stepResult[${i}].reasoning should have 1 entry, got ${stepResult.reasoning.length}`,
      ).toHaveLength(1);
      expect(stepResult.reasoning[0]).toBe(`Reasoning for step ${i}. `);
      expect(stepResult.reasoningText).toBe(`Reasoning for step ${i}. `);
    }
  });

  it("stepResult text and reasoning should only contain that step's content, not cumulative", () => {
    const { bufferedSteps, runId } = simulateMultiStepAgentRun(5);
    const finalState = bufferedSteps.get(runId);

    for (let i = 0; i < finalState.steps.length; i++) {
      const stepResult = finalState.steps[i];

      // Each step's text should only contain its own content
      expect(stepResult.text, `stepResult[${i}].text should contain "Step ${i}" content`).toContain(
        `Step ${i} response text.`,
      );

      // And should NOT contain text from other steps
      for (let j = 0; j < finalState.steps.length; j++) {
        if (j !== i) {
          expect(
            stepResult.text,
            `stepResult[${i}].text should not contain Step ${j} text — ` +
              `cumulative text is leaking into per-step results`,
          ).not.toContain(`Step ${j} response text.`);
        }
      }
    }
  });

  it('structured object should be preserved after step-finish, not reset to null', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'test-run';

    transformAgent(makePayload('start', runId, { id: 'agent-1' }), bufferedSteps);

    // Emit a structured object result
    transformAgent({ type: 'object-result', runId, object: { key: 'value', nested: { a: 1 } } } as any, bufferedSteps);

    // Finish the step
    transformAgent(
      makePayload('step-finish', runId, {
        id: 'step-0',
        stepResult: { reason: 'tool-calls', warnings: [] },
        output: { usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
        metadata: { timestamp: new Date(), modelId: 'test-model' },
      }),
      bufferedSteps,
    );

    const state = bufferedSteps.get(runId);
    // object is last-write-wins and should NOT be cleared on step-finish
    expect(state.object).toEqual({ key: 'value', nested: { a: 1 } });
  });

  it('data-tool-agent payload size should grow linearly with steps, not super-quadratically', () => {
    const { emissions } = simulateMultiStepAgentRun(10);

    const sizes = emissions.map((e: any) => JSON.stringify(e).length);

    // With N steps:
    // - Linear growth: size_N ≈ size_1 * N (each step adds a fixed amount)
    // - Quadratic+ growth: size_N ≈ size_1 * N^2 or worse
    //
    // We check that the last emission is at most 3x the size of a linear
    // extrapolation from the first emission. The actual buggy behavior
    // produces ratios of 50x-100x+ at 10 steps.
    const firstSize = sizes[0]!;
    const lastSize = sizes[sizes.length - 1]!;
    const numSteps = sizes.length;

    // Linear expectation: lastSize ≈ firstSize * numSteps
    const linearExpected = firstSize * numSteps;
    const ratio = lastSize / linearExpected;

    expect(
      ratio,
      `data-tool-agent payload at step ${numSteps} is ${lastSize} bytes, ` +
        `but linear growth predicts ~${linearExpected} bytes (ratio: ${ratio.toFixed(1)}x). ` +
        `This super-linear growth causes OOM in supervisor agent streaming (issue #14932).`,
    ).toBeLessThan(3);
  });

  it('emitted data-tool-agent payloads should not contain internal tracking fields', () => {
    const { emissions } = simulateMultiStepAgentRun(3);

    for (const emission of emissions) {
      const data = emission.data;
      expect(data).not.toHaveProperty('_textOffset');
      expect(data).not.toHaveProperty('_reasoningOffset');

      // Also verify they don't appear in the serialized JSON sent over the wire
      const serialized = JSON.stringify(emission);
      expect(serialized).not.toContain('_textOffset');
      expect(serialized).not.toContain('_reasoningOffset');
    }
  });
});
