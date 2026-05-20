import { cn } from '@/lib/utils';

export function MetricsCardSummary({ value, label, className }: { value: string; label?: string; className?: string }) {
  return (
    <div className={cn('grid justify-end content-start text-right gap-1', className)}>
      <span className="text-ui-lg font-semibold text-neutral4 leading-none">{value}</span>
      {label && <span className="text-ui-md text-neutral2">{label}</span>}
    </div>
  );
}
