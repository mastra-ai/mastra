import { Braces } from 'lucide-react';
import { ReactNode, useContext, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { cn } from '@/lib/utils';

import { MastraResizablePanel } from '@/domains/resizable-panel';
import { Traces } from '@/domains/traces';
import { TraceContext, TraceProvider } from '@/domains/traces/context/trace-context';
import { TraceDetails } from '@/domains/traces/trace-details';
import { SpanDetail } from '@/domains/traces/trace-span-details';
import { useTraces } from '@/hooks/use-traces';

export function AgentTraces({
  agentName,
  baseUrl,
  sidebarChild,
}: {
  agentName: string;
  baseUrl: string;
  sidebarChild: ReactNode;
}) {
  return (
    <TraceProvider>
      <AgentTracesInner agentName={agentName} baseUrl={baseUrl} sidebarChild={sidebarChild} />
    </TraceProvider>
  );
}
function AgentTracesInner({
  agentName,
  baseUrl,
  sidebarChild,
}: {
  agentName: string;
  baseUrl: string;
  sidebarChild: ReactNode;
}) {
  const { traces, error, firstCallLoading } = useTraces(agentName, baseUrl);
  const { isOpen: open } = useContext(TraceContext);

  if (firstCallLoading) {
    return (
      <main className="flex-1 relative overflow-hidden h-full">
        <div className="h-full w-[calc(100%_-_400px)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-[#0F0F0F]">
              <TableRow className="border-gray-6 border-b-[0.1px] text-[0.8125rem]">
                <TableHead className="text-mastra-el-3 h-10">Trace</TableHead>
                <TableHead className="text-mastra-el-3 flex items-center gap-1 h-10">
                  <Braces className="h-3 w-3" /> Trace Id
                </TableHead>
                <TableHead className="text-mastra-el-3 h-10">Started</TableHead>
                <TableHead className="text-mastra-el-3 h-10">Total Duration</TableHead>
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
        </div>
        <SidebarItems sidebarChild={sidebarChild} className="min-w-[400px]" />
      </main>
    );
  }

  if (!traces || traces.length === 0) {
    return (
      <main className="flex-1 h-full relative overflow-hidden">
        <div className="h-full w-[calc(100%_-_400px)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-[#0F0F0F]">
              <TableRow className="border-gray-6 border-b-[0.1px] text-[0.8125rem]">
                <TableHead className="text-mastra-el-3 h-10">Trace</TableHead>
                <TableHead className="text-mastra-el-3 flex items-center gap-1 h-10">
                  <Braces className="h-3 w-3" /> Trace Id
                </TableHead>
                <TableHead className="text-mastra-el-3 h-10">Started</TableHead>
                <TableHead className="text-mastra-el-3 h-10">Total Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="border-b border-gray-6">
              <TableRow className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
                <TableCell colSpan={4} className="h-24 text-center">
                  {error?.message || 'No traces found'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <SidebarItems sidebarChild={sidebarChild} className="min-w-[400px]" />
      </main>
    );
  }

  return (
    <main className="flex-1 h-full relative overflow-hidden">
      <Traces traces={traces} />
      <SidebarItems sidebarChild={sidebarChild} className={cn(open ? 'grid grid-cols-2 w-[60%]' : 'min-w-[400px]')} />
    </main>
  );
}

function SidebarItems({ sidebarChild, className }: { sidebarChild: ReactNode; className?: string }) {
  const { openDetail, isOpen: open } = useContext(TraceContext);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(40);

  return (
    <MastraResizablePanel
      className={cn(
        'absolute right-0 top-0 h-full z-20 overflow-x-scroll border-l-[0.5px] bg-mastra-bg-1 bg-[#121212]',
        className,
      )}
      defaultWidth={open ? 60 : 30}
      minimumWidth={open ? 50 : 30}
      maximumWidth={open ? 90 : 50}
    >
      {open && (
        <div
          className="h-full overflow-x-scroll px-0 absolute left-0 top-0 min-w-[50%] bg-mastra-bg-1 bg-[#121212]"
          style={{ width: `${100 - rightSidebarWidth}%` }}
        >
          <TraceDetails />
        </div>
      )}
      <MastraResizablePanel
        defaultWidth={50}
        minimumWidth={30}
        maximumWidth={80}
        className={cn('h-full overflow-y-hidden border-l-[0.5px] right-0 top-0 z-20 bg-mastra-bg-1 bg-[#121212]', {
          absolute: open,
          'unset-position': !open,
        })}
        disabled={!open}
        setCurrentWidth={setRightSidebarWidth}
      >
        <div className="h-full overflow-y-scroll">{!openDetail ? sidebarChild : <SpanDetail />}</div>
      </MastraResizablePanel>
    </MastraResizablePanel>
  );
}
