import { cn } from '@/lib/utils';

export function RowContainer({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn('flex items-baseline gap-3 ', className)} style={{ ...style }}>
      {children}
    </div>
  );
}
