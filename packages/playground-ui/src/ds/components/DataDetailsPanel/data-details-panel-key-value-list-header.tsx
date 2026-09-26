import { cn } from '@/lib/utils';

export interface DataDetailsPanelKeyValueListHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DataDetailsPanelKeyValueListHeader({ className, children }: DataDetailsPanelKeyValueListHeaderProps) {
  return <dt className={cn('col-span-2 py-3 text-column text-placeholder uppercase', className)}>{children}</dt>;
}
