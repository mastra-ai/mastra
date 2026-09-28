import { cn } from '@/lib/utils';

export interface DataDetailsPanelKeyValueListValueProps {
  className?: string;
  children: React.ReactNode;
}

export function DataDetailsPanelKeyValueListValue({ className, children }: DataDetailsPanelKeyValueListValueProps) {
  return <dd className={cn('min-w-0 truncate py-0.5 text-body-sm text-muted-foreground', className)}>{children}</dd>;
}
