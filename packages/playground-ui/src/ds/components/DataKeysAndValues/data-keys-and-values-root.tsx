import { cn } from '@/lib/utils';

export interface DataKeysAndValuesProps {
  className?: string;
  children: React.ReactNode;
  numOfCol?: 1 | 2 | 3;
  density?: 'default' | 'dense';
}

const GRID_TEMPLATES: Record<NonNullable<DataKeysAndValuesProps['numOfCol']>, string> = {
  1: 'auto 1fr',
  2: 'auto auto auto 1fr',
  3: 'auto auto auto auto auto 1fr',
};

const DENSITY_GAP_Y: Record<NonNullable<DataKeysAndValuesProps['density']>, string> = {
  default: 'gap-y-1.5',
  dense: 'gap-y-0',
};

export function DataKeysAndValuesRoot({
  className,
  children,
  numOfCol = 1,
  density = 'default',
}: DataKeysAndValuesProps) {
  return (
    <dl
      className={cn('grid gap-x-4', DENSITY_GAP_Y[density], className)}
      style={{ gridTemplateColumns: GRID_TEMPLATES[numOfCol] }}
    >
      {children}
    </dl>
  );
}
