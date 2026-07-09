import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Button } from '../Button';
import { cn } from '@/lib/utils';

export type MatchNavProps = {
  /** 1-based position of the active match; 0 when there are no matches. */
  current: number;
  /** Total number of matches. Controls the counter and disables the buttons when 0. */
  total: number;
  onNext?: () => void;
  onPrevious?: () => void;
  className?: string;
};

/**
 * Browser-find-bar-style "current/total" counter with previous/next controls. Purely
 * presentational — pair it with `useMatchNavigation` (or any index state) for the stepping logic.
 * Rendered inline by `SearchFieldBlock` when match navigation props are provided.
 */
export function MatchNav({ current, total, onNext, onPrevious, className }: MatchNavProps) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <span
        aria-live="polite"
        aria-label={`${total === 0 ? 0 : current} of ${total} matches`}
        className="text-neutral3 text-ui-xs tabular-nums whitespace-nowrap select-none px-1"
      >
        {total === 0 ? '0/0' : `${current}/${total}`}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Previous match"
        tooltip="Previous match (Shift+Enter)"
        disabled={!total}
        onClick={onPrevious}
      >
        <ChevronUpIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Next match"
        tooltip="Next match (Enter)"
        disabled={!total}
        onClick={onNext}
      >
        <ChevronDownIcon />
      </Button>
    </div>
  );
}
