import { Chip } from '@mastra/playground-ui/components/Chip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';

interface ScoreDeltaProps {
  /** Difference between scores (B - A) */
  delta: number;
}

/**
 * Visual indicator for score difference between runs: a diagonal trend arrow
 * plus the absolute difference.
 */
export function ScoreDelta({ delta }: ScoreDeltaProps) {
  const arrow =
    delta > 0 ? (
      <Chip size="small" color="green" intensity="bright">
        <ArrowUpRightIcon />
      </Chip>
    ) : delta < 0 ? (
      <Chip size="small" color="red" intensity="bright">
        <ArrowDownRightIcon />
      </Chip>
    ) : null;

  return (
    <span className={cn('font-mono text-sm text-neutral4 min-w-20')}>
      <span className="inline-block w-3">{delta > 0 ? '+ ' : delta < 0 ? '- ' : ''}</span>
      {Math.abs(delta).toFixed(2)}&nbsp;{arrow}
    </span>
  );
}
