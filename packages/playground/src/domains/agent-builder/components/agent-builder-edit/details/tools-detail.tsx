import { Button, Checkbox, Txt } from '@mastra/playground-ui';
import { TriangleAlertIcon, WrenchIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useFormContext } from 'react-hook-form';

import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool } from '../../../types/agent-tool';
import type { PickerConnection } from '@/domains/tool-integrations/components/connection-picker';
import { HealthPill } from '@/domains/tool-integrations/components/health-pill';
import type { AgentHealthResult } from '@/domains/tool-integrations/hooks/use-agent-health';

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
   * Grouped tool-integration services. Used to detect whether any selected
   * integration tool needs a connection. Connection editing happens in the
   * dedicated Connections panel.
   */
  toolIntegrationServices?: ToolIntegrationServiceGroup[];
  /** Per-agent health rollup; rendered as a pill in the section header. */
  health?: AgentHealthResult;
  /**
   * Called when the user toggles an integration tool on. Adds it to the form
   * state and bootstraps `toolIntegrations[providerId].tools[slug]`.
   */
  onAddIntegrationTool?: (entry: {
    providerId: string;
    toolSlug: string;
    toolService: string;
    description?: string;
  }) => void;
  /**
   * Called when the user clicks the "Set up" affordance on a row whose
   * service has no active connection. Parent should open the Connections
   * detail panel.
   */
  onOpenConnections?: () => void;
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
  health,
  onAddIntegrationTool,
  onOpenConnections,
  onConnectionsInvalid,
}: ToolsDetailProps) => {
  const { setValue, getValues } = useFormContext<AgentBuilderEditFormValues>();
  const activeCount = availableAgentTools.filter(item => item.isChecked).length;

  const toggle = (item: AgentTool, next: boolean) => {
    if (item.type === 'integration') {
      if (!item.providerId || !item.toolService) return;
      if (next) {
        onAddIntegrationTool?.({
          providerId: item.providerId,
          toolSlug: item.name,
          toolService: item.toolService,
          description: item.description,
        });
        return;
      }
      const current = getValues('toolIntegrations') ?? {};
      const config = current[item.providerId];
      if (!config) return;
      const { [item.name]: _removed, ...remainingTools } = config.tools ?? {};
      setValue(
        'toolIntegrations',
        { ...current, [item.providerId]: { ...config, tools: remainingTools } },
        { shouldDirty: true },
      );
      return;
    }
    const fieldName = item.type === 'agent' ? 'agents' : item.type === 'workflow' ? 'workflows' : 'tools';
    const current = getValues(fieldName) ?? {};
    setValue(fieldName, { ...current, [item.id]: next }, { shouldDirty: true });
  };

  // Lookup of toolIntegrationServices keyed by `providerId:toolService` so
  // we can quickly tell if a row's service still needs a connection.
  const groupByService = useMemo(() => {
    const map = new Map<string, ToolIntegrationServiceGroup>();
    for (const group of toolIntegrationServices) {
      map.set(`${group.integrationId}:${group.toolService}`, group);
    }
    return map;
  }, [toolIntegrationServices]);

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
          {health && health.state !== 'empty' && <HealthPill health={health} />}
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
        {availableAgentTools.length === 0 ? (
          <Txt variant="ui-sm" className="px-6 py-4 text-neutral3">
            No tools available in this project.
          </Txt>
        ) : (
          <ul className="flex flex-col">
            {availableAgentTools.map(item => {
              const serviceKey =
                item.type === 'integration' && item.providerId && item.toolService
                  ? `${item.providerId}:${item.toolService}`
                  : null;
              const group = serviceKey ? groupByService.get(serviceKey) : undefined;
              const needsSetup =
                item.type === 'integration' && item.isChecked && !!group && group.connections.length === 0;
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
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center gap-2">
                        <Txt variant="ui-sm" className="font-medium text-neutral6 truncate">
                          {item.name}
                        </Txt>
                        {needsSetup && (
                          <button
                            type="button"
                            onClick={event => {
                              event.preventDefault();
                              event.stopPropagation();
                              onOpenConnections?.();
                            }}
                            className="inline-flex items-center gap-1 rounded-full bg-accent6Dark/40 px-2 py-0.5 text-accent6 hover:bg-accent6Dark/60"
                            data-testid={`tools-detail-setup-${item.id}`}
                          >
                            <TriangleAlertIcon className="h-3 w-3" />
                            <Txt variant="ui-xs">Set up connection</Txt>
                          </button>
                        )}
                      </div>
                      {item.description && (
                        <Txt variant="ui-xs" className="mt-0.5 truncate text-neutral3">
                          {item.description}
                        </Txt>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
