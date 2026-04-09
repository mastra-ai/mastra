import { cn } from '@/lib/utils';

export interface DataKeysAndValuesValueProps {
  className?: string;
  children: React.ReactNode;
}

export function DataKeysAndValuesValue({ className, children }: DataKeysAndValuesValueProps) {
  return <dd className={cn('text-ui-smd text-neutral3 truncate min-w-0 py-0.5', className)}>{children}</dd>;
}
