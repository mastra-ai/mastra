import { Braces } from 'lucide-react';
import { MouseEvent as ReactMouseEvent, ReactNode, useContext, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { cn } from '@/lib/utils';

import { Traces } from '@/domains/traces';
import { TraceContext, TraceProvider } from '@/domains/traces/context/trace-context';
import { TraceDetails } from '@/domains/traces/trace-details';
import { SpanDetail } from '@/domains/traces/trace-span-details';
import { useResizeColumn } from '@/hooks/use-resize-column';
import { useTraces } from '@/hooks/use-traces';
import { MastraResizablePanel } from '@/domains/resizable-panel';

export function WorkflowTraces({
  workflowName,
  baseUrl,
  sidebarChild,
}: {
  workflowName: string;
  baseUrl: string;
  sidebarChild: ReactNode;
}) {
  return (
    <TraceProvider>
      <WorkflowTracesInner workflowName={workflowName} baseUrl={baseUrl} sidebarChild={sidebarChild} />
    </TraceProvider>
  );
}

function WorkflowTracesInner({
  workflowName,
  baseUrl,
  sidebarChild,
}: {
  workflowName: string;
  baseUrl: string;
  sidebarChild: ReactNode;
}) {
  const { traces, error, firstCallLoading } = useTraces(workflowName, baseUrl, true);
  const { isOpen: open } = useContext(TraceContext);

  // const { sidebarWidth, isDragging, handleMouseDown, containerRef } = useResizeColumn({
  //   defaultWidth: 60,
  //   minimumWidth: 50,
  //   maximumWidth: 90,
  // });

  if (firstCallLoading) {
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
        <SidebarItems sidebarChild={sidebarChild} />
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
        <SidebarItems sidebarChild={sidebarChild} />
      </main>
    );
  }

  return (
    <main className="flex-1 h-full relative overflow-hidden">
      <Traces traces={traces} />
      <SidebarItems
        // sidebarWidth={sidebarWidth}
        className={cn(open ? 'grid grid-cols-2 w-[60%]' : 'min-w-[400px]')}
        // isDragging={isDragging}
        // handleMouseDown={handleMouseDown}
        sidebarChild={sidebarChild}
      />
    </main>
  );
}

function SidebarItems({
  sidebarChild,
  className,
  sidebarWidth,
  isDragging,
  handleMouseDown,
}: {
  sidebarChild: ReactNode;
  className?: string;
  sidebarWidth?: number;
  handleMouseDown?: (e: ReactMouseEvent) => void;
  isDragging?: boolean;
}) {
  const { openDetail, isOpen: open } = useContext(TraceContext);
  // const {
  //   sidebarWidth: rightSidebarWidth,
  //   isDragging: innerIsDragging,
  //   handleMouseDown: handleInnerMouseDown,
  //   containerRef: innerContainerRef,
  // } = useResizeColumn({
  //   defaultWidth: 50,
  //   minimumWidth: 30,
  //   maximumWidth: 80,
  // });
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
      // style={{ width: open ? `${sidebarWidth}%` : undefined }}
      // ref={innerContainerRef}
    >
      {/* {open ? (
        <div
          className={`w-1 bg-mastra-bg-1 bg-[#121212] h-full cursor-col-resize hover:w-2 hover:bg-mastra-border-2 hover:bg-[#424242] active:bg-mastra-border-3 active:bg-[#3e3e3e] transition-colors absolute inset-y-0 -left-1 -right-1 z-10
          ${isDragging ? 'bg-mastra-border-2 bg-[#424242] w-2 cursor-col-resize' : ''}`}
          onMouseDown={handleMouseDown}
        />
      ) : null} */}
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
        // style={{ width: `${openDetail ? rightSidebarWidth : 100}%` }}
      >
        {/* {openDetail ? (
          <div
            className={`w-1 h-full bg-mastra-bg-1 bg-[#121212] cursor-col-resize hover:w-2 hover:bg-mastra-border-2 hover:bg-[#424242] active:bg-mastra-border-3 active:bg-[#3e3e3e] transition-colors absolute inset-y-0 -left-1 -right-1 z-10
            ${innerIsDragging ? 'bg-mastra-border-2 bg-[#424242] w-2 cursor-col-resize' : ''}`}
            onMouseDown={handleInnerMouseDown}
          />
        ) : null} */}
        <div className="h-full overflow-y-scroll">{!openDetail ? sidebarChild : <SpanDetail />}</div>
      </MastraResizablePanel>
    </MastraResizablePanel>
  );
}
