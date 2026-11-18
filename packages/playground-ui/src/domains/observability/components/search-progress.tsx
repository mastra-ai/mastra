import { searchProgressText } from '../lib/progressive-search';
import type { SearchProgressState } from '../lib/progressive-search';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

export type SearchProgressProps = SearchProgressState & {
  /** Stops loading further chunks. */
  onStop: () => void;
  /** Loads the rest of the range after a stop or a failed chunk. */
  onContinue: () => void;
};

/**
 * One line under the filter bar while a word search over a long range loads in chunks:
 * how much of the range is searched, with Stop (or Continue once stopped).
 */
export function SearchProgress({ onStop, onContinue, ...state }: SearchProgressProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-1">
      <Txt variant="caption" tone="muted" role="status">
        {searchProgressText(state)}
      </Txt>
      {state.searching &&
        (state.failed ? (
          <Button variant="ghost" size="sm" onClick={onContinue}>
            Try again
          </Button>
        ) : state.stopped ? (
          <Button variant="ghost" size="sm" onClick={onContinue}>
            Continue
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onStop}>
            Stop
          </Button>
        ))}
    </div>
  );
}
