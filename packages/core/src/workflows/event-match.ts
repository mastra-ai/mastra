/**
 * Event matching utilities for conditional workflow resume.
 *
 * Provides safe evaluation of `match` (field-path comparison) and `if`
 * (expression-based) conditions used by the `waitForEvent` suspend option.
 */

/**
 * Conditions stored alongside a waiting path entry. Persisted in the
 * workflow snapshot so they survive process restarts.
 */
export interface EventMatchCondition {
  /** Dot-path field to compare between event data and suspend context (e.g. "data.invoiceId"). */
  match?: string;
  /** Expression string evaluated against `event` and `async` bindings. */
  if?: string;
  /** Snapshot of the data the step had when it suspended — the "async" context in expressions. */
  suspendContext?: Record<string, any>;
}

/**
 * Options the user passes to `suspend()` to wait for a named event.
 */
export interface WaitForEventOptions {
  /** The event name to wait for (e.g. "invoice.approved"). */
  event: string;
  /**
   * A dot-path field that must match between the incoming event and the
   * suspend payload.  For example `"data.invoiceId"` means the workflow
   * only resumes when `eventData.data.invoiceId === suspendPayload.data.invoiceId`.
   */
  match?: string;
  /**
   * A simple comparison expression evaluated at resume time.
   *
   * Two variables are available:
   * - `event`  — the incoming event data
   * - `async`  — the data the step had when it suspended (the suspend payload)
   *
   * Supported operators: `==`, `!=`, `&&`, `||` (comparisons use strict equality)
   *
   * Example: `"event.data.userId == async.data.userId && async.data.plan == 'pro'"`
   */
  if?: string;
}

// ---------------------------------------------------------------------------
// Safe dot-path accessor
// ---------------------------------------------------------------------------

/**
 * Retrieves a nested value from `obj` using a dot-separated path.
 * Returns `undefined` when any segment is missing.
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (obj == null || typeof obj !== 'object') return undefined;

  const segments = path.split('.');
  let current: unknown = obj;

  for (const segment of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

// ---------------------------------------------------------------------------
// Match evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates a `match` condition — compares the same dot-path on both the
 * incoming event data and the original suspend context.
 *
 * Returns `true` when the values are strictly equal.
 */
export function evaluateMatch(
  eventData: Record<string, unknown>,
  suspendContext: Record<string, unknown>,
  matchPath: string,
): boolean {
  const eventValue = getNestedValue(eventData, matchPath);
  const suspendValue = getNestedValue(suspendContext, matchPath);
  return eventValue === suspendValue;
}

// ---------------------------------------------------------------------------
// Expression evaluation  (safe — no eval / new Function)
// ---------------------------------------------------------------------------

type TokenKind = 'string' | 'number' | 'boolean' | 'path' | 'op' | 'paren';

interface Token {
  kind: TokenKind;
  value: string;
}

/**
 * Tokenises a simple comparison expression.
 *
 * Recognised tokens:
 *   - string literals: `'...'`
 *   - number literals: `123`, `1.5`, `-42`
 *   - boolean literals: `true`, `false`
 *   - dot-paths: `event.data.userId`, `async.data.plan`
 *   - operators: `==`, `!=`, `&&`, `||`
 *   - parentheses: `(`, `)`
 */
function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i]!;

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // String literal (single-quoted)
    if (ch === "'") {
      let str = '';
      i++; // skip opening quote
      while (i < expr.length && expr[i] !== "'") {
        if (expr[i] === '\\' && i + 1 < expr.length) {
          str += expr[i + 1];
          i += 2;
        } else {
          str += expr[i];
          i++;
        }
      }
      i++; // skip closing quote
      tokens.push({ kind: 'string', value: str });
      continue;
    }

    // String literal (double-quoted)
    if (ch === '"') {
      let str = '';
      i++; // skip opening quote
      while (i < expr.length && expr[i] !== '"') {
        if (expr[i] === '\\' && i + 1 < expr.length) {
          str += expr[i + 1];
          i += 2;
        } else {
          str += expr[i];
          i++;
        }
      }
      i++; // skip closing quote
      tokens.push({ kind: 'string', value: str });
      continue;
    }

    // Parentheses
    if (ch === '(' || ch === ')') {
      tokens.push({ kind: 'paren', value: ch });
      i++;
      continue;
    }

    // Two-char operators
    if (i + 1 < expr.length) {
      const two = ch + expr[i + 1];
      if (two === '==' || two === '!=' || two === '&&' || two === '||') {
        tokens.push({ kind: 'op', value: two });
        i += 2;
        continue;
      }
    }

    // Number literal (including negative)
    if (/\d/.test(ch) || (ch === '-' && i + 1 < expr.length && /\d/.test(expr[i + 1]!))) {
      let num = ch;
      i++;
      while (i < expr.length && /[\d.]/.test(expr[i]!)) {
        num += expr[i];
        i++;
      }
      tokens.push({ kind: 'number', value: num });
      continue;
    }

    // Identifiers / dot-paths / boolean literals
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = ch;
      i++;
      while (i < expr.length && /[a-zA-Z0-9_.$]/.test(expr[i]!)) {
        ident += expr[i];
        i++;
      }
      if (ident === 'true' || ident === 'false') {
        tokens.push({ kind: 'boolean', value: ident });
      } else {
        tokens.push({ kind: 'path', value: ident });
      }
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${i} in expression: ${expr}`);
  }

  return tokens;
}

/**
 * Resolves a token to its runtime value given the `event` and `async` bindings.
 */
function resolveValue(
  token: Token,
  bindings: { event: Record<string, unknown>; async: Record<string, unknown> },
): unknown {
  switch (token.kind) {
    case 'string':
      return token.value;
    case 'number':
      return Number(token.value);
    case 'boolean':
      return token.value === 'true';
    case 'path': {
      const [root, ...rest] = token.value.split('.');
      if (root === 'event') {
        return rest.length > 0 ? getNestedValue(bindings.event, rest.join('.')) : bindings.event;
      }
      if (root === 'async') {
        return rest.length > 0 ? getNestedValue(bindings.async, rest.join('.')) : bindings.async;
      }
      throw new Error(`Unknown variable '${root}' in expression. Only 'event' and 'async' are available.`);
    }
    default:
      throw new Error(`Cannot resolve token of kind '${token.kind}'`);
  }
}

/**
 * Recursive-descent parser for simple boolean expressions.
 *
 * Grammar:
 *   expr     → or_expr
 *   or_expr  → and_expr ( '||' and_expr )*
 *   and_expr → cmp_expr ( '&&' cmp_expr )*
 *   cmp_expr → atom ( ('==' | '!=') atom )?
 *   atom     → '(' expr ')' | literal | path
 */
function parseAndEvaluate(
  tokens: Token[],
  bindings: { event: Record<string, unknown>; async: Record<string, unknown> },
): boolean {
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(): Token {
    return tokens[pos++]!;
  }

  function parseAtom(): unknown {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of expression');

    if (tok.kind === 'paren' && tok.value === '(') {
      consume(); // skip '('
      const result = parseOrExpr();
      const closing = consume();
      if (!closing || closing.kind !== 'paren' || closing.value !== ')') {
        throw new Error('Expected closing parenthesis');
      }
      return result;
    }

    if (tok.kind === 'string' || tok.kind === 'number' || tok.kind === 'boolean' || tok.kind === 'path') {
      consume();
      return resolveValue(tok, bindings);
    }

    throw new Error(`Unexpected token: ${tok.value}`);
  }

  function parseCmpExpr(): unknown {
    const left = parseAtom();
    const op = peek();

    if (op && op.kind === 'op' && (op.value === '==' || op.value === '!=')) {
      consume();
      const right = parseAtom();

      return op.value === '==' ? left === right : left !== right;
    }

    return left;
  }

  function parseAndExpr(): unknown {
    let result = parseCmpExpr();
    while (peek()?.kind === 'op' && peek()?.value === '&&') {
      consume();
      const right = parseCmpExpr();
      result = Boolean(result) && Boolean(right);
    }
    return result;
  }

  function parseOrExpr(): unknown {
    let result = parseAndExpr();
    while (peek()?.kind === 'op' && peek()?.value === '||') {
      consume();
      const right = parseAndExpr();
      result = Boolean(result) || Boolean(right);
    }
    return result;
  }

  const result = parseOrExpr();

  if (pos < tokens.length) {
    throw new Error(`Unexpected token '${tokens[pos]!.value}' after end of expression`);
  }

  return Boolean(result);
}

/**
 * Evaluates an `if` expression string against the incoming event data and
 * the original suspend context.
 *
 * The expression may reference:
 *   - `event.*`  — the incoming event payload
 *   - `async.*`  — the data the step had when it suspended
 *
 * Returns `true` when the expression evaluates to a truthy value.
 *
 * @throws if the expression contains syntax errors or unknown variables
 */
export function evaluateExpression(
  expression: string,
  eventData: Record<string, unknown>,
  suspendContext: Record<string, unknown>,
): boolean {
  const tokens = tokenize(expression);
  if (tokens.length === 0) return true; // empty expression is a pass-through

  return parseAndEvaluate(tokens, {
    event: eventData,
    async: suspendContext,
  });
}

// ---------------------------------------------------------------------------
// Combined evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates all conditions on a waiting path entry against incoming event data.
 * Returns `true` only if ALL conditions pass.
 */
export function evaluateEventConditions(condition: EventMatchCondition, eventData: Record<string, unknown>): boolean {
  const suspendContext = (condition.suspendContext ?? {}) as Record<string, unknown>;

  if (condition.match) {
    if (!evaluateMatch(eventData, suspendContext, condition.match)) {
      return false;
    }
  }

  if (condition.if) {
    if (!evaluateExpression(condition.if, eventData, suspendContext)) {
      return false;
    }
  }

  return true;
}
