import { useMemo } from 'react';
import type { UISpan } from '../types';
import { getSpanTypeUi, spanTypePrefixes } from './shared';

export function useUsedSpanTypes(spans: UISpan[]) {
  return useMemo(() => {
    const collectTypes = (list: UISpan[]): Set<string> => {
      const types = new Set<string>();
      for (const span of list) {
        const prefix = span.type?.toLowerCase().split('_')[0];
        if (prefix) types.add(prefix);
        if (span.spans) {
          for (const t of collectTypes(span.spans)) types.add(t);
        }
      }
      return types;
    };
    const types = collectTypes(spans);
    const hasOther = [...types].some(t => !spanTypePrefixes.includes(t));
    const known = spanTypePrefixes.filter(p => p !== 'other' && types.has(p));
    if (hasOther) known.push('other');
    return known;
  }, [spans]);
}

/** Colored-dot legend of the span types present in `spans`. Renders nothing when empty. */
export function SpanTypeLegend({ spans }: { spans: UISpan[] }) {
  const usedSpanTypes = useUsedSpanTypes(spans);
  if (usedSpanTypes.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-start gap-3 px-2 py-1.5">
      {usedSpanTypes.map(type => {
        const spanUI = getSpanTypeUi(type);
        return (
          <div key={type} className="text-ui-sm text-neutral3 flex shrink-0 items-center gap-1">
            <span className="inline-block size-1.5 shrink-0 rounded-full" style={{ backgroundColor: spanUI?.color }} />
            {spanUI?.label || type}
          </div>
        );
      })}
    </div>
  );
}
