import { describe, it, expectTypeOf } from 'vitest';
import { z } from 'zod/v4';
import type { Agent } from '../../agent';
import { createStep, createWorkflow } from '../../workflows';
import type { AnyWorkflow } from '../../workflows/workflow';
import { createScorer } from '../base';
import type { MastraScorer } from '../base';
import { runEvals } from '.';
import type { AgentScorerConfig, RunEvalsResult, WorkflowScorerConfig } from '.';

/**
 * Regression tests for issues #21136 and #21290: `runEvals` accepts `gates`
 * alongside its scorer configurations at runtime, but the TypeScript overloads
 * were narrower than the implementation. These type-level assertions cover
 * both categorized configs and workflow threshold entries — no runtime
 * behavior is exercised.
 */
describe('runEvals gates + scorer overloads', () => {
  it('accepts gates together with an AgentScorerConfig (trajectory scorers)', () => {
    const agent = {} as Agent;
    const gates = [] as MastraScorer<any, any, any, any>[];
    const scorers = {} as AgentScorerConfig;

    const result = runEvals({
      target: agent,
      data: [{ input: 'Where is my order 1002?' }],
      gates,
      scorers,
    });

    expectTypeOf(result).resolves.toEqualTypeOf<RunEvalsResult>();
  });

  it('accepts gates together with a WorkflowScorerConfig', () => {
    const workflow = {} as AnyWorkflow;
    const gates = [] as MastraScorer<any, any, any, any>[];
    const scorers = {} as WorkflowScorerConfig;

    const result = runEvals({
      target: workflow,
      data: [{ input: 'run it' }],
      gates,
      scorers,
    });

    expectTypeOf(result).resolves.toEqualTypeOf<RunEvalsResult>();
  });

  it('accepts the issue #21290 workflow repro with gates and a threshold scorer', () => {
    const inputSchema = z.object({ n: z.number() });
    const outputSchema = z.object({ doubled: z.number() });
    const workflow = createWorkflow({ id: 'repro-wf', inputSchema, outputSchema })
      .then(
        createStep({
          id: 'double',
          inputSchema,
          outputSchema,
          execute: async ({ inputData }) => ({ doubled: inputData.n * 2 }),
        }),
      )
      .commit();

    const scorerType = { input: inputSchema, output: outputSchema };
    const evenGate = createScorer({ id: 'even-gate', description: 'gate', type: scorerType }).generateScore(
      ({ run }) => (run.output.doubled % 2 === 0 ? 1 : 0),
    );
    const ratioScorer = createScorer({ id: 'ratio', description: 'threshold scorer', type: scorerType }).generateScore(
      ({ run }) => run.output.doubled / 10,
    );

    const result = runEvals({
      target: workflow,
      data: [{ input: { n: 2 } }, { input: { n: 4 } }],
      gates: [evenGate],
      scorers: [{ scorer: ratioScorer, threshold: 0.5 }],
    });

    expectTypeOf(result).resolves.toEqualTypeOf<RunEvalsResult>();
  });

  it('still accepts an AgentScorerConfig without gates', () => {
    const agent = {} as Agent;
    const scorers = {} as AgentScorerConfig;

    const result = runEvals({
      target: agent,
      data: [{ input: 'hi' }],
      scorers,
    });

    expectTypeOf(result).resolves.toEqualTypeOf<RunEvalsResult>();
  });

  it('rejects unknown properties on the categorized-config overload', () => {
    const agent = {} as Agent;
    const gates = [] as MastraScorer<any, any, any, any>[];
    const scorers = {} as AgentScorerConfig;

    void runEvals({
      target: agent,
      data: [{ input: 'hi' }],
      gates,
      scorers,
      // @ts-expect-error - `notARealOption` is not a valid runEvals config property
      notARealOption: true,
    });
  });
});
