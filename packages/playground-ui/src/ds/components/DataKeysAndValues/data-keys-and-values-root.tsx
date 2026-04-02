import { cn } from '@/lib/utils';

const numOfColStyles = {
  1: 'grid-cols-[auto_1fr]',
  2: 'grid-cols-[auto_1fr_auto_1fr]',
} as const;

export interface DataKeysAndValuesProps {
  className?: string;
  children: React.ReactNode;
  numOfCol?: 1 | 2;
}

export function DataKeysAndValuesRoot({ className, children, numOfCol = 1 }: DataKeysAndValuesProps) {
  return <dl className={cn('grid gap-x-4 gap-y-1.5', numOfColStyles[numOfCol], className)}>{children}</dl>;
}
