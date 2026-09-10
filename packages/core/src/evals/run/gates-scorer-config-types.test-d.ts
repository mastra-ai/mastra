import { describe, it, expectTypeOf } from 'vitest';
import type { Agent } from '../../agent';
import type { AnyWorkflow } from '../../workflows/workflow';
import type { MastraScorer } from '../base';
import { runEvals } from '.';
import type { AgentScorerConfig, RunEvalsItemResult, RunEvalsResult, ScorerEntry, WorkflowScorerConfig } from '.';

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

  it('accepts gates together with threshold-bearing ScorerEntry[] for a Workflow target (issue #21290)', () => {
    const workflow = {} as AnyWorkflow;
    const gates = [] as MastraScorer<any, any, any, any>[];
    const scorers = [] as ScorerEntry[];

    const result = runEvals({
      target: workflow,
      data: [{ input: 'run it' }],
      gates,
      scorers,
    });

    expectTypeOf(result).resolves.toEqualTypeOf<RunEvalsResult>();
  });

  it('exposes per-item outcomes and completion counts', () => {
    const item = {} as RunEvalsItemResult;

    expectTypeOf(item.status).toEqualTypeOf<'success' | 'failed'>();
    if (item.status === 'success') {
      expectTypeOf(item.scorerResults).toEqualTypeOf<Record<string, unknown>>();
    } else {
      expectTypeOf(item.phase).toEqualTypeOf<'target' | 'scoring' | 'completion'>();
      expectTypeOf(item.error.message).toEqualTypeOf<string>();
    }

    const result = {} as RunEvalsResult;
    expectTypeOf(result.items).toEqualTypeOf<RunEvalsItemResult[]>();
    expectTypeOf(result.summary.succeededItems).toEqualTypeOf<number>();
    expectTypeOf(result.summary.failedItems).toEqualTypeOf<number>();
  });

  it('narrows onItemComplete outcomes for failures', () => {
    const agent = {} as Agent;
    const scorers = [] as ScorerEntry[];

    void runEvals({
      target: agent,
      data: [{ input: 'hi' }],
      scorers,
      onItemComplete: outcome => {
        if (outcome.status === 'success') {
          expectTypeOf(outcome.targetResult).not.toBeNever();
        } else {
          expectTypeOf(outcome.error.message).toEqualTypeOf<string>();
          // @ts-expect-error Failed outcomes do not have a target result.
          void outcome.targetResult;
        }
      },
    });
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
