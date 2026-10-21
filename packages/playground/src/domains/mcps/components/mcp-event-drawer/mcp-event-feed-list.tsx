import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { RadioIcon } from 'lucide-react';
import type { EventFeedItem } from '../../hooks/use-mcp-event-feed';
import { McpEventOccurrenceRow } from './mcp-event-occurrence-row';

export const GAP_MESSAGE = 'Gap: events may have been skipped';

/** Occurrences, newest first, with a marker wherever the server reported a gap. */
export function McpEventFeedList({ items }: { items: EventFeedItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        iconSlot={<RadioIcon />}
        titleSlot="No events yet"
        descriptionSlot="Start listening or poll to see occurrences here."
      />
    );
  }

  return (
    <ol aria-label="Occurrences" className="grid grid-cols-1 gap-2">
      {items.map(item => (
        <li key={item.key}>
          {item.kind === 'gap' ? (
            <Notice variant="warning">{GAP_MESSAGE}</Notice>
          ) : (
            <McpEventOccurrenceRow occurrence={item.occurrence} />
          )}
        </li>
      ))}
    </ol>
  );
}
