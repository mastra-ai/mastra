import { cn } from '@/lib/utils';

export function MetricsCardSummary({ value, label, className }: { value: string; label?: string; className?: string }) {
  return (
    <div className={cn('grid content-start justify-end gap-1 text-right', className)}>
      <span className="text-ui-lg text-neutral4 leading-none font-semibold">{value}</span>
      {label && <span className="text-ui-md text-neutral2">{label}</span>}
    </div>
  );
}
