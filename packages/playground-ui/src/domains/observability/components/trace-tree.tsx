import { cn } from '@/lib/utils';
import { TraceTreeSpan } from './trace-tree-span';
import { type UISpan } from '../types';
import { formatHierarchicalSpans } from '../utils/format-hierarchical-spans';
import { SideDialogHeading } from '@/components/ui/elements';
import { useMemo } from 'react';
import { ListTreeIcon } from 'lucide-react';
import { TraceTreeLegend } from './trace-tree-legend';

type TraceTreeProps = {
  spans?: any;
  onSpanClick: (span: UISpan) => void;
  selectedSpanId?: string;
};

export function TraceTree({ spans = [], onSpanClick, selectedSpanId }: TraceTreeProps) {
  const hierarchicalSpans = useMemo(() => {
    if (!spans) return [];
    return formatHierarchicalSpans(spans || []);
  }, [spans]);

  const overallLatency = hierarchicalSpans?.[0]?.latency || 0;
  const overallStartTime = hierarchicalSpans?.[0]?.startTime || '';

  return (
    <div className="mt-[3rem] grid gap-[1rem]">
      <div className="flex w-full justify-between pr-[4rem]">
        <SideDialogHeading as="h2">
          <ListTreeIcon /> Timeline
        </SideDialogHeading>
        <TraceTreeLegend spans={spans} />
      </div>
      <div
        className={cn(
          'overflow-y-auto pr-[1.5rem] grid items-start content-start gap-y-[2px] xl:py-[1rem] ',
          'xl:grid-cols-[3fr_2fr] xl:gap-x-[1rem]',
        )}
      >
        {hierarchicalSpans?.map((span: UISpan) => (
          <TraceTreeSpan
            key={span.id}
            span={span}
            onSpanClick={onSpanClick}
            selectedSpanId={selectedSpanId}
            overallLatency={overallLatency}
            overallStartTime={overallStartTime}
          />
        ))}
      </div>
    </div>
  );
}
