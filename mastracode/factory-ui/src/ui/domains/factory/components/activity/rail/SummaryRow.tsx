import { useState } from 'react';

import type { ActivityEntry } from '../../../activity';
import type { FactoryMentionMember } from '../../../services/members';
import { RailRow } from '../../Timeline';
import { GroupedEntries } from './GroupedEntries';
import { EntryNode } from './sentence/EntryNode';
import { EntrySentence } from './sentence/EntrySentence';
import { namesSeveralCards } from './sentence/sentenceGrammar';

/** One hand doing one thing; several cards list under the sentence, behind its count in compact view. */
export function SummaryRow({
  entries,
  connected,
  roster,
  factoryProjectId,
  flagged,
  compact,
}: {
  entries: [ActivityEntry, ...ActivityEntry[]];
  connected: boolean;
  roster: Map<string, FactoryMentionMember>;
  factoryProjectId: string | undefined;
  flagged: ReadonlySet<ActivityEntry>;
  compact: boolean;
}) {
  const [cardsShown, setCardsShown] = useState(false);
  const listsCards = namesSeveralCards(entries);
  const foldsCards = compact && listsCards;

  return (
    <RailRow mark={<EntryNode entry={entries[0]} />} connected={connected}>
      <EntrySentence
        entries={entries}
        roster={roster}
        factoryProjectId={factoryProjectId}
        flagged={flagged}
        compact={compact}
        groupToggle={foldsCards ? { expanded: cardsShown, onToggle: () => setCardsShown(!cardsShown) } : undefined}
      />
      {listsCards && (!foldsCards || cardsShown) ? (
        <GroupedEntries entries={entries} factoryProjectId={factoryProjectId} flagged={flagged} compact={compact} />
      ) : null}
    </RailRow>
  );
}
