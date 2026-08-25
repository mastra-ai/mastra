import { cn } from '@/lib/utils';

export interface DataKeysAndValuesKeyProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function DataKeysAndValuesKey({ className, style, children }: DataKeysAndValuesKeyProps) {
  return (
    <dt className={cn('shrink-0  py-0.5 text-ui-smd text-neutral2', className)} style={style}>
      {children}
    </dt>
  );
}
