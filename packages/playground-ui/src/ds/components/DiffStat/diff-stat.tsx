import { pluralize } from '@/lib/string';
import { cn } from '@/lib/utils';

export interface DiffStatProps {
  additions: number;
  deletions: number;
  className?: string;
}

export function DiffStat({ additions, deletions, className }: DiffStatProps) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 tabular-nums', className)}>
      <span aria-hidden="true" className="text-success-indicator">
        +{additions}
      </span>
      <span aria-hidden="true" className="text-destructive-foreground">
        −{deletions}
      </span>
      <span className="sr-only">{`${pluralize(additions, 'addition')} and ${pluralize(deletions, 'deletion')}`}</span>
    </span>
  );
}
