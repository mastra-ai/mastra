import { Button, Checkbox, Txt } from '@mastra/playground-ui';
import { WrenchIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useFormContext } from 'react-hook-form';

import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool } from '../../../types/agent-tool';
import { ConnectionPicker } from '@/domains/tool-integrations/components/connection-picker';
import type { PickerConnection } from '@/domains/tool-integrations/components/connection-picker';

/**
 * Props-driven view of a single `(integration, toolService)` group rendered
 * in the Tools panel. Phase 7 owns deriving these from `react-hook-form`
 * state; Phase 6 just renders.
 */
export interface ToolIntegrationServiceGroup {
  integrationId: string;
  integrationDisplayName: string;
  toolService: string;
  toolServiceDisplayName: string;
  /** From `integration.capabilities.multipleConnectionsPerService`. */
  multipleAllowed: boolean;
  /** Whether at least one tool from this service is currently selected. */
  hasSelectedTools: boolean;
  connections: PickerConnection[];
}

interface ToolsDetailProps {
  onClose: () => void;
  editable?: boolean;
  availableAgentTools?: AgentTool[];
  /**
   * Grouped tool-integration services to render pickers for. Empty/omitted
   * preserves legacy behaviour (checkbox list only).
   */
  toolIntegrationServices?: ToolIntegrationServiceGroup[];
  /** Controlled write hook for connection edits per service. */
  onConnectionsChange?: (integrationId: string, toolService: string, next: PickerConnection[]) => void;
  /**
   * Fires whenever the "connections are invalid" signal flips. Invalid means
   * any service with selected tools has zero connections. Phase 7 wires this
   * to the Save-disabled toggle.
   */
  onConnectionsInvalid?: (invalid: boolean) => void;
}

export const ToolsDetail = ({
  onClose,
  editable = true,
  availableAgentTools = [],
  toolIntegrationServices = [],
  onConnectionsChange,
  onConnectionsInvalid,
}: ToolsDetailProps) => {
  const { setValue, getValues } = useFormContext<AgentBuilderEditFormValues>();
  const activeCount = availableAgentTools.filter(item => item.isChecked).length;

  const toggle = (item: AgentTool, next: boolean) => {
    const fieldName = item.type === 'agent' ? 'agents' : item.type === 'workflow' ? 'workflows' : 'tools';
    const current = getValues(fieldName) ?? {};
    setValue(fieldName, { ...current, [item.id]: next }, { shouldDirty: true });
  };

  const invalid = useMemo(
    () => toolIntegrationServices.some(group => group.hasSelectedTools && group.connections.length === 0),
    [toolIntegrationServices],
  );

  // Edge-triggered callback: only fire when the validity bit flips.
  const lastInvalidRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!onConnectionsInvalid) return;
    if (lastInvalidRef.current === invalid) return;
    lastInvalidRef.current = invalid;
    onConnectionsInvalid(invalid);
  }, [invalid, onConnectionsInvalid]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border1">
        <div className="flex items-center gap-2 min-w-0">
          <WrenchIcon className="h-4 w-4 shrink-0 text-neutral3" />
          <Txt variant="ui-md" className="font-medium text-neutral6 truncate">
            Tools
          </Txt>
          {availableAgentTools.length > 0 && (
            <Txt variant="ui-xs" className="shrink-0 tabular-nums text-neutral3">
              {activeCount} / {availableAgentTools.length}
            </Txt>
          )}
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          tooltip="Close"
          className="rounded-full"
          onClick={onClose}
          data-testid="tools-detail-close"
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-2">
        {availableAgentTools.length === 0 && toolIntegrationServices.length === 0 ? (
          <Txt variant="ui-sm" className="px-6 py-4 text-neutral3">
            No tools available in this project.
          </Txt>
        ) : (
          <>
            <ul className="flex flex-col">
              {availableAgentTools.map(item => {
                return (
                  <li key={item.id}>
                    <label
                      className="flex cursor-pointer items-start gap-3 px-6 py-4 transition-colors hover:bg-surface2"
                      aria-disabled={!editable}
                    >
                      <div className="mt-0.5">
                        <Checkbox
                          variant="neutral"
                          checked={item.isChecked}
                          onCheckedChange={next => toggle(item, next === true)}
                          disabled={!editable}
                        />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <Txt variant="ui-sm" className="font-medium text-neutral6">
                          {item.name}
                        </Txt>
                        {item.description && (
                          <Txt variant="ui-xs" className="mt-0.5 truncate text-neutral3" title={item.description}>
                            {item.description}
                          </Txt>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>

            {toolIntegrationServices.length > 0 && (
              <div
                className="flex flex-col gap-3 border-t border-border1 px-6 py-4"
                data-testid="tools-detail-integrations"
              >
                {toolIntegrationServices.map(group => (
                  <div
                    key={`${group.integrationId}:${group.toolService}`}
                    className="flex flex-col gap-2"
                    data-testid={`tools-detail-service-${group.integrationId}-${group.toolService}`}
                  >
                    <div className="flex items-center gap-2">
                      <Txt variant="ui-sm" className="font-medium text-neutral6">
                        {group.toolServiceDisplayName}
                      </Txt>
                      <Txt variant="ui-xs" className="text-neutral3">
                        · {group.integrationDisplayName}
                      </Txt>
                    </div>
                    <ConnectionPicker
                      integrationId={group.integrationId}
                      toolService={group.toolService}
                      multipleAllowed={group.multipleAllowed}
                      connections={group.connections}
                      disabled={!editable}
                      onChange={next => onConnectionsChange?.(group.integrationId, group.toolService, next)}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
