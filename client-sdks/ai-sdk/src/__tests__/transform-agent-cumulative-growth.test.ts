import { describe, expect, it } from 'vitest';

import type { AgentDataPart, AgentStepDataPart } from '../transformers';
import { transformAgent } from '../transformers';

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
describe('transformAgent cumulative growth', () => {
  function makePayload(type: string, runId: string, payload: any) {
    return { type, runId, payload } as any;
  }

  function flattenAgentParts(result: any) {
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
  }

  function simulateMultiStepAgentRun(numSteps: number) {
    const bufferedSteps = new Map<string, any>();
    const runId = 'test-run';

    transformAgent(makePayload('start', runId, { id: 'agent-1' }), bufferedSteps);

    const emissions: any[] = [];

    function collect(result: any) {
      emissions.push(...flattenAgentParts(result));
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
            response: {
              messages: [
                {
                  role: 'assistant',
                  content: [{ type: 'text', text: `Completed response for step ${step}. `.repeat(15) }],
                },
              ],
            },
          }),
          bufferedSteps,
        ),
      );
    }

    collect(
      transformAgent(
        makePayload('finish', runId, {
          stepResult: { reason: 'stop', warnings: [] },
          output: { usage: { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 } },
          response: {
            id: 'response-1',
            modelId: 'test-model',
            messages: [
              {
                role: 'assistant',
                content: [{ type: 'text', text: 'Final response'.repeat(20) }],
              },
            ],
          },
        }),
        bufferedSteps,
      ),
    );

    return { emissions, bufferedSteps, runId };
  }

  function getAgentSnapshots(emissions: any[]) {
    return emissions.filter(chunk => chunk.type === 'data-tool-agent') as AgentDataPart[];
  }

  function getAgentStepDeltas(emissions: any[]) {
    return emissions.filter(chunk => chunk.type === 'data-tool-agent-step') as AgentStepDataPart[];
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
      if ('step' in emission.data) {
        expect(emission.data.step).not.toHaveProperty('_textOffset');
        expect(emission.data.step).not.toHaveProperty('_reasoningOffset');
        continue;
      }

      expect(emission.data).not.toHaveProperty('_textOffset');
      expect(emission.data).not.toHaveProperty('_reasoningOffset');
    }
  });

  it('emits compact data-tool-agent snapshots, one full data-tool-agent-step delta per step, and a full terminal data-tool-agent snapshot', () => {
    const { emissions } = simulateMultiStepAgentRun(3);
    const snapshots = getAgentSnapshots(emissions);
    const stepDeltas = getAgentStepDeltas(emissions);

    expect(stepDeltas).toHaveLength(3);
    expect(stepDeltas.map(part => part.id)).toEqual(['test-run:0', 'test-run:1', 'test-run:2']);
    expect(stepDeltas.map(part => part.data.stepIndex)).toEqual([0, 1, 2]);
    expect(stepDeltas[1]?.data.step.text).toContain('Step 1 response text.');
    expect(stepDeltas[1]?.data.step.toolResults[0]?.result).toEqual({
      output: `Result from step 1. `.repeat(50),
    });
    expect(stepDeltas[1]?.data.step.response.messages).toEqual([
      {
        role: 'assistant',
        content: [{ type: 'text', text: `Completed response for step 1. `.repeat(15) }],
      },
    ]);

    for (const snapshot of snapshots.slice(0, -1)) {
      for (const step of snapshot.data.steps as any[]) {
        expect(step.text).toBe('');
        expect(step.reasoning).toEqual([]);
        expect(step.toolCalls).toEqual([]);
        expect(step.toolResults).toEqual([]);
        expect(step.sources).toEqual([]);
        expect(step.files).toEqual([]);
        expect(step.response.messages).toEqual([]);
      }
    }

    const finalSnapshot = snapshots[snapshots.length - 1]!;
    expect(finalSnapshot.data.finishReason).toBe('stop');
    expect(finalSnapshot.data.response.messages).toEqual([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Final response'.repeat(20) }],
      },
    ]);
    expect(finalSnapshot.data.steps).toHaveLength(3);
    expect(finalSnapshot.data.steps[2]?.text).toContain('Step 2 response text.');
    expect(finalSnapshot.data.steps[2]?.toolResults[0]?.result).toEqual({
      output: `Result from step 2. `.repeat(50),
    });
    expect(finalSnapshot.data.steps[2]?.response.messages).toEqual([
      {
        role: 'assistant',
        content: [{ type: 'text', text: `Completed response for step 2. `.repeat(15) }],
      },
    ]);
  });

  it('total serialized bytes grow sub-quadratically when doubling step count', () => {
    // Completed step descriptors and run-level cumulative text/reasoning are still
    // re-emitted in every intermediate snapshot, so growth is ~O(N^1.74) rather than
    // O(N) or O(N²). The bound of 3.8 is derived from the measured head ratio
    // (~3.33 for this fixture) with a 14% margin; it rejects the base O(N²) shape
    // (~4.05) while accepting the compacted head behavior.
    const { emissions: emissionsN } = simulateMultiStepAgentRun(10);
    const { emissions: emissions2N } = simulateMultiStepAgentRun(20);

    const bytesN = emissionsN.reduce((sum, p) => sum + JSON.stringify(p).length, 0);
    const bytes2N = emissions2N.reduce((sum, p) => sum + JSON.stringify(p).length, 0);
    const ratio = bytes2N / bytesN;

    expect(ratio, `2x steps gave ${ratio.toFixed(2)}x bytes (expected < 3.8, head ~3.33, base ~4.05)`).toBeLessThan(
      3.8,
    );
  });

  it('completed-step deltas carry full detail on aborted runs (no finish event)', () => {
    // When a run terminates without a finish event (abort, tripwire, transport error),
    // intermediate snapshots are compact and carry no completed-step detail, but each
    // data-tool-agent-step delta emitted at step-finish carries the full step. A consumer
    // reading both parts loses nothing even without the terminal snapshot.
    const bufferedSteps = new Map<string, any>();
    const runId = 'aborted-run';
    const emissions: any[] = [];

    function collect(result: any) {
      if (!result) return;
      const parts = Array.isArray(result) ? result : [result];
      emissions.push(...parts);
    }

    function makePayload(type: string, payload: any) {
      return { type, runId, payload } as any;
    }

    collect(transformAgent(makePayload('start', { id: 'agent-1' }), bufferedSteps));

    collect(
      transformAgent(
        makePayload('tool-call', {
          type: 'tool-call',
          toolCallId: 'call-0',
          toolName: 'search',
          args: { query: 'abort test' },
          payload: { dynamic: false },
        }),
        bufferedSteps,
      ),
    );

    collect(
      transformAgent(
        makePayload('tool-result', {
          type: 'tool-result',
          toolCallId: 'call-0',
          toolName: 'search',
          result: { data: 'result that only arrives in step delta' },
          payload: { dynamic: false },
        }),
        bufferedSteps,
      ),
    );

    collect(
      transformAgent(
        makePayload('step-finish', {
          id: 'step-0',
          stepResult: { reason: 'tool-calls', warnings: [] },
          output: { usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
          metadata: { timestamp: new Date(), modelId: 'test-model' },
        }),
        bufferedSteps,
      ),
    );

    // Simulate abort: no finish event follows.
    const stepDeltas = emissions.filter(e => e?.type === 'data-tool-agent-step');
    const snapshots = emissions.filter(e => e?.type === 'data-tool-agent');

    // The step delta carries the full completed step.
    expect(stepDeltas).toHaveLength(1);
    expect(stepDeltas[0]!.data.step.toolResults[0]?.result).toEqual({
      data: 'result that only arrives in step delta',
    });

    // All intermediate snapshots are compact: the completed step has no detail.
    for (const snapshot of snapshots) {
      if (snapshot.data.steps.length > 0) {
        expect(snapshot.data.steps[0]!.toolResults).toEqual([]);
      }
    }
  });

  it('keeps later data-tool-agent snapshots free of prior completed-step payloads and bounds total serialized bytes', () => {
    const { emissions } = simulateMultiStepAgentRun(3);
    const snapshots = getAgentSnapshots(emissions);
    const totalBytes = emissions.reduce((sum, part) => sum + JSON.stringify(part).length, 0);
    const finalSnapshot = snapshots[snapshots.length - 1]!;
    const laterIntermediateSnapshot = snapshots.find(
      snapshot => snapshot.data.steps.length === 2 && snapshot.data.text.includes('Step 2 response text.'),
    );

    // Calibrated against the restored full fixture (text repeat(10), toolResult repeat(50)).
    // Base emits ~200 000+ bytes for the same 3-step run; this ceiling proves the fix works.
    expect(totalBytes).toBeLessThan(75000);
    expect(laterIntermediateSnapshot).toBeDefined();
    expect(JSON.stringify(laterIntermediateSnapshot)).not.toContain(`Result from step 0. `.repeat(50));
    expect(JSON.stringify(laterIntermediateSnapshot)).not.toContain(`Completed response for step 0. `.repeat(15));
    expect(finalSnapshot.data.steps[0]?.toolResults[0]?.result).toEqual({
      output: `Result from step 0. `.repeat(50),
    });
  });
});
