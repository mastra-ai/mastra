import { cn } from '@/lib/utils';

export interface DataDetailsPanelHeadingProps {
  className?: string;
  children: React.ReactNode;
}

export function DataDetailsPanelHeading({ className, children }: DataDetailsPanelHeadingProps) {
  return (
    <h3 className={cn('flex gap-2 text-ui-md text-neutral3 [&>b]:text-neutral2 [&>b]:font-normal', className)}>
      {children}
    </h3>
  );
}
