import { useResizeColumn } from '@/hooks/use-resize-column';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export const MastraResizablePanel = ({
  children,
  defaultWidth,
  minimumWidth,
  maximumWidth,
  className,
  disabled = false,
  setCurrentWidth,
}: {
  children: ReactNode;
  defaultWidth: number;
  minimumWidth: number;
  maximumWidth: number;
  className?: string;
  disabled?: boolean;
  setCurrentWidth?: (width: number) => void;
}) => {
  const { sidebarWidth, isDragging, handleMouseDown, containerRef } = useResizeColumn({
    defaultWidth: disabled ? 100 : defaultWidth,
    minimumWidth,
    maximumWidth,
    setCurrentWidth,
  });
  return (
    <div className={cn('w-full h-full relative', className)} ref={containerRef} style={{ width: `${sidebarWidth}%` }}>
      {disabled ? null : (
        <div
          className={`w-1 bg-mastra-bg-1 bg-[#121212] h-full cursor-col-resize hover:w-1.5 hover:bg-mastra-border-2 hover:bg-[#424242] active:bg-mastra-border-3 active:bg-[#3e3e3e] transition-colors absolute inset-y-0 -left-1 -right-1 z-10
          ${isDragging ? 'bg-mastra-border-2 bg-[#424242] w-1.5 cursor- col-resize' : ''}`}
          onMouseDown={handleMouseDown}
        />
      )}
      {children}
    </div>
  );
};
