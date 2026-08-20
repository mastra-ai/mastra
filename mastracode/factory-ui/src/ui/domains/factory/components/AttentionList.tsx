import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { AttentionRow } from '../attention';
import type { AgeBucket } from '../queue-health';
import { stageLabel } from '../stages';
import { formatAgeSeconds } from './QueueHealthChart';
import { QueueEntryRow } from './QueueEntryRow';

const BUCKET_DOT: Record<AgeBucket, string> = {
  green: 'bg-queue-fresh',
  amber: 'bg-queue-aging',
  orange: 'bg-queue-stale',
  red: 'bg-queue-critical',
};

export function AttentionList({ rows, limit }: { rows: AttentionRow[]; limit?: number }) {
  if (rows.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
        Nothing is waiting on a person.
      </Txt>
    );
  }

  const shown = limit === undefined ? rows : rows.slice(0, limit);

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {shown.map(({ entry, reason }) => (
        <QueueEntryRow
          key={`${entry.itemId}:${entry.stage}`}
          entry={entry}
          detail={
            <>
              <span
                aria-hidden="true"
                className={`mr-1.5 inline-block size-1.5 shrink-0 -translate-y-px rounded-full align-middle ${BUCKET_DOT[entry.bucket]}`}
              />
              {reason.label} · {formatAgeSeconds(entry.ageSeconds)}
            </>
          }
          trailing={<Badge size="xs">{stageLabel(entry.stage)}</Badge>}
        />
      ))}
    </ul>
  );
}
