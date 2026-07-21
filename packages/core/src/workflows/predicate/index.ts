import { z } from 'zod/v4';

/**
 * Declarative predicate DSL for workflow `conditional` / `loop` steps.
 *
 * Predicates are a JSON-safe, storable alternative to closure conditions.
 * They evaluate against the same three roots that mapping templates see —
 * `initData`, `inputData`, and `stepResults` — plus an optional `state`
 * root for workflows that expose one.
 *
 * The DSL is deliberately minimal: comparisons, membership, existence,
 * truthiness, and boolean composition. Missing paths never throw — path-based
 * ops return `false` when the path can't be resolved. Callers who want to
 * distinguish "missing" from "falsy" should use `exists` / `notExists`.
 */

const LITERAL_SCALAR = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const pathRef: z.ZodType<{ path: string }> = z.object({ path: z.string().min(1) }).strict();
const literalRef: z.ZodType<{ literal: string | number | boolean | null }> = z
  .object({ literal: LITERAL_SCALAR })
  .strict();
const pathOrLiteral: z.ZodType<PathOrLiteral> = z.union([pathRef, literalRef]);

const COMPARISON_OPS = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte'] as const;
const MEMBERSHIP_OPS = ['in', 'notIn'] as const;

/**
 * The predicate Zod schema. We define it via `z.lazy` so the recursive
 * `and` / `or` / `not` branches can reference the top-level type.
 */
export const predicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.union([
    z.object({ op: z.enum(COMPARISON_OPS), left: pathOrLiteral, right: pathOrLiteral }).strict(),
    z
      .object({
        op: z.enum(MEMBERSHIP_OPS),
        value: pathOrLiteral,
        set: z.array(LITERAL_SCALAR).min(1),
      })
      .strict(),
    z.object({ op: z.enum(['exists', 'notExists']), path: z.string().min(1) }).strict(),
    z.object({ op: z.enum(['truthy', 'falsy']), value: pathOrLiteral }).strict(),
    z.object({ op: z.enum(['and', 'or']), args: z.array(predicateSchema).min(1) }).strict(),
    z.object({ op: z.literal('not'), arg: predicateSchema }).strict(),
  ]),
);

export type PathOrLiteral = { path: string } | { literal: string | number | boolean | null };

export type Predicate =
  | { op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte'; left: PathOrLiteral; right: PathOrLiteral }
  | { op: 'in' | 'notIn'; value: PathOrLiteral; set: Array<string | number | boolean | null> }
  | { op: 'exists' | 'notExists'; path: string }
  | { op: 'truthy' | 'falsy'; value: PathOrLiteral }
  | { op: 'and' | 'or'; args: Predicate[] }
  | { op: 'not'; arg: Predicate };

/**
 * Runtime context a predicate can reference. Exposes the same roots that
 * mapping templates and `${...}` placeholders see.
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

const PATH_PLACEHOLDER = /^\$\{([^}]+)\}$/;

/** Sentinel returned by `resolvePath` when the path can't be resolved. */
const MISSING = Symbol('predicate.missing');
type Missing = typeof MISSING;

/**
 * Non-throwing path traversal. Accepts both plain dotted paths (`foo.bar`)
 * and template-style paths (`${initData.foo.bar}`). Returns `MISSING` if any
 * segment can't be resolved, so callers can distinguish "no value" from `null`.
 */
function resolvePath(rawPath: string, ctx: PredicateContext): unknown | Missing {
  const templateMatch = PATH_PLACEHOLDER.exec(rawPath.trim());
  const path = templateMatch ? templateMatch[1]!.trim() : rawPath.trim();
  if (path === '') return MISSING;
  const dot = path.indexOf('.');
  const scope = dot === -1 ? path : path.slice(0, dot);
  const rest = dot === -1 ? '' : path.slice(dot + 1);

  let root: unknown;
  switch (scope) {
    case 'initData':
      root = ctx.initData;
      break;
    case 'inputData':
      root = ctx.inputData;
      break;
    case 'state':
      root = ctx.state;
      break;
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
        if (stepResult === undefined || stepResult === null) return MISSING;
      } else {
        return MISSING;
      }
      return walk(stepResult, subPath);
    }
    default:
      // Unknown scope. Return MISSING rather than throwing — predicates never
      // fail loud at evaluation time, only at parse/definition time.
      return MISSING;
  }

  return walk(root, rest);
}

function walk(root: unknown, path: string): unknown | Missing {
  if (path === '') return root;
  const parts = path.split('.');
  let value: unknown = root;
  for (const part of parts) {
    if (value === null || value === undefined) return MISSING;
    if (typeof value !== 'object') return MISSING;
    const record = value as Record<string, unknown>;
    if (!(part in record)) return MISSING;
    value = record[part];
  }
  return value;
}

function resolveValue(ref: PathOrLiteral, ctx: PredicateContext): unknown | Missing {
  if ('literal' in ref) return ref.literal;
  return resolvePath(ref.path, ctx);
}

/**
 * Evaluate a predicate against a context. Never throws for path resolution
 * failures — missing paths propagate to `false` on comparison/membership ops,
 * and to `false` / `true` on `exists` / `notExists` respectively.
 *
 * Throws only if the predicate shape itself is malformed (which
 * `predicateSchema.parse` catches at load time).
 */
export function evaluatePredicate(pred: Predicate, ctx: PredicateContext): boolean {
  switch (pred.op) {
    case 'and':
      return pred.args.every(arg => evaluatePredicate(arg, ctx));
    case 'or':
      return pred.args.some(arg => evaluatePredicate(arg, ctx));
    case 'not':
      return !evaluatePredicate(pred.arg, ctx);
    case 'exists': {
      const v = resolvePath(pred.path, ctx);
      return v !== MISSING;
    }
    case 'notExists': {
      const v = resolvePath(pred.path, ctx);
      return v === MISSING;
    }
    case 'truthy':
    case 'falsy': {
      const v = resolveValue(pred.value, ctx);
      const truthy = v !== MISSING && Boolean(v);
      return pred.op === 'truthy' ? truthy : !truthy;
    }
    case 'in':
    case 'notIn': {
      const v = resolveValue(pred.value, ctx);
      if (v === MISSING) return pred.op === 'notIn';
      const member = pred.set.some(candidate => strictEqual(candidate, v));
      return pred.op === 'in' ? member : !member;
    }
    case 'eq':
    case 'ne':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte': {
      const left = resolveValue(pred.left, ctx);
      const right = resolveValue(pred.right, ctx);
      if (left === MISSING || right === MISSING) return false;
      return compare(pred.op, left, right);
    }
  }
}

function strictEqual(a: unknown, b: unknown): boolean {
  // Set membership uses strict equality on scalars. `null === null` is true;
  // NaN never equals itself (matches SQL/JS semantics both).
  return a === b;
}

function compare(op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte', left: unknown, right: unknown): boolean {
  if (op === 'eq') return left === right;
  if (op === 'ne') return left !== right;
  // Ordering ops require comparable scalars. Anything else is `false`.
  if (
    (typeof left === 'number' && typeof right === 'number') ||
    (typeof left === 'string' && typeof right === 'string')
  ) {
    switch (op) {
      case 'lt':
        return left < right;
      case 'lte':
        return left <= right;
      case 'gt':
        return left > right;
      case 'gte':
        return left >= right;
    }
  }
  return false;
}

/**
 * Produce a short human-readable label for a predicate, suitable for
 * rendering as a condition-node label in the workflow graph UI.
 * Bounded output length; no user-controlled text is passed through
 * unescaped — every string literal goes through JSON.stringify so a
 * malicious label can't break out of the surrounding rendering.
 */
export function derivePredicateLabel(pred: Predicate, maxLength = 80): string {
  const raw = renderPredicate(pred);
  if (raw.length <= maxLength) return raw;
  return raw.slice(0, maxLength - 1) + '…';
}

function renderPredicate(pred: Predicate): string {
  switch (pred.op) {
    case 'and':
    case 'or':
      return pred.args.map(arg => wrap(arg, renderPredicate(arg))).join(pred.op === 'and' ? ' AND ' : ' OR ');
    case 'not':
      return `NOT ${wrap(pred.arg, renderPredicate(pred.arg))}`;
    case 'exists':
      return `${pred.path} exists`;
    case 'notExists':
      return `${pred.path} missing`;
    case 'truthy':
      return `${renderValue(pred.value)} is truthy`;
    case 'falsy':
      return `${renderValue(pred.value)} is falsy`;
    case 'in':
      return `${renderValue(pred.value)} in ${JSON.stringify(pred.set)}`;
    case 'notIn':
      return `${renderValue(pred.value)} not in ${JSON.stringify(pred.set)}`;
    case 'eq':
      return `${renderValue(pred.left)} == ${renderValue(pred.right)}`;
    case 'ne':
      return `${renderValue(pred.left)} != ${renderValue(pred.right)}`;
    case 'lt':
      return `${renderValue(pred.left)} < ${renderValue(pred.right)}`;
    case 'lte':
      return `${renderValue(pred.left)} <= ${renderValue(pred.right)}`;
    case 'gt':
      return `${renderValue(pred.left)} > ${renderValue(pred.right)}`;
    case 'gte':
      return `${renderValue(pred.left)} >= ${renderValue(pred.right)}`;
  }
}

function wrap(child: Predicate, rendered: string): string {
  // Parenthesize child boolean composites so precedence is unambiguous.
  return child.op === 'and' || child.op === 'or' || child.op === 'not' ? `(${rendered})` : rendered;
}

function renderValue(ref: PathOrLiteral): string {
  if ('literal' in ref) return JSON.stringify(ref.literal);
  return ref.path;
}
