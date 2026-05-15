import { Button, Txt } from '@mastra/playground-ui';
import { LinkIcon, TriangleAlertIcon, XIcon } from 'lucide-react';

import type { ToolIntegrationServiceGroup } from './tools-detail';
import { ConnectionPicker } from '@/domains/tool-integrations/components/connection-picker';
import type { PickerConnection } from '@/domains/tool-integrations/components/connection-picker';
import { HealthPill } from '@/domains/tool-integrations/components/health-pill';
import type { AgentHealthResult } from '@/domains/tool-integrations/hooks/use-agent-health';

interface ConnectionsDetailProps {
  onClose: () => void;
  editable?: boolean;
  toolIntegrationServices?: ToolIntegrationServiceGroup[];
  onConnectionsChange?: (integrationId: string, toolService: string, next: PickerConnection[]) => void;
  health?: AgentHealthResult;
}

/**
 * Right-side detail panel that surfaces every `(integration, toolService)`
 * group attached to the agent and renders its `ConnectionPicker`. Lives
 * alongside `ToolsDetail` so connections get a dedicated, non-hidden home.
 */
export const ConnectionsDetail = ({
  onClose,
  editable = true,
  toolIntegrationServices = [],
  onConnectionsChange,
  health,
}: ConnectionsDetailProps) => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border1">
        <div className="flex items-center gap-2 min-w-0">
          <LinkIcon className="h-4 w-4 shrink-0 text-neutral3" />
          <Txt variant="ui-md" className="font-medium text-neutral6 truncate">
            Connections
          </Txt>
          {health && health.state !== 'empty' && <HealthPill health={health} />}
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          tooltip="Close"
          className="rounded-full"
          onClick={onClose}
          data-testid="connections-detail-close"
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-2">
        {toolIntegrationServices.length === 0 ? (
          <Txt variant="ui-sm" className="px-6 py-4 text-neutral3">
            No integration tools selected. Pick a tool in the Tools panel to set up its connection.
          </Txt>
        ) : (
          <ul className="flex flex-col">
            {toolIntegrationServices.map(group => {
              const needsConnection = group.hasSelectedTools && group.connections.length === 0;
              return (
                <li
                  key={`${group.integrationId}:${group.toolService}`}
                  className="flex flex-col gap-3 px-6 py-4 border-b border-border1 last:border-b-0"
                  data-testid={`connections-detail-service-${group.integrationId}-${group.toolService}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <Txt variant="ui-sm" className="font-medium text-neutral6 truncate">
                        {group.toolServiceDisplayName}
                      </Txt>
                      <Txt variant="ui-xs" className="text-neutral3 truncate">
                        {group.integrationDisplayName}
                      </Txt>
                    </div>
                    {needsConnection && (
                      <span
                        className="flex items-center gap-1 rounded-full bg-accent6Dark/40 px-2 py-0.5 text-accent6"
                        data-testid={`connections-detail-needs-${group.integrationId}-${group.toolService}`}
                      >
                        <TriangleAlertIcon className="h-3 w-3" />
                        <Txt variant="ui-xs">Connect required</Txt>
                      </span>
                    )}
                  </div>
                  <ConnectionPicker
                    integrationId={group.integrationId}
                    toolService={group.toolService}
                    multipleAllowed={group.multipleAllowed}
                    connections={group.connections}
                    disabled={!editable}
                    onChange={next => onConnectionsChange?.(group.integrationId, group.toolService, next)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
