import { cn } from '@/lib/utils';
import { spanTypePrefixes, getSpanTypeUi } from './shared';

type TraceTreeLegendProps = {
  spans?: any[];
};

export function TraceTreeLegend({ spans = [] }: TraceTreeLegendProps) {
  const activeSpanTypes = spanTypePrefixes.filter(typePrefix =>
    spans.some(span => span?.spanType?.startsWith(typePrefix)),
  );

  return (
    <div className={cn('flex justify-start gap-[2rem] mb-2 text-[0.75rem] opacity-90')}>
      {activeSpanTypes.map(item => {
        const spanUI = getSpanTypeUi(item);

        return (
          <div key={item} className={cn('flex items-center gap-[.5rem]')}>
            <span className={cn('[&>svg]:w-[1.2em] [&>svg]:h-[1.2em]')} style={{ color: spanUI?.color }}>
              {spanUI?.icon}
            </span>
            {spanUI?.label}
          </div>
        );
      })}
    </div>
  );
}
