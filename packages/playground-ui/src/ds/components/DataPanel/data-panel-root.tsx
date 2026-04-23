import { cn } from '@/lib/utils';

export interface DataPanelProps {
  collapsed?: boolean;
  children: React.ReactNode;
}

export function DataPanelRoot({ collapsed, children }: DataPanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col bg-surface2 border border-border1 rounded-xl overflow-hidden',
        collapsed ? 'h-auto' : 'max-h-full',
      )}
    >
      {children}
    </section>
  );
}
