import { useContext } from 'react';

import { cn } from '@/lib/utils';

import { Traces } from '../traces';
import { TraceContext } from '../traces/context/trace-context';
import { traces_mock_data } from '../traces/mock-data';
import { TraceDetails } from '../traces/trace-details';
import { SpanDetail } from '../traces/trace-span-details';
import { Span } from '../traces/types';

import { AgentInformation } from './agent-information';

export function AgentTraces({ agentId }: { agentId: string }) {
  const groupedTraces = (traces_mock_data.traces as unknown as Span[]).reduce<Record<string, Span[]>>((acc, curr) => {
    const newCurr = { ...curr, duration: Number(curr.endTime) - Number(curr.startTime) };

    return { ...acc, [curr.traceId]: [...(acc[curr.traceId] || []), newCurr] };
  }, {});

  const tracesData = Object.entries(groupedTraces).map(([key, value]) => {
    const parentSpan = value.find(span => !span.parentSpanId);

    const enrichedSpans = value.map(span => ({
      ...span,
      relativePercentage: parentSpan ? span.duration / parentSpan.duration : 0,
    }));
    return {
      traceId: key,
      serviceName: parentSpan?.name || key,
      duration: value.reduce((acc, curr) => acc + curr.duration, 0),
      started: Number(value[0].startTime),
      trace: enrichedSpans,
    };
  });

  return (
    <main className="flex-1 relative overflow-hidden">
      <Traces traces={tracesData} />
      <SidebarItems agentId={agentId} />
    </main>
  );
}

export function SidebarItems({ agentId }: { agentId: string }) {
  const { openDetail, isOpen: open } = useContext(TraceContext);
  return (
    <aside
      className={cn(
        'absolute right-0 top-0 h-full w-[400px] z-20 overflow-x-scroll border-l-[0.5px] bg-mastra-bg-1',
        open ? 'grid w-[60%] grid-cols-2' : '',
      )}
    >
      {open && (
        <div className="h-full w-full overflow-x-scroll px-0">
          <TraceDetails />
        </div>
      )}
      <div className="h-full w-full overflow-y-scroll border-l-[0.5px]">
        {!openDetail ? <AgentInformation agentId={agentId} /> : <SpanDetail />}
      </div>
    </aside>
  );
}
