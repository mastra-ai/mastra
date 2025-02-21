import { Braces } from 'lucide-react';
import { MouseEvent as ReactMouseEvent, useContext } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { cn } from '@/lib/utils';

import { useResizeColumn } from '@/hooks/use-resize-column';
import { useTraces } from '@/hooks/use-traces';

import { Traces } from '../traces';
import { TraceContext } from '../traces/context/trace-context';
import { TraceDetails } from '../traces/trace-details';
import { SpanDetail } from '../traces/trace-span-details';

import { WorkflowInformation } from './workflow-information';

export function WorkflowTraces({ workflowId, workflowName }: { workflowId: string; workflowName: string }) {
  const { traces, error, firstCallLoading } = useTraces(workflowName, true);
  const { isOpen: open } = useContext(TraceContext);

  const { sidebarWidth, isDragging, handleMouseDown, containerRef } = useResizeColumn({
    defaultWidth: 60,
    minimumWidth: 50,
    maximumWidth: 90,
  });

  if (firstCallLoading) {
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
        <SidebarItems workflowId={workflowId} />
      </main>
    );
  }

  if (!traces || traces.length === 0) {
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
                  {error?.message || 'No traces found'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <SidebarItems workflowId={workflowId} />
      </main>
    );
  }

  return (
    <main className="flex-1 relative overflow-hidden" ref={containerRef}>
      <Traces traces={traces} />
      <SidebarItems
        workflowId={workflowId}
        sidebarWidth={sidebarWidth}
        className={cn(open ? 'grid grid-cols-2 w-[60%]' : '')}
        isDragging={isDragging}
        handleMouseDown={handleMouseDown}
      />
    </main>
  );
}

export function SidebarItems({
  workflowId,
  className,
  sidebarWidth,
  isDragging,
  handleMouseDown,
}: {
  workflowId: string;
  className?: string;
  sidebarWidth?: number;
  handleMouseDown?: (e: ReactMouseEvent) => void;
  isDragging?: boolean;
}) {
  const { openDetail, isOpen: open } = useContext(TraceContext);
  const {
    sidebarWidth: rightSidebarWidth,
    isDragging: innerIsDragging,
    handleMouseDown: handleInnerMouseDown,
    containerRef: innerContainerRef,
  } = useResizeColumn({
    defaultWidth: 50,
    minimumWidth: 30,
    maximumWidth: 80,
  });

  return (
    <aside
      className={cn(
        'absolute right-0 top-0 h-full w-[400px] z-20 overflow-x-scroll border-l-[0.5px] bg-mastra-bg-1',
        className,
      )}
      style={{ width: open ? `${sidebarWidth}%` : undefined }}
      ref={innerContainerRef}
    >
      {open ? (
        <div
          className={`w-1 bg-mastra-border-1 cursor-col-resize hover:w-2 hover:bg-mastra-border-2 active:bg-mastra-border-3 transition-colors absolute inset-y-0 -left-1 -right-1 z-10
          ${isDragging ? 'bg-mastra-border-2 w-2 cursor-col-resize' : ''}`}
          onMouseDown={handleMouseDown}
        />
      ) : null}
      {open && (
        <div
          className="h-full overflow-x-scroll px-0 absolute left-0 top-0 min-w-[50%]"
          style={{ width: `${100 - rightSidebarWidth}%` }}
        >
          <TraceDetails />
        </div>
      )}
      <div
        className="h-full overflow-y-scroll border-l-[0.5px] absolute right-0 top-0 z-20 bg-mastra-bg-1"
        style={{ width: `${openDetail ? rightSidebarWidth : 100}%` }}
      >
        {openDetail ? (
          <div
            className={`w-1 h-full bg-mastra-border-1 cursor-col-resize hover:w-2 hover:bg-mastra-border-2 active:bg-mastra-border-3 transition-colors absolute inset-y-0 -left-1 -right-1 z-10
            ${innerIsDragging ? 'bg-mastra-border-2 w-2 cursor-col-resize' : ''}`}
            onMouseDown={handleInnerMouseDown}
          />
        ) : null}
        {!openDetail ? <WorkflowInformation workflowId={workflowId} /> : <SpanDetail />}
      </div>
    </aside>
  );
}
