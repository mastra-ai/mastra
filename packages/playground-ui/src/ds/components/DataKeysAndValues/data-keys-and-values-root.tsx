import { cn } from '@/lib/utils';

export interface DataKeysAndValuesProps {
  className?: string;
  children: React.ReactNode;
  numOfCol?: 1 | 2;
}

export function DataKeysAndValuesRoot({ className, children, numOfCol = 1 }: DataKeysAndValuesProps) {
  return (
    <dl
      className={cn('grid gap-x-4 gap-y-1.5 grid-cols-[auto_1fr]', className)}
      style={numOfCol === 2 ? { gridTemplateColumns: 'auto 1fr auto 1fr' } : undefined}
    >
      {children}
    </dl>
  );
}
