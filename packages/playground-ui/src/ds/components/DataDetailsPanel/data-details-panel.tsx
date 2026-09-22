import { cn } from '@/lib/utils';

export interface DataDetailsPanelProps {
  collapsed?: boolean;
  children: React.ReactNode;
}

export function DataDetailsPanel({ collapsed, children }: DataDetailsPanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-border bg-background',
        collapsed ? 'h-auto' : 'h-full',
      )}
    >
      {children}
    </section>
  );
}
