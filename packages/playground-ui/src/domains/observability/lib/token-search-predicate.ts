import type { TraceQueryPredicate, TraceQueryScalarPredicate } from '@mastra/core/storage';

export function spanTokenSearch(
  where: TraceQueryScalarPredicate | undefined,
  text: string | undefined,
): TraceQueryScalarPredicate | undefined {
  if (!text) return where;
  const search: TraceQueryScalarPredicate = { op: 'hasAllTokens', left: { path: 'all' }, right: { literal: text } };
  return where ? { op: 'and', args: [where, search] } : search;
}

export function traceTokenSearch(
  where: TraceQueryPredicate | undefined,
  text: string | undefined,
): TraceQueryPredicate | undefined {
  if (!text) return where;
  const search: TraceQueryPredicate = {
    spans: { some: { op: 'hasAllTokens', left: { path: 'all' }, right: { literal: text } } },
  };
  return where ? { op: 'and', args: [where, search] } : search;
}
