import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: supervisor-style `isTaskComplete` gating of the loop.
 *
 * `isTaskComplete` runs a completion scorer after each iteration. A scorer that
 * returns `score: 0` forces the loop to run the model again; `score: 1` lets the
 * loop finish. Each evaluation emits an `is-task-complete` chunk and injects a
 * "Completion Check Results" feedback message that the next model turn must see.
 *
 * This pins three behaviors that have broken when the loop's continuation
 * plumbing changed:
 *  - a failing score actually re-invokes the model (not a silent stop),
 *  - the completion feedback is plumbed into the *next* request, and
 *  - a passing score halts the loop.
 */
describeForAllEngines('AIMock loop scenario: isTaskComplete gating', engine => {
  const getMock = useLoopScenarioAimock();

  it('re-invokes the model on a failing score, then stops on a passing score', async () => {
    let scorerCalls = 0;
    // Fails the first evaluation, passes the second — mirrors the supervisor
    // adaptive-scorer integration test, but driven over the real OpenAI wire.
    const adaptiveScorer = {
      id: 'adaptive-scorer',
      name: 'Adaptive Scorer',
      run: async () => {
        scorerCalls++;
        return scorerCalls === 1
          ? { score: 0, reason: 'Task not complete yet' }
          : { score: 1, reason: 'Task is complete' };
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Draft a release summary.',
      stopWhen: stepCountIs(5),
      isTaskComplete: { scorers: [adaptiveScorer as any] },
      fixtures: llm => {
        // Turn 1: first model answer (scorer will fail this, forcing a re-run).
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'First draft.' });
        // Turn 2: after the completion-feedback message is injected, the model
        // answers again (scorer passes this time, ending the loop).
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Revised final draft.' });
      },
    });

    // The scorer ran twice: one fail, one pass.
    expect(scorerCalls).toBe(2);

    // A failing score must actually re-invoke the model — two turns, not one.
    expect(requests.length).toBe(2);

    // The completion-feedback message from the first (failed) evaluation must be
    // plumbed into the second request so the model can iterate on it.
    const turn2Messages = (requests[1]?.body as any)?.messages ?? [];
    const turn2Text = JSON.stringify(turn2Messages);
    expect(turn2Text).toContain('Completion Check Results');
    expect(turn2Text).toContain('NOT COMPLETE');

    // The loop ends on the second (passing) turn's answer.
    const text = await (output as unknown as { text: Promise<string> }).text;
    expect(text).toContain('Revised final draft.');
  });
});
