import { describe, it, expect } from 'vitest';
import type { IterationCompleteContext } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * A run that ends after a single text-only step still fires `onIterationComplete`
 * once, as the final iteration, with that step's text, finish reason, agent id
 * and the user + assistant messages.
 *
 * Replaces "Hook configuration validation > should accept iteration complete
 * hook configuration" in packages/core/src/agent/__tests__/supervisor-integration.test.ts.
 */

function expectSingleFinalIteration(iterations: IterationCompleteContext[], agentId: string) {
  expect(iterations.map(i => [i.iteration, i.isFinal, i.finishReason])).toEqual([[1, true, 'stop']]);
  const [ctx] = iterations;
  expect(ctx!.text).toBe('Response');
  expect(ctx!.agentId).toBe(agentId);
  expect(ctx!.toolCalls).toEqual([]);
  expect(ctx!.toolResults).toEqual([]);
  expect(ctx!.messages.map(m => m.role)).toEqual(['user', 'assistant']);
}

describeForAllEngines('AIMock loop scenario: supervisor onIterationComplete on a text-only run', engine => {
  // Inngest's agentic loop has no isTaskComplete, goal, or onIterationComplete steps yet.
  const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
  const getMock = useLoopScenarioAimock();

  itFailsOnInngest('fires once as the final iteration with the step text and messages', async () => {
    const iterations: IterationCompleteContext[] = [];
    const { output, agent } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Test prompt',
      maxSteps: 1,
      errorProcessors: [],
      onIterationComplete: (ctx: IterationCompleteContext) => void iterations.push(ctx),
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Response' });
      },
    });

    expect(await output.text).toBe('Response');
    expectSingleFinalIteration(iterations, agent.id);
  });
});

// generate() runs only on the plain Agent, so this case is not engine-parameterised.
describe('AIMock loop scenario: supervisor onIterationComplete on a text-only run (generate)', () => {
  const getMock = useLoopScenarioAimock();

  it('fires once as the final iteration with the step text and messages', async () => {
    const mock = getMock();
    mock.on({ endpoint: 'chat' }, { content: 'Response' });
    const { agent } = await createSharedAgent(mock, { memory: new MockMemory(), errorProcessors: [] });
    const iterations: IterationCompleteContext[] = [];

    const output = await agent.generate('Test prompt', {
      maxSteps: 1,
      onIterationComplete: ctx => void iterations.push(ctx),
    });

    expect(output.text).toBe('Response');
    expectSingleFinalIteration(iterations, agent.id);
  });
});
