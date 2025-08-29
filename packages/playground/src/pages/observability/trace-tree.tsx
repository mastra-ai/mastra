import { cn } from '@/lib/utils';
import { TraceTreeSpan } from './trace-tree-span';
import { UISpan } from '@mastra/playground-ui';

type TraceTreeProps = {
  spans?: UISpan[];
  onSpanClick: (span: UISpan) => void;
  selectedSpanId?: string;
  overallLatency: number;
  overallStartTime: string;
};

export function TraceTree({
  spans = [],
  onSpanClick,
  selectedSpanId,
  overallLatency,
  overallStartTime,
}: TraceTreeProps) {
  return (
    <div
      className={cn(
        'overflow-y-auto pr-[1.5rem] grid items-start content-start gap-y-[2px] xl:py-[1.5rem] ',
        'xl:grid-cols-[3fr_2fr] xl:gap-x-[1rem]',
        //    'border border-red-500',
      )}
    >
      {spans?.map((span: UISpan) => (
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
  );
}
