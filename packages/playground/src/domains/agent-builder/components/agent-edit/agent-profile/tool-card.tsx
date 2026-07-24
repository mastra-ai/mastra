import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
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
 * "Requires connection" hint; when connected, it shows small badges naming the
 * active connection(s) the tool uses; otherwise it keeps the footer spacer so
 * cards stay aligned across the grid.
 */
export const ToolCard = ({ item, editable, onToggle }: ToolCardProps) => {
  const isIntegration = item.type === 'integration' && !!item.providerId && !!item.toolkit;
  const needsConnection = isIntegration && item.hasConnection === false;
  const connectionLabels = item.connectionLabels ?? [];
  const hasConnectionBadges = isIntegration && !needsConnection && connectionLabels.length > 0;

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
          ) : hasConnectionBadges ? (
            <div
              className="flex min-h-7 flex-wrap items-center gap-2"
              data-testid={`tool-card-connections-${item.type}-${item.id}`}
            >
              {connectionLabels.map(label => (
                <Badge key={label} className="h-auto py-0.5 text-[10px]">
                  {label}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="h-7" />
          )
        ) : undefined
      }
    />
  );
};
