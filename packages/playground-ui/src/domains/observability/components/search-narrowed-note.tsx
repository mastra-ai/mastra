import { SEARCH_MAX_DAYS, searchNarrowedNote } from '../lib/search-range-limit';
import { Txt } from '@/ds/components/Txt';

export type SearchNarrowedNoteProps = { maxDays?: number };

/** One line under the filter bar after a word search narrowed the time range. */
export function SearchNarrowedNote({ maxDays = SEARCH_MAX_DAYS }: SearchNarrowedNoteProps) {
  return (
    <Txt variant="body-sm" tone="muted" role="status">
      {searchNarrowedNote(maxDays)}
    </Txt>
  );
}
