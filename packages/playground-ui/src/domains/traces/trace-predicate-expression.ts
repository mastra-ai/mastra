import type { TraceQueryPredicate, TraceQueryScalarPredicate } from '@mastra/core/storage';
import { isTokenSearchField } from '../observability/lib/token-search-predicate';
import type {
  FilterBarExpression,
  FilterBarField,
  FilterBarGroup,
  FilterBarGroupScope,
  FilterBarItem,
  FilterBarLogic,
  FilterBarNode,
  FilterBarPlace,
  FilterBarQuantifier,
  FilterBarScalar,
  FilterBarValue,
} from '@/ds/components/FilterBar/types';

// A trace predicate (`TraceQuery['where']`) and the FilterBar expression that edits it, both ways.
// Chips carry the predicate operator as `operatorId` and the field path as `fieldId` (the path inside
// the collection for a related clause); `not` is a negated node; `{ spans: { some } }` and the other
// collections are scoped groups whose quantifier is `some` / `none`. Keep the expression as the
// editing state and write the predicate from it: ids read from a predicate are positional.

type Condition = Exclude<TraceQueryScalarPredicate, { op: 'and' | 'or' | 'not' }>;
type ConditionOp = Condition['op'];
type RelatedClause = Exclude<TraceQueryPredicate, { op: unknown }>;
type RelatedScope = 'spans' | 'scores' | 'feedback';
type Quantifier = 'some' | 'none';

export const TRACE_PREDICATE_OPERATOR_IDS = [
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'notIn',
  'exists',
  'notExists',
  'includes',
  'notIncludes',
  'matches',
  'notMatches',
  'hasAllTokens',
] as const satisfies readonly ConditionOp[];

export const TRACE_PREDICATE_SCOPE_IDS = ['spans', 'scores', 'feedback'] as const satisfies readonly RelatedScope[];

/** Quantifiers of a related clause, `some` first as the default. */
export const TRACE_PREDICATE_QUANTIFIERS: FilterBarQuantifier[] = [
  { id: 'some', label: 'Has' },
  { id: 'none', label: 'Has no' },
];

const isConditionOp = (id: string): id is ConditionOp =>
  (TRACE_PREDICATE_OPERATOR_IDS as readonly string[]).includes(id);

const childId = (parent: string, index: number) => (parent ? `${parent}.${index}` : String(index));

/** The expression editing `predicate`; undefined when it holds a shape the bar cannot show, such as a
 *  comparison of two paths or a `null` literal. */
export function tracePredicateToExpression(
  predicate: TraceQueryPredicate | undefined,
): FilterBarExpression | undefined {
  if (!predicate) return { logic: 'and', nodes: [] };
  return spread(predicate, '');
}

/** Spreads a predicate over a list of nodes: a group gives its logic and arguments, anything else is one node. */
function spread(predicate: TraceQueryPredicate, parent: string): FilterBarExpression | undefined {
  const [logic, args]: [FilterBarLogic, TraceQueryPredicate[]] =
    'op' in predicate && (predicate.op === 'and' || predicate.op === 'or')
      ? [predicate.op, predicate.args]
      : ['and', [predicate]];
  const nodes = nodesOf(args, parent);
  return nodes && { logic, nodes };
}

function nodesOf(args: TraceQueryPredicate[], parent: string): FilterBarNode[] | undefined {
  const nodes: FilterBarNode[] = [];
  for (const [index, arg] of args.entries()) {
    const node = nodeOf(arg, childId(parent, index));
    if (!node) return undefined;
    nodes.push(node);
  }
  return nodes;
}

function nodeOf(predicate: TraceQueryPredicate, id: string): FilterBarNode | undefined {
  if (!('op' in predicate)) {
    const { scope, quantifier, body } = relatedOf(predicate);
    const inner = spread(body, id);
    return (
      inner && {
        id,
        kind: 'group',
        logic: inner.logic,
        scope: { id: scope, quantifierId: quantifier },
        nodes: inner.nodes,
      }
    );
  }
  switch (predicate.op) {
    case 'and':
    case 'or': {
      const nodes = nodesOf(predicate.args, id);
      return nodes && { id, kind: 'group', logic: predicate.op, nodes };
    }
    case 'not': {
      // A node holds one negation: a second one needs a group around it.
      if ('op' in predicate.arg && predicate.arg.op === 'not') {
        const inner = nodeOf(predicate.arg, childId(id, 0));
        return inner && { id, kind: 'group', logic: 'and', negated: true, nodes: [inner] };
      }
      const node = nodeOf(predicate.arg, id);
      return node && { ...node, negated: true };
    }
    default:
      return itemOf(predicate, id);
  }
}

function relatedOf(clause: RelatedClause): {
  scope: RelatedScope;
  quantifier: Quantifier;
  body: TraceQueryScalarPredicate;
} {
  const [scope, quantified] =
    'spans' in clause
      ? (['spans', clause.spans] as const)
      : 'scores' in clause
        ? (['scores', clause.scores] as const)
        : (['feedback', clause.feedback] as const);
  return 'some' in quantified
    ? { scope, quantifier: 'some', body: quantified.some }
    : { scope, quantifier: 'none', body: quantified.none };
}

const scalarOf = (literal: FilterBarScalar | null): FilterBarScalar | undefined =>
  literal === null ? undefined : literal;

function itemOf(condition: Condition, id: string): FilterBarItem | undefined {
  const item = (fieldId: string, value: FilterBarValue): FilterBarItem => ({
    id,
    fieldId,
    operatorId: condition.op,
    value,
  });
  switch (condition.op) {
    case 'eq':
    case 'ne':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte': {
      const { left, right } = condition;
      if (!('path' in left) || !('literal' in right)) return undefined;
      const value = scalarOf(right.literal);
      return value === undefined ? undefined : item(left.path, value);
    }
    case 'in':
    case 'notIn': {
      if (!('path' in condition.value)) return undefined;
      const set = condition.set.map(scalarOf).filter(value => value !== undefined);
      return set.length === condition.set.length ? item(condition.value.path, set) : undefined;
    }
    case 'exists':
    case 'notExists':
      return item(condition.path, '');
    case 'includes':
    case 'notIncludes':
      return item(condition.path, condition.value);
    case 'matches':
    case 'notMatches':
    case 'hasAllTokens':
      return item(condition.left.path, condition.right.literal);
  }
}

/** The predicate an expression edits; undefined when it holds no condition. Empty groups and related
 *  clauses are left out. Throws on an operator or scope outside the trace predicate. */
export function expressionToTracePredicate(expression: FilterBarExpression): TraceQueryPredicate | undefined {
  const args = expression.nodes.map(predicateOf).filter(arg => arg !== undefined);
  if (args.length <= 1) return args[0];
  return { op: expression.logic, args };
}

function predicateOf(node: FilterBarNode): TraceQueryPredicate | undefined {
  let predicate: TraceQueryPredicate | undefined;
  if (!('kind' in node)) predicate = conditionOf(node);
  else if (node.scope) predicate = relatedClauseOf(node, node.scope);
  else {
    const args = node.nodes.map(predicateOf).filter(arg => arg !== undefined);
    predicate = args.length ? { op: node.logic, args } : undefined;
  }
  return predicate && node.negated ? { op: 'not', arg: predicate } : predicate;
}

function scalarPredicateOf(node: FilterBarNode): TraceQueryScalarPredicate | undefined {
  let predicate: TraceQueryScalarPredicate | undefined;
  if (!('kind' in node)) predicate = conditionOf(node);
  else if (node.scope) throw new Error('A related clause cannot sit inside another related clause');
  else {
    const args = node.nodes.map(scalarPredicateOf).filter(arg => arg !== undefined);
    predicate = args.length ? { op: node.logic, args } : undefined;
  }
  return predicate && node.negated ? { op: 'not', arg: predicate } : predicate;
}

function relatedClauseOf(group: FilterBarGroup, scope: FilterBarGroupScope): RelatedClause | undefined {
  const args = group.nodes.map(scalarPredicateOf).filter(arg => arg !== undefined);
  const [only, ...rest] = args;
  if (!only) return undefined;
  const body: TraceQueryScalarPredicate = rest.length ? { op: group.logic, args } : only;
  let quantified: { some: TraceQueryScalarPredicate } | { none: TraceQueryScalarPredicate };
  if (scope.quantifierId === 'some') quantified = { some: body };
  else if (scope.quantifierId === 'none') quantified = { none: body };
  else throw new Error(`"${scope.quantifierId}" is not a related clause quantifier`);
  switch (scope.id) {
    case 'spans':
      return { spans: quantified };
    case 'scores':
      return { scores: quantified };
    case 'feedback':
      return { feedback: quantified };
    default:
      throw new Error(`"${scope.id}" is not a related collection`);
  }
}

function conditionOf({ fieldId: path, operatorId: op, value }: FilterBarItem): Condition {
  if (!isConditionOp(op)) throw new Error(`"${op}" is not a trace predicate operator`);
  const values = Array.isArray(value) ? value : [value];
  const first = values[0] ?? '';
  switch (op) {
    case 'eq':
    case 'ne':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      return { op, left: { path }, right: { literal: first } };
    case 'in':
    case 'notIn':
      return { op, value: { path }, set: values };
    case 'exists':
    case 'notExists':
      return { op, path };
    case 'includes':
    case 'notIncludes':
      return { op, path, value: String(first) };
    case 'matches':
    case 'notMatches':
      return { op, left: { path }, right: { literal: String(first) } };
    case 'hasAllTokens':
      if (!isTokenSearchField(path)) throw new Error(`"${path}" is not a word search field`);
      return { op, left: { path }, right: { literal: String(first) } };
  }
}

/** `operatorsFor` for a FilterBar editing a trace predicate: word search does not run under a
 *  negation or a `none` clause. Fields that list no operators read as allowing every predicate one. */
export function traceOperatorsFor(field: FilterBarField, place: FilterBarPlace): string[] | undefined {
  if (!place.negated && place.scope?.quantifierId !== 'none') return undefined;
  return (field.operators ?? TRACE_PREDICATE_OPERATOR_IDS).filter(id => id !== 'hasAllTokens');
}
