import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: `isTaskComplete` short-circuit on immediate pass.
 *
 * When the scorer passes on the very first evaluation the loop should NOT
 * re-invoke the model — it halts after one turn. This pins a regression class
 * where a faulty continuation check causes the loop to iterate past a
 * completed task, wasting tokens and potentially overwriting a good answer.
 */
describeForAllEngines('AIMock loop scenario: isTaskComplete early stop', engine => {
  const getMock = useLoopScenarioAimock();

  it('stops after a single model request when the scorer passes immediately', async () => {
    let scorerCalls = 0;
    const immediatePassScorer = {
      id: 'immediate-pass',
      name: 'Immediate Pass',
      run: async () => {
        scorerCalls++;
        return { score: 1, reason: 'Good answer on first try' };
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Write a one-sentence greeting.',
      stopWhen: stepCountIs(5),
      isTaskComplete: { scorers: [immediatePassScorer as any] },
      fixtures: llm => {
        // Only one turn should fire — scorer passes immediately.
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Hello, world!' });
        // If the loop wrongly re-invokes, this fixture catches it (test asserts below).
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'UNEXPECTED_REINVOCATION' });
      },
    });

    // Scorer evaluated exactly once.
    expect(scorerCalls).toBe(1);

    // Loop halted after one turn — no re-invocation.
    expect(requests.length).toBe(1);

    const text = await (output as unknown as { text: Promise<string> }).text;
    expect(text).toContain('Hello, world!');
    expect(text).not.toContain('UNEXPECTED_REINVOCATION');
  });
});
