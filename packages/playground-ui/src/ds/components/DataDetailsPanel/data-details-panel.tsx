import { cn } from '@/lib/utils';

export interface DataDetailsPanelProps {
  collapsed?: boolean;
  children: React.ReactNode;
}

export function DataDetailsPanel({ collapsed, children }: DataDetailsPanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col bg-surface2 border border-border1 rounded-xl overflow-hidden',
        collapsed ? 'h-auto' : 'h-full',
      )}
    >
      {children}
    </section>
  );
}
