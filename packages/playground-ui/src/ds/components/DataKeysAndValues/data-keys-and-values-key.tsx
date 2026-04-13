import { cn } from '@/lib/utils';

export interface DataKeysAndValuesKeyProps {
  className?: string;
  children: React.ReactNode;
}

export function DataKeysAndValuesKey({ className, children }: DataKeysAndValuesKeyProps) {
  return <dt className={cn('text-ui-smd  text-neutral2 shrink-0 py-0.5', className)}>{children}</dt>;
}
