import { Braces, Clock1 } from 'lucide-react';
import { useContext, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { TraceContext } from './context/trace-context';
import { RefinedTrace, Span } from './types';
import { formatDuration, formatOtelTimestamp } from './utils';

export function Traces({ traces }: { traces: RefinedTrace[] }) {
  const isLoading = false;

  const { setTraces } = useContext(TraceContext);

  useEffect(() => {
    setTraces(traces);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traces]);

  return (
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
            {isLoading ? (
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
            ) : (
              traces.map(trace => (
                <TableRow key={trace.traceId} className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
                  <TableCell>
                    <TraceButton trace={trace.trace} name={trace.serviceName} />
                  </TableCell>
                  <TableCell className="text-mastra-el-5">{trace.traceId}</TableCell>
                  <TableCell className="text-mastra-el-5 text-sm">{formatOtelTimestamp(trace.started)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 text-[#F1CA5E]">
                      <Clock1 className="h-3 w-3" />
                      {formatDuration(trace.duration, 3)}s
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function TraceButton({ trace, name }: { trace: Span[]; name: string }) {
  const {
    setTrace,
    isOpen: open,
    setIsOpen: setOpen,
    trace: currentTrace,
    setSpan,
    setOpenDetail,
  } = useContext(TraceContext);
  return (
    <Button
      variant="ghost"
      className="flex h-0 items-center gap-2 p-0"
      onClick={() => {
        setTrace(trace);
        const parentSpan = trace.find(span => span.parentSpanId === undefined) || trace[0];
        setSpan(parentSpan);
        if (open && currentTrace?.[0]?.id !== trace[0].id) return;
        setOpen(prev => !prev);
        setOpenDetail(prev => !prev);
      }}
    >
      <svg
        className="h-3 w-3"
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="12"
        viewBox="0 0 13 12"
        fill="none"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M6.37695 12C9.69067 12 12.377 9.31371 12.377 6C12.377 2.68629 9.69067 0 6.37695 0C3.06325 0 0.376953 2.68629 0.376953 6C0.376953 9.31371 3.06325 12 6.37695 12ZM9.62004 4.65344C9.87907 4.36036 9.8651 3.90005 9.58884 3.6253C9.3125 3.35055 8.87861 3.3654 8.61958 3.65847L5.6477 7.02105L4.08967 5.55197C3.80661 5.28508 3.37319 5.31213 3.12159 5.61237C2.87 5.91262 2.89549 6.37239 3.17854 6.63927L4.90294 8.26517C5.36588 8.70171 6.07235 8.6676 6.49598 8.18829L9.62004 4.65344Z"
          fill="#6CD063"
        />
      </svg>
      {name}
    </Button>
  );
}
