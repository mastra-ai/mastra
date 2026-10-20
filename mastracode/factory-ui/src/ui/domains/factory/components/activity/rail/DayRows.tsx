import { activityBlocks } from '../../../activity';
import type { ActivityEntry, ActivityGrouping } from '../../../activity';
import type { FactoryMentionMember } from '../../../services/members';
import { RAIL_LIST } from '../../Timeline';
import { EventRow } from './EventRow';
import { SummaryRow } from './SummaryRow';

/** The connector rail needs `RAIL_LIST`'s gap, so tighter lists drop it. */
function listClass(grouping: ActivityGrouping, compact: boolean): string {
  const list = 'm-0 flex list-none flex-col p-0';
  if (grouping === 'similar') return compact ? `${list} gap-2` : RAIL_LIST;
  return compact ? list : `${list} gap-1`;
}

export function DayRows({
  entries,
  grouping,
  roster,
  factoryProjectId,
  flagged,
  compact,
}: {
  entries: ActivityEntry[];
  grouping: ActivityGrouping;
  roster: Map<string, FactoryMentionMember>;
  factoryProjectId: string | undefined;
  flagged: ReadonlySet<ActivityEntry>;
  compact: boolean;
}) {
  const className = listClass(grouping, compact);

  if (grouping === 'none') {
    return (
      <ul className={className}>
        {entries.map(entry => (
          <EventRow
            key={`${entry.kind}-${entry.id}-${entry.at}`}
            entry={entry}
            roster={roster}
            factoryProjectId={factoryProjectId}
            flagged={flagged}
            compact={compact}
          />
        ))}
      </ul>
    );
  }

  const blocks = activityBlocks(entries);
  return (
    <ul className={className}>
      {blocks.map((block, index) => (
        <SummaryRow
          key={`${block.key}-${block.entries[0].at}`}
          entries={block.entries}
          connected={!compact && index < blocks.length - 1}
          roster={roster}
          factoryProjectId={factoryProjectId}
          flagged={flagged}
          compact={compact}
        />
      ))}
    </ul>
  );
}
