import { Button } from '@mastra/playground-ui/components/Button';
import { useState } from 'react';
import { AgentMetadataList, AgentMetadataListItem } from './agent-metadata-list';

export const AGENT_METADATA_LIST_LIMIT = 10;

export interface AgentMetadataExpandableListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  /** Number of items shown before the `+N` toggle. */
  limit?: number;
}

/**
 * Badge list that only shows the first `limit` items and offers a `+N` toggle
 * to reveal the rest, so long tool/workflow lists stay scannable in a narrow panel.
 */
export const AgentMetadataExpandableList = <T,>({
  items,
  getKey,
  renderItem,
  limit = AGENT_METADATA_LIST_LIMIT,
}: AgentMetadataExpandableListProps<T>) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hiddenCount = Math.max(items.length - limit, 0);
  const visibleItems = isExpanded ? items : items.slice(0, limit);

  return (
    <AgentMetadataList>
      {visibleItems.map(item => (
        <AgentMetadataListItem key={getKey(item)}>{renderItem(item)}</AgentMetadataListItem>
      ))}
      {hiddenCount > 0 && (
        <AgentMetadataListItem>
          <Button
            variant="ghost"
            size="xs"
            aria-expanded={isExpanded}
            data-testid="agent-metadata-expandable-toggle"
            onClick={() => setIsExpanded(expanded => !expanded)}
          >
            {isExpanded ? 'Show less' : `+${hiddenCount}`}
          </Button>
        </AgentMetadataListItem>
      )}
    </AgentMetadataList>
  );
};
