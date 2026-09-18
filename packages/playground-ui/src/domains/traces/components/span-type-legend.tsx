import { useMemo } from 'react';
import type { UISpan } from '../types';
import { getSpanTypeUi, spanTypePrefixes } from './shared';
import { Badge } from '@/ds/components/Badge';

function useUsedSpanTypes(spans: UISpan[]) {
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

/**
 * Legend of the span types present in `spans`, one small badge per type carrying the
 * type's own color dot. Sits in its own bordered section above the rows. Renders nothing when empty.
 */
export function SpanTypeLegend({ spans }: { spans: UISpan[] }) {
  const usedSpanTypes = useUsedSpanTypes(spans);
  if (usedSpanTypes.length === 0) return null;

  // Bleeds past the panel's `px-2` so the bottom border reaches the container edges.
  return (
    <div data-slot="span-type-legend" className="flex flex-wrap items-center gap-1.5 py-1.5">
      {usedSpanTypes.map(type => {
        const spanUI = getSpanTypeUi(type);
        return (
          <Badge
            key={type}
            size="sm"
            emphasis="muted"
            icon={<span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: spanUI?.color }} />}
          >
            {spanUI?.label || type}
          </Badge>
        );
      })}
    </div>
  );
}
