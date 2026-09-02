import { cn } from '@/lib/utils';

export interface DataDetailsPanelProps {
  collapsed?: boolean;
  children: React.ReactNode;
}

export function DataDetailsPanel({ collapsed, children }: DataDetailsPanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-gray-alpha-3 bg-background-2',
        collapsed ? 'h-auto' : 'h-full',
      )}
    >
      {children}
    </section>
  );
}
