import { cn } from '@/lib/utils';

export function MetricsCardSummary({ value, label, className }: { value: string; label?: string; className?: string }) {
  return (
    <div className={cn('grid content-start justify-end gap-1 text-right', className)}>
      <span className="text-subheading text-muted-foreground leading-none">{value}</span>
      {label && <span className="text-body text-placeholder">{label}</span>}
    </div>
  );
}
