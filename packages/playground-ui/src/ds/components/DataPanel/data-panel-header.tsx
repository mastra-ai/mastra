import { cn } from '@/lib/utils';

export interface DataPanelHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DataPanelHeader({ className, children }: DataPanelHeaderProps) {
  return (
    <div
      className={cn('flex items-center justify-between gap-2 border-b border-border1 mx-4 py-3 min-h-14', className)}
    >
      {children}
    </div>
  );
}
