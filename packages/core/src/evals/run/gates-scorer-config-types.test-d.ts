import { describe, it, expectTypeOf } from 'vitest';
import type { Agent } from '../../agent';
import type { AnyWorkflow } from '../../workflows/workflow';
import type { MastraScorer } from '../base';
import { runEvals } from '.';
import type { AgentScorerConfig, RunEvalsResult, WorkflowScorerConfig } from '.';

/**
 * Regression tests for issue #21136: `runEvals` accepts `gates` together with a
 * categorized scorer config (`AgentScorerConfig` / `WorkflowScorerConfig`) at
 * runtime, but the TypeScript overloads only declared `gates` alongside a flat
 * `ScorerEntry[]`. Combining `gates` with `scorers: { trajectory: [...] }`
 * therefore failed to compile with TS2769 even though the call works. These are
 * type-level assertions only — no runtime behavior is exercised.
 */
describe('runEvals gates + categorized scorer config overloads (issue #21136)', () => {
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
