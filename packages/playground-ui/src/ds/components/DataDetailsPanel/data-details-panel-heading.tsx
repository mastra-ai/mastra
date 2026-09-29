import { cn } from '@/lib/utils';

export interface DataDetailsPanelHeadingProps {
  className?: string;
  children: React.ReactNode;
}

export function DataDetailsPanelHeading({ className, children }: DataDetailsPanelHeadingProps) {
  return (
    <h3
      className={cn('flex gap-2 text-body text-muted-foreground [&>b]:text-caption [&>b]:text-placeholder', className)}
    >
      {children}
    </h3>
  );
}
