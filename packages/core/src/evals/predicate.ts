import type { Missing, Predicate } from '../predicate';
import {
  MISSING,
  collectInvalidPredicatePaths,
  createPredicateEvaluator,
  normalizePredicatePath,
  walk,
} from '../predicate';

/**
 * Scoring target for the shared predicate DSL (`core/src/predicate`).
 *
 * A scorer binding can declare a `filter` predicate that decides whether a
 * given run qualifies for scoring. Filters are evaluated before sampling, so
 * the sampling rate applies to qualifying traffic only (filter → sample).
 *
 * Deliberately excluded roots: `input` and `output`. Output-dependent
 * predicates can't be evaluated against stored records at query time, which
 * would break rule preview / backfill before it exists.
 */

export const SCORING_PREDICATE_ROOTS = [
  'requestContext',
  'entity',
  'entityType',
  'source',
  'threadId',
  'resourceId',
  'projectId',
] as const;

/** A scoring eligibility filter — a predicate over `ScoringPredicateContext`. */
export type ScoringFilter = Predicate;

/** Context a scoring filter predicate can reference. */
export interface ScoringPredicateContext {
  /**
   * The flattened request context (primitive values keyed by dot-joined flat
   * keys, e.g. `"user.tier"`), matching what is persisted on score rows.
   * Nested objects are also supported for callers that haven't flattened.
   */
  requestContext?: Record<string, unknown>;
  entity?: Record<string, unknown>;
  entityType?: string;
  source?: string;
  threadId?: string;
  resourceId?: string;
  projectId?: string;
}

function resolveScoringPath(rawPath: string, ctx: ScoringPredicateContext): unknown | Missing {
  const path = normalizePredicatePath(rawPath);
  if (path === MISSING) return MISSING;
  const dot = path.indexOf('.');
  const scope = dot === -1 ? path : path.slice(0, dot);
  const rest = dot === -1 ? '' : path.slice(dot + 1);

  switch (scope) {
    case 'requestContext': {
      const rc = ctx.requestContext;
      if (rc === undefined || rc === null) return MISSING;
      if (!rest) return rc;
      // The live scoring path flattens requestContext into dot-joined flat
      // keys before filtering, so `requestContext.a.b` is stored as the
      // single key `"a.b"`. Prefer the flat lookup; fall back to nested
      // traversal for unflattened contexts.
      if (typeof rc === 'object' && Object.hasOwn(rc, rest)) return rc[rest];
      return walk(rc, rest);
    }
    case 'entity':
      // An absent entity root is MISSING (matching the requestContext branch);
      // `walk` would otherwise return the undefined root for an empty rest
      // path, making `exists entity` qualify on runs with no entity at all.
      if (ctx.entity === undefined || ctx.entity === null) return MISSING;
      return walk(ctx.entity, rest);
    case 'entityType':
    case 'source':
    case 'threadId':
    case 'resourceId':
    case 'projectId': {
      // Scalar roots: a bare path resolves to the value; sub-paths and absent
      // values are MISSING, so `exists threadId` means "a thread ID is set".
      if (rest) return MISSING;
      const value = ctx[scope];
      return value === undefined ? MISSING : value;
    }
    default:
      // Unknown scope. Return MISSING rather than throwing — predicates never
      // fail loud at evaluation time, only at definition time (see
      // `validateScoringPredicate`).
      return MISSING;
  }
}

/**
 * Evaluate a scoring filter against a scoring context. Never throws for path
 * resolution failures — missing paths propagate to `false` on comparison ops
 * and `in` (fail closed: an unresolvable filter does not score), but to
 * `true` on the negated ops `notIn` and `notExists` (a missing value is
 * trivially "not in" any set), and to `false` on `exists`.
 */
export const evaluateScoringPredicate: (pred: Predicate, ctx: ScoringPredicateContext) => boolean =
  createPredicateEvaluator(resolveScoringPath);

/**
 * Validate a scoring filter at definition time. Throws if any referenced path
 * doesn't start with a known scoring root, so typos fail loud when the
 * binding is registered instead of silently skipping all scoring at runtime.
 */
export function validateScoringPredicate(pred: Predicate): void {
  const invalid = collectInvalidPredicatePaths(pred, SCORING_PREDICATE_ROOTS);
  if (invalid.length > 0) {
    throw new Error(
      `Invalid scoring filter: path(s) ${invalid.map(p => `"${p}"`).join(', ')} must start with one of: ${SCORING_PREDICATE_ROOTS.join(', ')}`,
    );
  }
}
