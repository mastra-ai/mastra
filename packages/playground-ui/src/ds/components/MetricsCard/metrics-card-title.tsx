import { cn } from '@/lib/utils';

export function MetricsCardTitle({
  children,
  className,
  as: Tag = 'h3',
}: {
  children: string;
  className?: string;
  as?: 'h2' | 'h3' | 'h4';
}) {
  return <Tag className={cn('text-body font-medium text-foreground', className)}>{children}</Tag>;
}
