import { ReactNode, useContext } from 'react';

import { cn } from '@/lib/utils';

import { MastraResizablePanel } from '@/domains/resizable-panel';
import { TraceContext } from '@/domains/traces/context/trace-context';
import { TraceDetails } from '@/domains/traces/trace-details';
import { SpanDetail } from '@/domains/traces/trace-span-details';

export interface TracesSidebarProps {
  className?: string;
  onResize?: (width: number) => void;
  width: number;
  children: ReactNode;
}

export const TracesSidebar = ({ className, onResize, width, children }: TracesSidebarProps) => {
  const { openDetail, isOpen: open } = useContext(TraceContext);

  return (
    <MastraResizablePanel
      className={cn(
        'absolute top-0 bottom-0 right-0 h-full z-20 overflow-x-scroll border-l-[0.5px] bg-mastra-bg-1 bg-[#121212]',
        className,
      )}
      defaultWidth={open ? 50 : 30}
      minimumWidth={open ? 50 : 30}
      maximumWidth={open ? 90 : 50}
      setCurrentWidth={onResize}
    >
      {open && (
        <div
          className="h-full overflow-x-scroll px-0 absolute left-0 top-0 min-w-[50%] bg-mastra-bg-1 bg-[#121212]"
          style={{ width: `${width}%` }}
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
      >
        <div className="h-full overflow-y-scroll">{!openDetail ? children : <SpanDetail />}</div>
      </MastraResizablePanel>
    </MastraResizablePanel>
  );
};
