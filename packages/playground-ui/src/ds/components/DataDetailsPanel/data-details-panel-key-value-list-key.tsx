import { cn } from '@/lib/utils';

export interface DataDetailsPanelKeyValueListKeyProps {
  className?: string;
  children: React.ReactNode;
}

export function DataDetailsPanelKeyValueListKey({ className, children }: DataDetailsPanelKeyValueListKeyProps) {
  return <dt className={cn('shrink-0 py-0.5 text-body-sm text-placeholder', className)}>{children}</dt>;
}
