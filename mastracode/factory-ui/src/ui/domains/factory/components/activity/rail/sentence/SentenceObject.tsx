import { Button } from '@mastra/playground-ui/components/Button';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { entryTarget } from '../../../../activity';
import type { ActivityEntry } from '../../../../activity';
import { EntryTitle } from './EntryTitle';
import { deedObject, subjectCount } from './sentenceGrammar';

export interface GroupToggle {
  expanded: boolean;
  onToggle: () => void;
}

function Repeats({ count }: { count: number }) {
  if (count < 2) return null;

  return (
    <Txt as="span" variant="caption" tone="muted" className="shrink-0 tabular-nums">
      {count} times
    </Txt>
  );
}

/** What the verb points at: one card, a count of cards, or nothing. */
export function SentenceObject({
  entries,
  factoryProjectId,
  flagged,
  groupToggle,
}: {
  entries: [ActivityEntry, ...ActivityEntry[]];
  factoryProjectId: string | undefined;
  flagged: ReadonlySet<ActivityEntry>;
  groupToggle: GroupToggle | undefined;
}) {
  const object = deedObject(entries);

  if (object === 'none') return <Repeats count={entries.length} />;

  if (object === 'title') {
    return (
      <>
        <EntryTitle entry={entries[0]} factoryProjectId={factoryProjectId} flagged={flagged} variant="column" />
        <Repeats count={entries.length} />
      </>
    );
  }

  const noun = entries.every(entry => entryTarget(entry) !== undefined) ? 'cards' : 'items';
  const count = `${subjectCount(entries)} ${noun}`;

  if (groupToggle === undefined) {
    return (
      <Txt as="span" variant="column" tone="ink" className="shrink-0 tabular-nums">
        {count}
      </Txt>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-expanded={groupToggle.expanded}
      onClick={groupToggle.onToggle}
      className="text-foreground -mx-1.5 h-6 shrink-0 px-1.5 tabular-nums"
    >
      {count}
      <DisclosureChevron direction={groupToggle.expanded ? 'down' : 'right'} />
    </Button>
  );
}
