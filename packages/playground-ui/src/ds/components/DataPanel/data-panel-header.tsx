import { cn } from '@/lib/utils';

export interface DataPanelHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DataPanelHeader({ className, children }: DataPanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 mx-4 py-3 min-h-14',
        // Bottom border only when something follows the header (i.e. the panel is expanded).
        // When the panel is collapsed and the header is the only child, the border auto-hides.
        'not-last:border-b not-last:border-border1',
        className,
      )}
    >
      {children}
    </div>
  );
}
