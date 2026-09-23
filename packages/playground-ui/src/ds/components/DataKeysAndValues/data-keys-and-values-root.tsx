import { cn } from '@/lib/utils';

export interface DataKeysAndValuesProps {
  className?: string;
  children: React.ReactNode;
  numOfCol?: 1 | 2 | 3;
  density?: 'default' | 'dense';
}

const GRID_COLUMNS: Record<NonNullable<DataKeysAndValuesProps['numOfCol']>, string> = {
  1: 'grid-cols-[auto_1fr]',
  2: 'grid-cols-[auto_1fr] @md:grid-cols-[auto_auto_auto_1fr]',
  3: 'grid-cols-[auto_1fr] @md:grid-cols-[auto_auto_auto_1fr] @xl:grid-cols-[auto_auto_auto_auto_auto_1fr]',
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
  const list = (
    <dl className={cn('grid gap-x-4', GRID_COLUMNS[numOfCol], DENSITY_GAP_Y[density], className)}>{children}</dl>
  );

  // @container sizes from its parent, so it would collapse a single column inside a fit-content hover card.
  if (numOfCol === 1) return list;

  return <div className="@container">{list}</div>;
}
