import { Txt } from '@mastra/playground-ui';
import type { AgentTool } from '../../../types/agent-tool';
import { AgentSelectableCard } from '../agent-selectable-card';

interface ToolCardProps {
  item: AgentTool;
  editable: boolean;
  onToggle: (item: AgentTool, next: boolean) => void;
}

/**
 * A single tool tile. Connections are managed per-toolkit in the left filter
 * pane, not per-tool, so the card only signals selectability. When an
 * integration tool's toolkit has no connection yet, it shows a muted
 * "Requires connection" hint; otherwise it keeps the footer spacer so cards
 * stay aligned across the grid.
 */
export const ToolCard = ({ item, editable, onToggle }: ToolCardProps) => {
  const isIntegration = item.type === 'integration' && !!item.providerId && !!item.toolkit;
  const needsConnection = isIntegration && item.hasConnection === false;

  return (
    <AgentSelectableCard
      title={item.name}
      subtitle={item.description || 'No description provided'}
      isSelected={item.isChecked}
      disabled={!editable}
      onClick={() => onToggle(item, !item.isChecked)}
      ariaLabel={item.name}
      testId={`tool-card-${item.type}-${item.id}`}
      checkTestId={`tool-card-check-${item.type}-${item.id}`}
      footer={
        isIntegration ? (
          needsConnection ? (
            <Txt
              variant="ui-xs"
              className="flex h-7 items-center text-neutral3"
              data-testid={`tool-card-requires-connection-${item.type}-${item.id}`}
            >
              Requires connection
            </Txt>
          ) : (
            <div className="h-7" />
          )
        ) : undefined
      }
    />
  );
};
