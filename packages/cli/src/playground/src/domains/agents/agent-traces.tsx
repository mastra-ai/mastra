import { Braces } from 'lucide-react';
import { useContext } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { cn } from '@/lib/utils';

import { useTraces } from '@/hooks/use-traces';

import { Traces } from '../traces';
import { TraceContext } from '../traces/context/trace-context';
import { TraceDetails } from '../traces/trace-details';
import { SpanDetail } from '../traces/trace-span-details';
import { Span } from '../traces/types';

import { AgentInformation } from './agent-information';

export function AgentTraces({ agentId, agentName }: { agentId: string; agentName: string }) {
  const { traces, isLoading } = useTraces(agentName);

  if (isLoading) {
    return (
      <main className="flex-1 relative overflow-hidden">
        <div className="h-full w-[calc(100%_-_400px)]">
          <ScrollArea className="rounded-lg h-full">
            <Table>
              <TableHeader className="bg-[#171717] sticky top-0 z-10">
                <TableRow className="border-gray-6 border-b-[0.1px] text-[0.8125rem]">
                  <TableHead className="text-mastra-el-3">Trace</TableHead>
                  <TableHead className="text-mastra-el-3 flex items-center gap-1">
                    <Braces className="h-3 w-3" /> Trace Id
                  </TableHead>
                  <TableHead className="text-mastra-el-3">Started</TableHead>
                  <TableHead className="text-mastra-el-3">Total Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="border-b border-gray-6">
                <TableRow className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
                  <TableCell>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        <SidebarItems agentId={agentId} />
      </main>
    );
  }

  if (!traces) {
    return (
      <main className="flex-1 relative overflow-hidden">
        <div className="h-full w-[calc(100%_-_400px)]">
          <Table>
            <TableHeader className="bg-[#171717] sticky top-0 z-10">
              <TableRow className="border-gray-6 border-b-[0.1px] text-[0.8125rem]">
                <TableHead className="text-mastra-el-3">Trace</TableHead>
                <TableHead className="text-mastra-el-3 flex items-center gap-1">
                  <Braces className="h-3 w-3" /> Trace Id
                </TableHead>
                <TableHead className="text-mastra-el-3">Started</TableHead>
                <TableHead className="text-mastra-el-3">Total Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="border-b border-gray-6">
              <TableRow className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
                <TableCell colSpan={4} className="h-24 text-center">
                  No traces found
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <SidebarItems agentId={agentId} />
      </main>
    );
  }

  const groupedTraces = traces.reduce<Record<string, Span[]>>((acc, curr) => {
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
