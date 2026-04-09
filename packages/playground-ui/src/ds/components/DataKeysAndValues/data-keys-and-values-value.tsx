import { dataKeysAndValuesValueStyles } from './shared';
import { cn } from '@/lib/utils';

export interface DataKeysAndValuesValueProps {
  className?: string;
  children: React.ReactNode;
}

export function DataKeysAndValuesValue({ className, children }: DataKeysAndValuesValueProps) {
  return <dd className={cn(dataKeysAndValuesValueStyles, 'truncate', className)}>{children}</dd>;
}
