import type { FilterBarOperator } from './types';

/** Opt-in starter set. Pure data: the component attaches no semantics to ids. */
export const DEFAULT_FILTER_OPERATORS: FilterBarOperator[] = [
  { id: 'is', label: 'is' },
  { id: 'is-not', label: 'is not' },
  { id: 'contains', label: 'contains' },
  { id: 'not-contains', label: 'does not contain' },
  { id: 'starts-with', label: 'starts with' },
  { id: 'gt', label: '>' },
  { id: 'lt', label: '<' },
  { id: 'gte', label: '>=' },
  { id: 'lte', label: '<=' },
  { id: 'is-empty', label: 'is empty', arity: 'none' },
  { id: 'is-not-empty', label: 'is not empty', arity: 'none' },
  { id: 'in', label: 'in', arity: 'many' },
];
