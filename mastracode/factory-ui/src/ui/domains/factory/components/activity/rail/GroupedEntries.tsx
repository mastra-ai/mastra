import { Button } from '@mastra/playground-ui/components/Button';
import { useState } from 'react';

import { clockTime } from '../../../activity';
import type { ActivityEntry } from '../../../activity';
import { EntryTime } from './sentence/EntryTime';
import { EntryTitle } from './sentence/EntryTitle';

/** Cards of one sentence shown before the rest fold behind a toggle. */
const GROUP_SHOWN = 3;

/** The sentence already carries the first time, so a card shows its own only when the minute changes. */
function startsNewMinute(previous: ActivityEntry | undefined, entry: ActivityEntry): boolean {
  return previous !== undefined && clockTime(previous.at) !== clockTime(entry.at);
}

export function GroupedEntries({
  entries,
  factoryProjectId,
  flagged,
  compact,
}: {
  entries: ActivityEntry[];
  factoryProjectId: string | undefined;
  flagged: ReadonlySet<ActivityEntry>;
  compact: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const folds = !compact && entries.length > GROUP_SHOWN + 1;
  const shown = folds && !expanded ? entries.slice(0, GROUP_SHOWN) : entries;

  return (
    <ul className={`m-0 flex list-none flex-col p-0 ${compact ? '' : 'pl-8'}`}>
      {shown.map((entry, index) => (
        <li key={`${entry.id}-${entry.at}`} className="flex min-h-6 min-w-0 items-center gap-2 pr-4">
          <EntryTitle entry={entry} factoryProjectId={factoryProjectId} flagged={flagged} variant="caption" />
          {startsNewMinute(shown[index - 1], entry) ? <EntryTime at={entry.at} className="ml-auto pl-2" /> : null}
        </li>
      ))}
      {folds ? (
        <li>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            className="-mx-1.5 h-6 px-1.5"
          >
            {expanded ? 'Show less' : `Show ${entries.length - GROUP_SHOWN} more`}
          </Button>
        </li>
      ) : null}
    </ul>
  );
}
