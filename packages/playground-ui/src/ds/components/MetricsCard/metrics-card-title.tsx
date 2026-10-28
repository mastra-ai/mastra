import { cn } from '@/lib/utils';

export function MetricsCardTitle({
  children,
  className,
  as: Tag = 'h2',
  weight = 'regular',
}: {
  children: string;
  className?: string;
  as?: 'h2' | 'h3' | 'h4';
  /** `medium` for compact cards, where the title stands alone without a description. */
  weight?: 'regular' | 'medium';
}) {
  return (
    <Tag className={cn('text-body text-foreground', weight === 'medium' && 'font-medium', className)}>{children}</Tag>
  );
}
