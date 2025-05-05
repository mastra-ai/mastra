import { MastraResizablePanel } from '@/domains/resizable-panel';
import { TraceDetails } from '@/domains/traces/trace-details';
import { SpanDetail } from '@/domains/traces/trace-span-details';

export interface TracesSidebarProps {
  className?: string;
  onResize?: (width: number) => void;
  width: number;
}

export const TracesSidebar = ({ onResize }: TracesSidebarProps) => {
  return (
    <MastraResizablePanel
      className="h-full absolute right-0 inset-y-0 bg-surface2"
      defaultWidth={80}
      minimumWidth={50}
      maximumWidth={80}
      setCurrentWidth={onResize}
    >
      <div className="h-full grid grid-cols-2">
        <div className="overflow-x-scroll w-full h-[calc(100%-40px)]">
          <TraceDetails />
        </div>

        <div className="h-[calc(100%-40px)] overflow-x-scroll w-full border-l border-border1">
          <SpanDetail />
        </div>
      </div>
    </MastraResizablePanel>
  );
};
