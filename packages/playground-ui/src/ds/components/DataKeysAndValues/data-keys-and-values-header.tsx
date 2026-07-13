import { cn } from '@/lib/utils';

export interface DataKeysAndValuesHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DataKeysAndValuesHeader({ className, children }: DataKeysAndValuesHeaderProps) {
  return (
    <dt className={cn('col-span-full py-3 text-ui-sm tracking-widest text-neutral2 uppercase', className)}>
      {children}
    </dt>
  );
}
