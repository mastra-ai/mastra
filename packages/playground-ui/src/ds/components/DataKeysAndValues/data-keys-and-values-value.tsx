import { dataKeysAndValuesValueStyles } from './shared';
import { cn } from '@/lib/utils';

export interface DataKeysAndValuesValueProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function DataKeysAndValuesValue({ className, style, children }: DataKeysAndValuesValueProps) {
  return (
    <dd className={cn(dataKeysAndValuesValueStyles, 'truncate', className)} style={style}>
      {children}
    </dd>
  );
}
