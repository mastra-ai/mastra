import { cn } from '@/lib/utils';

export function MetricsCardSummary({ value, label, className }: { value: string; label?: string; className?: string }) {
  return (
    <div className={cn('text-right', className)}>
      <p className="text-body text-muted-foreground tabular-nums">{value}</p>
      {label && <p className="mt-0.5 text-body text-placeholder">{label}</p>}
    </div>
  );
}
