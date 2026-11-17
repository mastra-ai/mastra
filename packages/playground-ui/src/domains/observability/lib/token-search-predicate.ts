import type { TraceQueryPredicate, TraceQueryScalarPredicate, TraceQueryTokenField } from '@mastra/core/storage';
import type { FilterBarField } from '@/ds/components/FilterBar/types';
import { IconExclamationTriangle } from '@/ds/icons/central/IconExclamationTriangle';
import { IconMagnifyingGlass } from '@/ds/icons/central/IconMagnifyingGlass';

const TOKEN_FIELDS = [
  ['all', 'Any Content'],
  ['input', 'Input'],
  ['output', 'Output'],
  ['error', 'Error'],
  ['inputPreview', 'Input Preview'],
  ['outputPreview', 'Output Preview'],
  ['errorPreview', 'Error Preview'],
] as const satisfies ReadonlyArray<readonly [TraceQueryTokenField, string]>;

export const isTokenSearchField = (path: string): path is TraceQueryTokenField =>
  TOKEN_FIELDS.some(([field]) => field === path);

export function tokenSearchValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  // splitByNonAlpha keeps non-ASCII sequences, including symbols, as tokens.
  if (!/[a-zA-Z0-9\u0080-\uFFFF]/.test(text) || Array.from(text).length > 256) return undefined;
  return text || undefined;
}

export function tokenSearchPredicate(path: string, value: unknown): TraceQueryScalarPredicate | undefined {
  const literal = tokenSearchValue(value);
  return isTokenSearchField(path) && literal ? { op: 'hasAllTokens', left: { path }, right: { literal } } : undefined;
}

export function withTokenSearchFields(fields: FilterBarField[], enabled: boolean, prefix = ''): FilterBarField[] {
  if (!enabled) return fields;
  const searchable = TOKEN_FIELDS.map(([path, label]): FilterBarField => {
    const existing = fields.find(field => field.id === prefix + path);
    return {
      ...existing,
      id: prefix + path,
      label,
      icon:
        path === 'error' || path === 'errorPreview' ? IconExclamationTriangle : (existing?.icon ?? IconMagnifyingGlass),
      operators: ['hasAllTokens', ...(existing?.operators ?? [])],
      alwaysShowOperator: true,
      validateInput: value => (tokenSearchValue(value) ? undefined : 'Enter words to search (up to 256 characters)'),
    };
  });
  return [...searchable, ...fields.filter(field => !searchable.some(search => search.id === field.id))];
}

export function hasTokenSearch(predicate: TraceQueryPredicate | undefined): boolean {
  if (!predicate) return false;
  if ('op' in predicate) {
    if (predicate.op === 'hasAllTokens') return true;
    if (predicate.op === 'and' || predicate.op === 'or') return predicate.args.some(hasTokenSearch);
    if (predicate.op === 'not') return hasTokenSearch(predicate.arg);
    return false;
  }
  const relation =
    'spans' in predicate ? predicate.spans : 'scores' in predicate ? predicate.scores : predicate.feedback;
  return hasTokenSearch('some' in relation ? relation.some : relation.none);
}
