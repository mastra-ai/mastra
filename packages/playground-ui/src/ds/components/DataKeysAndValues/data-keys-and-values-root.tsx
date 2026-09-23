import { cn } from '@/lib/utils';

export interface DataKeysAndValuesProps {
  className?: string;
  children: React.ReactNode;
  density?: 'default' | 'dense';
}

const DENSITY_GAP_Y: Record<NonNullable<DataKeysAndValuesProps['density']>, string> = {
  default: 'gap-y-1.5',
  dense: 'gap-y-0',
};

export function DataKeysAndValuesRoot({ className, children, density = 'default' }: DataKeysAndValuesProps) {
  return <dl className={cn('grid grid-cols-[auto_1fr] gap-x-4', DENSITY_GAP_Y[density], className)}>{children}</dl>;
}
