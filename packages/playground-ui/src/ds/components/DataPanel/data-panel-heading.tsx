import { cn } from '@/lib/utils';

export interface DataPanelHeadingProps {
  className?: string;
  children: React.ReactNode;
}

export function DataPanelHeading({ className, children }: DataPanelHeadingProps) {
  return (
    <h3
      className={cn(
        'flex gap-2 text-ui-md text-(--text-secondary) [&>b]:font-normal [&>b]:text-(--text-secondary)',
        className,
      )}
    >
      {children}
    </h3>
  );
}
