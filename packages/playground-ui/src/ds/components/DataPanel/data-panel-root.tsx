import { cn } from '@/lib/utils';

export interface DataPanelProps {
  collapsed?: boolean;
  children: React.ReactNode;
}

export function DataPanelRoot({ collapsed, children }: DataPanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-border1 bg-surface2',
        collapsed ? 'h-auto' : 'max-h-full',
      )}
    >
      {children}
    </section>
  );
}
