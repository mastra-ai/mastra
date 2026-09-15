import { cn } from '@/lib/utils';

export interface DataDetailsPanelHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DataDetailsPanelHeader({ className, children }: DataDetailsPanelHeaderProps) {
  return (
    <div className={cn('mx-4 flex items-center justify-between gap-2 border-b border-border1 py-3', className)}>
      {children}
    </div>
  );
}
