import type { TraceQueryScalarPredicate, TraceQueryTokenField } from '@mastra/core/storage';
import type { TraceFilterNode } from '@/domains/traces/trace-query-filters';
import type { FilterBarField } from '@/ds/components/FilterBar/types';
import { IconExclamationTriangle } from '@/ds/icons/central/IconExclamationTriangle';
import { IconMagnifyingGlass } from '@/ds/icons/central/IconMagnifyingGlass';

// Keep Core's Node-only storage barrel out of browser bundles; the boundary test checks parity.
const TRACE_QUERY_TOKEN_SEARCH_MAX_LENGTH = 256;

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
  // UX heuristic for likely searchable input; the supporting store defines actual tokenization.
  if (!/[a-zA-Z0-9\u0080-\uFFFF]/.test(text) || Array.from(text).length > TRACE_QUERY_TOKEN_SEARCH_MAX_LENGTH)
    return undefined;
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
      label: prefix === 'spans.' ? (path === 'all' ? 'Any span content' : `Span ${label.toLowerCase()}`) : label,
      icon:
        path === 'error' || path === 'errorPreview' ? IconExclamationTriangle : (existing?.icon ?? IconMagnifyingGlass),
      operators: [...(existing?.operators ?? []), 'hasAllTokens'],
      alwaysShowOperator: true,
      validateInput: value =>
        tokenSearchValue(value)
          ? undefined
          : `Enter words to search (up to ${TRACE_QUERY_TOKEN_SEARCH_MAX_LENGTH} characters)`,
    };
  });
  return [...searchable, ...fields.filter(field => !searchable.some(search => search.id === field.id))];
}

export function hasTokenSearchFilter(node: TraceFilterNode): boolean {
  if ('nodes' in node) return node.nodes.some(hasTokenSearchFilter);
  return (
    node.operatorId === 'hasAllTokens' &&
    node.fieldId.startsWith('spans.') &&
    !!tokenSearchPredicate(node.fieldId.slice('spans.'.length), node.value)
  );
}
