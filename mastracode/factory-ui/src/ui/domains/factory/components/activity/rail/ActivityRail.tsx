import { dayHeading, groupByDay, newestEntryPerCard } from '../../../activity';
import type { ActivityEntry, ActivityGrouping } from '../../../activity';
import type { FactoryMentionMember } from '../../../services/members';
import { DayHeading } from '../../Timeline';
import { DayRows } from './DayRows';

/** Factory traffic as sentences on a rail, cut by day. */
export function ActivityRail({
  entries,
  roster,
  factoryProjectId,
  cardsNeedingYou,
  grouping,
  compact,
}: {
  entries: ActivityEntry[];
  roster: Map<string, FactoryMentionMember>;
  factoryProjectId: string | undefined;
  cardsNeedingYou: ReadonlySet<string>;
  grouping: ActivityGrouping;
  compact: boolean;
}) {
  const flagged = newestEntryPerCard(entries, cardsNeedingYou);
  const nowMs = Date.now();

  return (
    <div className={compact ? 'flex flex-col gap-5' : 'flex flex-col gap-8'}>
      {groupByDay(entries).map(day => (
        <section key={day.dayMs} className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-4'}>
          <DayHeading>{dayHeading(day.dayMs, nowMs)}</DayHeading>
          <DayRows
            entries={day.items}
            grouping={grouping}
            roster={roster}
            factoryProjectId={factoryProjectId}
            flagged={flagged}
            compact={compact}
          />
        </section>
      ))}
    </div>
  );
}
