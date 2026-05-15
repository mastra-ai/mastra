import { Button, Checkbox, Txt } from '@mastra/playground-ui';
import { LinkIcon, WrenchIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useFormContext } from 'react-hook-form';

import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool } from '../../../types/agent-tool';
import { ConnectionPicker } from '@/domains/tool-integrations/components/connection-picker';
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
}

export const ToolsDetail = ({
  onClose,
  editable = true,
  availableAgentTools = [],
  toolIntegrationServices = [],
  onConnectionsChange,
  onConnectionsInvalid,
  health,
  onAddIntegrationTool,
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
  // integration rows can render their picker inline.
  const groupByService = useMemo(() => {
    const map = new Map<string, ToolIntegrationServiceGroup>();
    for (const group of toolIntegrationServices) {
      map.set(`${group.integrationId}:${group.toolService}`, group);
    }
    return map;
  }, [toolIntegrationServices]);

  // Track which `(providerId:toolService)` groups have already rendered their
  // inline picker, so we only show it once per service (under the first row).
  const renderedServices = new Set<string>();

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
        {availableAgentTools.length === 0 && toolIntegrationServices.length === 0 ? (
          <Txt variant="ui-sm" className="px-6 py-4 text-neutral3">
            No tools available in this project.
          </Txt>
        ) : (
          <>
            <ul className="flex flex-col">
              {availableAgentTools.map(item => {
                const serviceKey =
                  item.type === 'integration' && item.providerId && item.toolService
                    ? `${item.providerId}:${item.toolService}`
                    : null;
                const group = serviceKey ? groupByService.get(serviceKey) : undefined;
                const showInlinePicker =
                  item.type === 'integration' &&
                  item.isChecked &&
                  !!group &&
                  !!serviceKey &&
                  !renderedServices.has(serviceKey);
                if (showInlinePicker && serviceKey) {
                  renderedServices.add(serviceKey);
                }
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
                        <Txt variant="ui-sm" className="font-medium text-neutral6">
                          {item.name}
                        </Txt>
                        {item.description && (
                          <Txt variant="ui-xs" className="mt-0.5 truncate text-neutral3">
                            {item.description}
                          </Txt>
                        )}
                      </div>
                    </label>
                    {showInlinePicker && group && (
                      <div
                        className="flex flex-col gap-2 border-t border-border1 bg-surface2/40 px-6 py-3"
                        data-testid={`tools-detail-service-${group.integrationId}-${group.toolService}`}
                      >
                        <div className="flex items-center gap-2">
                          <LinkIcon className="h-3 w-3 text-neutral3" />
                          <Txt variant="ui-xs" className="text-neutral3">
                            {group.toolServiceDisplayName} · {group.integrationDisplayName}
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
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};
