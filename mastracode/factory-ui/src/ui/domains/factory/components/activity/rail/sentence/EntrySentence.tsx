import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import type { ActivityEntry } from '../../../../activity';
import type { FactoryMentionMember } from '../../../../services/members';
import { EntryActor } from './EntryActor';
import { EntryTime } from './EntryTime';
import { MoveDestination } from './MoveDestination';
import { SentenceObject } from './SentenceObject';
import type { GroupToggle } from './SentenceObject';
import { entryVerb } from './sentenceGrammar';

/** Who did what to which card, on one line; detail slots in before the time, controls after it. */
export function EntrySentence({
  entries,
  roster,
  factoryProjectId,
  flagged,
  compact,
  groupToggle,
  children,
  trailing,
}: {
  entries: [ActivityEntry, ...ActivityEntry[]];
  roster: Map<string, FactoryMentionMember>;
  factoryProjectId: string | undefined;
  flagged: ReadonlySet<ActivityEntry>;
  compact: boolean;
  groupToggle?: GroupToggle;
  children?: ReactNode;
  trailing?: ReactNode;
}) {
  const [first] = entries;

  return (
    <div className={`flex min-w-0 items-center gap-x-2 pr-4 ${compact ? 'min-h-6' : 'min-h-7'}`}>
      <EntryActor by={first.by} roster={roster} compact={compact} />
      <Txt as="span" variant="caption" tone="muted" className="shrink-0">
        {entryVerb(entries)}
      </Txt>
      <SentenceObject
        entries={entries}
        factoryProjectId={factoryProjectId}
        flagged={flagged}
        groupToggle={groupToggle}
      />
      {first.kind === 'move' ? <MoveDestination stages={first.stages} /> : null}
      {children}
      <EntryTime at={first.at} className="ml-auto pl-2" />
      {trailing}
    </div>
  );
}
