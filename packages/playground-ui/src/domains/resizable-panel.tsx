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
  dividerPosition = 'left',
}: {
  children: ReactNode;
  defaultWidth: number;
  minimumWidth: number;
  maximumWidth: number;
  className?: string;
  disabled?: boolean;
  setCurrentWidth?: (width: number) => void;
  dividerPosition?: 'left' | 'right';
}) => {
  const { sidebarWidth, isDragging, handleMouseDown, containerRef } = useResizeColumn({
    defaultWidth: disabled ? 100 : defaultWidth,
    minimumWidth,
    maximumWidth,
    setCurrentWidth,
  });
  return (
    <div className={cn('w-full h-full relative', className)} ref={containerRef} style={{ width: `${sidebarWidth}%` }}>
      {!disabled && dividerPosition === 'left' ? (
        <div
          className={`w-px bg-border1 h-full cursor-col-resize hover:w-1.5 hover:bg-mastra-border-2 hover:bg-[#424242] active:bg-mastra-border-3 active:bg-[#3e3e3e] transition-colors absolute inset-y-0 z-10
          ${isDragging ? 'bg-border2 w-1.5 cursor- col-resize' : ''}`}
          onMouseDown={handleMouseDown}
        />
      ) : null}
      {children}
      {!disabled && dividerPosition === 'right' ? (
        <div
          className={`w-px bg-border1 h-full cursor-col-resize hover:w-1.5 hover:bg-border2 active:bg-border3 transition-colors absolute inset-y-0 z-10
          ${isDragging ? 'bg-border2 w-1.5 cursor- col-resize' : ''}`}
          onMouseDown={handleMouseDown}
        />
      ) : null}
    </div>
  );
};
