import { Chip } from '@/index';
import { cn } from '@/lib/utils';
import { ArrowDownIcon, ArrowUpIcon, EqualIcon } from 'lucide-react';

interface ScoreDeltaProps {
  /** Difference between scores (B - A) */
  delta: number;
}

/**
 * Visual indicator for score difference between runs.
 * Shows arrow direction and delta value in neutral color.
 */
export function ScoreDelta({ delta }: ScoreDeltaProps) {
  const arrow =
    delta > 0 ? (
      <Chip size="small" color="green" intensity="muted">
        <ArrowUpIcon />
      </Chip>
    ) : delta < 0 ? (
      <Chip size="small" color="red" intensity="muted">
        <ArrowDownIcon />
      </Chip>
    ) : null;

  return (
    <span className={cn('font-mono text-sm text-neutral4 min-w-[5rem]')}>
      <span className="w-3 inline-block">{delta > 0 ? '+ ' : delta < 0 ? '- ' : ''}</span>
      {Math.abs(delta).toFixed(2)}&nbsp;{arrow}
    </span>
  );
}
