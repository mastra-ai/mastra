import type { Missing, Predicate } from '../../predicate';
import { MISSING, createPredicateEvaluator, normalizePredicatePath, walk } from '../../predicate';

/**
 * Workflow target for the shared predicate DSL (`core/src/predicate`).
 *
 * Predicates for `conditional` / `loop` steps evaluate against the same three
 * roots that mapping templates see — `initData`, `inputData`, and
 * `stepResults` — plus an optional `state` root for workflows that expose one.
 */

// Re-export the base grammar so the public `@mastra/core/workflows` surface
// (`export * from './predicate'` in ../index.ts) is unchanged by the move.
export { predicateSchema, derivePredicateLabel } from '../../predicate';
export type { Predicate, PathOrLiteral } from '../../predicate';

/**
 * Runtime context a workflow predicate can reference. Exposes the same roots
 * that mapping templates and `${...}` placeholders see.
 */
export interface PredicateContext {
  initData?: unknown;
  inputData?: unknown;
  state?: unknown;
  /**
   * Pre-materialized step-results map. Predicates prefer this when present.
   * If absent, `getStepResult` is used to look values up on demand — that
   * form matches the shape a workflow condition callback exposes at runtime.
   */
  stepResults?: Record<string, unknown>;
  getStepResult?: (stepId: string) => unknown;
}

function resolveWorkflowPath(rawPath: string, ctx: PredicateContext): unknown | Missing {
  const path = normalizePredicatePath(rawPath);
  if (path === MISSING) return MISSING;
  const dot = path.indexOf('.');
  const scope = dot === -1 ? path : path.slice(0, dot);
  const rest = dot === -1 ? '' : path.slice(dot + 1);

  switch (scope) {
    case 'initData':
      return walk(ctx.initData, rest);
    case 'inputData':
      return walk(ctx.inputData, rest);
    case 'state':
      return walk(ctx.state, rest);
    case 'stepResults': {
      if (!rest) return MISSING;
      const innerDot = rest.indexOf('.');
      const stepId = innerDot === -1 ? rest : rest.slice(0, innerDot);
      const subPath = innerDot === -1 ? '' : rest.slice(innerDot + 1);
      let stepResult: unknown;
      if (ctx.stepResults && stepId in ctx.stepResults) {
        stepResult = ctx.stepResults[stepId];
      } else if (ctx.getStepResult) {
        try {
          stepResult = ctx.getStepResult(stepId);
        } catch {
          return MISSING;
        }
      } else {
        return MISSING;
      }
      // The runtime accessor (step.ts getStepResult) returns null both for a
      // genuinely absent step and for a step without a successful output, so a
      // null/undefined step result is indistinguishable from "missing". Treat
      // it as MISSING in both context shapes so the same predicate evaluates
      // identically whether the caller supplies a stepResults map or an
      // accessor: `exists stepResults.<id>` means "step produced a successful,
      // non-null output".
      if (stepResult === undefined || stepResult === null) return MISSING;
      return walk(stepResult, subPath);
    }
    default:
      // Unknown scope. Return MISSING rather than throwing — predicates never
      // fail loud at evaluation time, only at parse/definition time.
      return MISSING;
  }
}

/**
 * Evaluate a predicate against a workflow context. Never throws for path
 * resolution failures — missing paths propagate to `false` on
 * comparison/membership ops, and to `false` / `true` on `exists` /
 * `notExists` respectively.
 */
export const evaluatePredicate: (pred: Predicate, ctx: PredicateContext) => boolean =
  createPredicateEvaluator(resolveWorkflowPath);
