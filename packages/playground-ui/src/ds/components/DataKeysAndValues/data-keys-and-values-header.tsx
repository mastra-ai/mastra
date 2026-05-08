import { cn } from '@/lib/utils';

export interface DataKeysAndValuesHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DataKeysAndValuesHeader({ className, children }: DataKeysAndValuesHeaderProps) {
  return (
    <dt className={cn('col-span-full text-ui-sm uppercase tracking-widest text-neutral2 py-3', className)}>
      {children}
    </dt>
  );
}
