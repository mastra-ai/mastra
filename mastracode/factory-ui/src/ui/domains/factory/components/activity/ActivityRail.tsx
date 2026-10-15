import { Button } from '@mastra/playground-ui/components/Button';
import { Code } from '@mastra/playground-ui/components/Code';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { ActivityEntry } from '../../activity';
import { activityBlocks, clockTime, dayHeading, groupByDay } from '../../activity';
import type { FactoryMentionMember } from '../../services/members';
import { DayHeading, RailRow, RAIL_LIST } from '../Timeline';
import { EntrySentence, EntryTitle, Node, Time, entryTarget, namesSeveralCards } from './entryParts';
import type { ActivityGrouping } from './useTimelineView';

/** Cards of one sentence shown before the rest fold behind a toggle. */
const GROUP_SHOWN = 3;

/** The connector rail needs `RAIL_LIST`'s gap, so tighter lists drop it. */
function listClass(grouping: ActivityGrouping, compact: boolean): string {
  const list = 'm-0 flex list-none flex-col p-0';
  if (grouping === 'similar') return compact ? `${list} gap-2` : RAIL_LIST;
  return compact ? list : `${list} gap-1`;
}

interface RailContext {
  roster: Map<string, FactoryMentionMember>;
  factoryProjectId: string | undefined;
  flagged: ReadonlySet<ActivityEntry>;
  compact: boolean;
}

function GroupedEntries({ entries, context }: { entries: ActivityEntry[]; context: RailContext }) {
  const [expanded, setExpanded] = useState(false);
  const folds = !context.compact && entries.length > GROUP_SHOWN + 1;
  const shown = folds && !expanded ? entries.slice(0, GROUP_SHOWN) : entries;

  return (
    <ul className={`m-0 flex list-none flex-col p-0 ${context.compact ? '' : 'pl-8'}`}>
      {shown.map((entry, index) => (
        <li key={`${entry.id}-${entry.at}`} className="flex min-h-6 min-w-0 items-center gap-2 pr-4">
          <EntryTitle
            entry={entry}
            factoryProjectId={context.factoryProjectId}
            flagged={context.flagged}
            variant="caption"
          />
          {clockTime(entry.at) === clockTime((shown[index - 1] ?? entry).at) ? null : (
            <Time at={entry.at} className="ml-auto pl-2" />
          )}
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

function SummaryRow({
  entries,
  context,
  connected,
}: {
  entries: [ActivityEntry, ...ActivityEntry[]];
  context: RailContext;
  connected: boolean;
}) {
  const [cardsShown, setCardsShown] = useState(false);
  const listsCards = namesSeveralCards(entries);
  const groupToggle =
    context.compact && listsCards ? { expanded: cardsShown, onToggle: () => setCardsShown(!cardsShown) } : undefined;

  return (
    <RailRow mark={<Node entry={entries[0]} />} connected={connected}>
      <EntrySentence entries={entries} {...context} groupToggle={groupToggle} />
      {listsCards && (!context.compact || cardsShown) ? <GroupedEntries entries={entries} context={context} /> : null}
    </RailRow>
  );
}

function EventRow({ entry, context }: { entry: ActivityEntry; context: RailContext }) {
  const [open, setOpen] = useState(false);
  const detail = entry.kind === 'deed' ? entry.detail : '';
  const hasMetadata = Object.keys(entry.metadata).length > 0;

  return (
    <RailRow mark={<Node entry={entry} />} connected={false}>
      <EntrySentence
        entries={[entry]}
        {...context}
        trailing={
          hasMetadata ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              tooltip="Details"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <DisclosureChevron direction={open ? 'down' : 'right'} />
            </Button>
          ) : (
            <span aria-hidden className="w-7 shrink-0" />
          )
        }
      >
        {detail === '' ? null : (
          <Txt as="span" variant="caption" tone="faint" className="min-w-0 truncate">
            {detail}
          </Txt>
        )}
      </EntrySentence>
      {open ? (
        <Code
          code={JSON.stringify(entry.metadata, null, 2)}
          lang="json"
          className="text-meta font-body text-muted-foreground m-0 mt-1 mb-2 px-2 py-1 break-all whitespace-pre-wrap"
        />
      ) : null}
    </RailRow>
  );
}

/** The pinned section already lists what needs action; the feed points at each such card once, on its latest line. */
function newestEntryPerCard(entries: ActivityEntry[], cardIds: ReadonlySet<string>): ReadonlySet<ActivityEntry> {
  const seen = new Set<string>();
  const flagged = new Set<ActivityEntry>();
  for (const entry of entries) {
    const cardId = entryTarget(entry)?.id;
    if (cardId === undefined || !cardIds.has(cardId) || seen.has(cardId)) continue;
    seen.add(cardId);
    flagged.add(entry);
  }
  return flagged;
}

function DayRows({
  entries,
  grouping,
  context,
}: {
  entries: ActivityEntry[];
  grouping: ActivityGrouping;
  context: RailContext;
}) {
  const className = listClass(grouping, context.compact);
  if (grouping === 'none') {
    return (
      <ul className={className}>
        {entries.map(entry => (
          <EventRow key={`${entry.kind}-${entry.id}-${entry.at}`} entry={entry} context={context} />
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
          context={context}
          connected={!context.compact && index < blocks.length - 1}
        />
      ))}
    </ul>
  );
}

/** Factory traffic as sentences on a rail, cut by day. */
export function ActivityRail({
  entries,
  members,
  factoryProjectId,
  needsYou,
  grouping,
  compact,
}: {
  entries: ActivityEntry[];
  members: FactoryMentionMember[];
  factoryProjectId: string | undefined;
  needsYou: ReadonlySet<string>;
  grouping: ActivityGrouping;
  compact: boolean;
}) {
  const context: RailContext = {
    roster: new Map(members.map(member => [member.id, member])),
    factoryProjectId,
    flagged: newestEntryPerCard(entries, needsYou),
    compact,
  };
  const nowMs = Date.now();

  return (
    <div className={compact ? 'flex flex-col gap-5' : 'flex flex-col gap-8'}>
      {groupByDay(entries).map(day => (
        <section key={day.dayMs} className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-4'}>
          <DayHeading>{dayHeading(day.dayMs, nowMs)}</DayHeading>
          <DayRows entries={day.items} grouping={grouping} context={context} />
        </section>
      ))}
    </div>
  );
}
