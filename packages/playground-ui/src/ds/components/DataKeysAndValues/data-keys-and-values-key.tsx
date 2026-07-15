import { cn } from '@/lib/utils';

export interface DataKeysAndValuesKeyProps {
  className?: string;
  children: React.ReactNode;
}

export function DataKeysAndValuesKey({ className, children }: DataKeysAndValuesKeyProps) {
  return <dt className={cn('shrink-0  py-0.5 text-ui-smd text-neutral2', className)}>{children}</dt>;
}
