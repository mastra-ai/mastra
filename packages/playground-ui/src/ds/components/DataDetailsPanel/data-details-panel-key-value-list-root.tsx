import { cn } from '@/lib/utils';

export interface DataDetailsPanelKeyValueListProps {
  className?: string;
  children: React.ReactNode;
}

export function DataDetailsPanelKeyValueListRoot({ className, children }: DataDetailsPanelKeyValueListProps) {
  return <dl className={cn('grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5', className)}>{children}</dl>;
}
