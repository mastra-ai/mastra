import { cn } from '@/lib/utils';

export function MetricsCardTitle({
  children,
  className,
  as: Tag = 'h2',
}: {
  children: string;
  className?: string;
  as?: 'h2' | 'h3' | 'h4';
}) {
  return <Tag className={cn('text-ui-md font-normal text-gray-10', className)}>{children}</Tag>;
}
