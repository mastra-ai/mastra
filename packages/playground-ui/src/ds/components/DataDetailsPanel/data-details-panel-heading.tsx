import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface DataDetailsPanelHeadingProps {
  className?: string;
  children: React.ReactNode;
}

export function DataDetailsPanelHeading({ className, children }: DataDetailsPanelHeadingProps) {
  return (
    <Txt as="h3" tone="muted" className={cn('flex gap-2 [&>b]:text-caption [&>b]:text-placeholder', className)}>
      {children}
    </Txt>
  );
}
