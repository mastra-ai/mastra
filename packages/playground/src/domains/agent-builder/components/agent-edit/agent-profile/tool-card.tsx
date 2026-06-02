import { Txt, cn } from '@mastra/playground-ui';
import { useQueryClient } from '@tanstack/react-query';
import { IntegrationConnectionPicker } from '../../../../tool-providers/components/integration-connection-picker';
import { useAuthorize } from '../../../../tool-providers/hooks/use-authorize';
import type { AgentTool } from '../../../types/agent-tool';
import { AgentSelectableCard } from '../agent-selectable-card';

interface ToolCardProps {
  item: AgentTool;
  editable: boolean;
  multipleAllowed: boolean;
  onToggle: (item: AgentTool, next: boolean) => void;
  onConnected: (item: AgentTool, connectionId: string) => void;
}

/**
 * A single tool tile. For integration tools it also renders the
 * "Needs connection" control (when unconnected) and the connection picker
 * (when checked). Native tools render just the selectable card.
 */
export const ToolCard = ({ item, editable, multipleAllowed, onToggle, onConnected }: ToolCardProps) => {
  const isIntegration = item.type === 'integration' && !!item.providerId && !!item.toolkit;
  const needsConnection = isIntegration && item.hasConnection === false;
  const showPicker = isIntegration && item.isChecked;

  return (
    <div className="flex flex-col gap-2">
      <AgentSelectableCard
        title={item.name}
        subtitle={item.description || 'No description provided'}
        isSelected={item.isChecked}
        disabled={!editable}
        onClick={() => onToggle(item, !item.isChecked)}
        ariaLabel={item.name}
        testId={`tool-card-${item.type}-${item.id}`}
        checkTestId={`tool-card-check-${item.type}-${item.id}`}
      />
      {needsConnection && (
        <IntegrationConnectControl
          item={item}
          providerId={item.providerId!}
          toolkit={item.toolkit!}
          disabled={!editable}
          onConnected={connectionId => onConnected(item, connectionId)}
        />
      )}
      {showPicker && (
        <IntegrationConnectionPicker
          providerId={item.providerId!}
          toolkit={item.toolkit!}
          multipleAllowed={multipleAllowed}
          disabled={!editable}
        />
      )}
    </div>
  );
};

interface IntegrationConnectControlProps {
  item: AgentTool;
  providerId: string;
  toolkit: string;
  disabled: boolean;
  /**
   * Fires after a successful OAuth handshake with the new connection's id.
   * Used by the parent to auto-pin the connection into the form when the
   * tool is already selected.
   */
  onConnected?: (connectionId: string) => void;
}

/**
 * Compact "Needs connection" hint + Connect button rendered beneath an
 * integration tool's selectable card. The card itself stays selectable so
 * users can pre-select tools and run OAuth after. On success we invalidate
 * the `tool-integration-connections-all` query so the hint disappears.
 */
const IntegrationConnectControl = ({
  item,
  providerId,
  toolkit,
  disabled,
  onConnected,
}: IntegrationConnectControlProps) => {
  const queryClient = useQueryClient();
  const authorize = useAuthorize();

  const handleConnect = () => {
    authorize.mutate(
      { providerId, toolkit, scope: 'per-author' },
      {
        onSuccess: result => {
          void queryClient.invalidateQueries({
            queryKey: ['tool-integration-connections-all', providerId, toolkit],
          });
          if (result.status === 'completed') {
            onConnected?.(result.connectionId);
          }
        },
      },
    );
  };

  return (
    <div className="flex items-center justify-between gap-2 px-2">
      <Txt variant="ui-xs" className="text-neutral3">
        Needs connection
      </Txt>
      <button
        type="button"
        onClick={handleConnect}
        disabled={disabled || authorize.isPending}
        data-testid={`tool-card-connect-${item.type}-${item.id}`}
        className={cn(
          'shrink-0 rounded border border-border1 bg-surface4 px-2 py-0.5 text-ui-xs text-neutral6',
          'hover:bg-surface5 disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        {authorize.isPending ? 'Connecting…' : 'Connect'}
      </button>
      {authorize.error && (
        <Txt variant="ui-xs" className="ml-1 text-red-500">
          {String(authorize.error)}
        </Txt>
      )}
    </div>
  );
};
