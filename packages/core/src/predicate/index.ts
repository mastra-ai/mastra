import { z } from 'zod/v4';

/**
 * Declarative predicate DSL shared across the framework.
 *
 * Predicates are a JSON-safe, storable alternative to closure conditions.
 * The base module owns the grammar and evaluation semantics; each domain
 * (workflows, scoring, ...) composes its own typed evaluator via
 * `createPredicateEvaluator`, supplying only path resolution over its own
 * context shape.
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

const PATH_PLACEHOLDER = /^\$\{([^}]+)\}$/;

/** Sentinel returned by path resolvers when a path can't be resolved. */
export const MISSING = Symbol('predicate.missing');
export type Missing = typeof MISSING;

/**
 * Normalize a raw predicate path. Accepts both plain dotted paths (`foo.bar`)
 * and template-style paths (`${foo.bar}`). Returns `MISSING` for an empty path.
 */
export function normalizePredicatePath(rawPath: string): string | Missing {
  const templateMatch = PATH_PLACEHOLDER.exec(rawPath.trim());
  const path = templateMatch ? templateMatch[1]!.trim() : rawPath.trim();
  if (path === '') return MISSING;
  return path;
}

/**
 * Non-throwing dot-path traversal of an arbitrary object graph. Returns
 * `MISSING` if any segment can't be resolved, so callers can distinguish
 * "no value" from `null`.
 */
export function walk(root: unknown, path: string): unknown | Missing {
  if (path === '') return root;
  const parts = path.split('.');
  let value: unknown = root;
  for (const part of parts) {
    if (value === null || value === undefined) return MISSING;
    if (typeof value !== 'object') return MISSING;
    const record = value as Record<string, unknown>;
    // Own properties only: `in` would match prototype-chain keys (e.g.
    // `constructor`, `toString`), letting stored filter paths resolve to
    // inherited values instead of MISSING.
    if (!Object.hasOwn(record, part)) return MISSING;
    value = record[part];
  }
  return value;
}

/** A domain-supplied path resolver over that domain's context shape. */
export type PredicatePathResolver<TCtx> = (rawPath: string, ctx: TCtx) => unknown | Missing;

/**
 * Compose a typed predicate evaluator from a domain path resolver.
 *
 * The returned evaluator never throws for path resolution failures — missing
 * paths propagate to `false` on comparison ops and `in`, to `true` on the
 * negated ops `notIn` and `notExists` (a missing value is trivially "not in"
 * any set), and to `false` on `exists`. It throws only if the
 * predicate shape itself is malformed (which `predicateSchema.parse` catches
 * at load time).
 */
export function createPredicateEvaluator<TCtx>(
  resolvePath: PredicatePathResolver<TCtx>,
): (pred: Predicate, ctx: TCtx) => boolean {
  const resolveValue = (ref: PathOrLiteral, ctx: TCtx): unknown | Missing => {
    if ('literal' in ref) return ref.literal;
    return resolvePath(ref.path, ctx);
  };

  const evaluate = (pred: Predicate, ctx: TCtx): boolean => {
    switch (pred.op) {
      case 'and':
        return pred.args.every(arg => evaluate(arg, ctx));
      case 'or':
        return pred.args.some(arg => evaluate(arg, ctx));
      case 'not':
        return !evaluate(pred.arg, ctx);
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
  };

  return evaluate;
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
 * Validate that every path referenced by a predicate starts with one of the
 * domain's known roots. Domains call this at definition time so typo'd roots
 * fail loud where they're cheap — evaluation stays fail-quiet by design.
 * Returns the list of offending paths (empty when valid).
 */
export function collectInvalidPredicatePaths(pred: Predicate, roots: readonly string[]): string[] {
  const invalid: string[] = [];
  const checkPath = (rawPath: string) => {
    const normalized = normalizePredicatePath(rawPath);
    if (normalized === MISSING) {
      invalid.push(rawPath);
      return;
    }
    const dot = normalized.indexOf('.');
    const scope = dot === -1 ? normalized : normalized.slice(0, dot);
    if (!roots.includes(scope)) invalid.push(rawPath);
  };
  const checkRef = (ref: PathOrLiteral) => {
    if ('path' in ref) checkPath(ref.path);
  };
  const visit = (p: Predicate) => {
    switch (p.op) {
      case 'and':
      case 'or':
        p.args.forEach(visit);
        break;
      case 'not':
        visit(p.arg);
        break;
      case 'exists':
      case 'notExists':
        checkPath(p.path);
        break;
      case 'truthy':
      case 'falsy':
        checkRef(p.value);
        break;
      case 'in':
      case 'notIn':
        checkRef(p.value);
        break;
      default:
        checkRef(p.left);
        checkRef(p.right);
    }
  };
  visit(pred);
  return invalid;
}

/**
 * Produce a short human-readable label for a predicate, suitable for
 * rendering as a condition-node label in a graph UI.
 * Bounded output length; no user-controlled text is passed through
 * unescaped — string literals go through JSON.stringify, and paths that
 * contain anything beyond plain identifier/dot characters are rendered as
 * JSON strings too, so a malicious value can't break out of the
 * surrounding rendering.
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
      return `${renderPath(pred.path)} exists`;
    case 'notExists':
      return `${renderPath(pred.path)} missing`;
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
  return renderPath(ref.path);
}

/**
 * Paths are only schema-validated as non-empty strings, so anything beyond
 * plain identifier/dot/template characters is escaped via JSON.stringify to
 * keep markup or quotes from reaching the rendered label unchanged.
 */
function renderPath(path: string): string {
  return /^[\w.$]+$/.test(path) ? path : JSON.stringify(path);
}
