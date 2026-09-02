import { cn } from '@/lib/utils';

export interface DataPanelProps {
  collapsed?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function DataPanelRoot({ collapsed, children, className }: DataPanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-gray-alpha-3 bg-background-2',
        collapsed ? 'h-auto' : 'max-h-full',
        className,
      )}
    >
      {children}
    </section>
  );
}
