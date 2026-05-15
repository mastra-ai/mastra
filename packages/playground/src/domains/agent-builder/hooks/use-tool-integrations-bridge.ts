import { useCallback, useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import type { ToolIntegrationServiceGroup } from '../components/agent-builder-edit/details/tools-detail';
import type { AgentBuilderEditFormValues, AgentBuilderConnection } from '../schemas';
import type { PickerConnection } from '@/domains/tool-integrations/components/connection-picker';
import { useToolIntegrations } from '@/domains/tool-integrations/hooks/use-tool-integrations';

interface AddToolEntry {
  providerId: string;
  toolSlug: string;
  toolService: string;
  description?: string;
}

interface UseToolIntegrationsBridgeResult {
  /** Pre-built groups that `<ToolsDetail />` consumes verbatim. */
  toolIntegrationServices: ToolIntegrationServiceGroup[];
  /** Handler for `<ToolsDetail onConnectionsChange>`. */
  handleConnectionsChange: (providerId: string, toolService: string, next: PickerConnection[]) => void;
  /** Add an integration tool to form state (typically called when a user checks a row inline). */
  handleAddTools: (entries: AddToolEntry[]) => void;
}

/**
 * Bridge between the agent-builder edit form and the Phase-6 `ToolsDetail`
 * primitives. Derives the `toolIntegrationServices` prop from form state and
 * exposes write handlers that fan into `react-hook-form`'s `setValue`.
 */
export function useToolIntegrationsBridge(): UseToolIntegrationsBridgeResult {
  const { setValue, getValues } = useFormContext<AgentBuilderEditFormValues>();
  const toolIntegrations = useWatch<AgentBuilderEditFormValues, 'toolIntegrations'>({
    name: 'toolIntegrations',
  });
  const integrationsQuery = useToolIntegrations();
  const integrationsData = integrationsQuery.data;

  const integrationMetaById = useMemo(() => {
    const map = new Map<string, { displayName: string; multipleConnectionsPerService: boolean }>();
    for (const integration of integrationsData?.integrations ?? []) {
      map.set(integration.id, {
        displayName: integration.displayName ?? integration.id,
        multipleConnectionsPerService: integration.capabilities?.multipleConnectionsPerService ?? false,
      });
    }
    return map;
  }, [integrationsData]);

  const toolIntegrationServices = useMemo<ToolIntegrationServiceGroup[]>(() => {
    if (!toolIntegrations) return [];
    const groups: ToolIntegrationServiceGroup[] = [];

    for (const [providerId, config] of Object.entries(toolIntegrations)) {
      const meta = integrationMetaById.get(providerId);
      const integrationDisplayName = meta?.displayName ?? providerId;
      const multipleAllowed = meta?.multipleConnectionsPerService ?? false;

      const services = new Set<string>([
        ...Object.keys(config.connections ?? {}),
        ...Object.values(config.tools ?? {}).map(entry => entry.toolService),
      ]);

      for (const toolService of services) {
        const connections = (config.connections?.[toolService] ?? []).map(
          (connection): PickerConnection => ({
            connectionId: connection.connectionId,
            toolService: connection.toolService,
            label: connection.label,
          }),
        );
        const hasSelectedTools = Object.values(config.tools ?? {}).some(entry => entry.toolService === toolService);

        groups.push({
          integrationId: providerId,
          integrationDisplayName,
          toolService,
          toolServiceDisplayName: toolService,
          multipleAllowed,
          hasSelectedTools,
          connections,
        });
      }
    }

    return groups;
  }, [toolIntegrations, integrationMetaById]);

  const handleConnectionsChange = useCallback(
    (providerId: string, toolService: string, next: PickerConnection[]) => {
      const current = getValues('toolIntegrations') ?? {};
      const existing = current[providerId] ?? { tools: {}, connections: {} };
      const nextConnections: Record<string, AgentBuilderConnection[]> = {
        ...(existing.connections ?? {}),
        [toolService]: next.map(connection => ({
          kind: 'author' as const,
          toolService: connection.toolService,
          connectionId: connection.connectionId,
          label: connection.label,
        })),
      };

      setValue(
        'toolIntegrations',
        {
          ...current,
          [providerId]: {
            tools: existing.tools ?? {},
            connections: nextConnections,
          },
        },
        { shouldDirty: true, shouldValidate: true },
      );
    },
    [getValues, setValue],
  );

  const handleAddTools = useCallback(
    (entries: AddToolEntry[]) => {
      if (entries.length === 0) return;
      const current = getValues('toolIntegrations') ?? {};
      const next = { ...current };

      for (const entry of entries) {
        const existing = next[entry.providerId] ?? { tools: {}, connections: {} };
        const tools = {
          ...(existing.tools ?? {}),
          [entry.toolSlug]: {
            toolService: entry.toolService,
            ...(entry.description ? { description: entry.description } : {}),
          },
        };
        next[entry.providerId] = {
          tools,
          connections: existing.connections ?? {},
        };
      }

      setValue('toolIntegrations', next, { shouldDirty: true, shouldValidate: true });
    },
    [getValues, setValue],
  );

  return {
    toolIntegrationServices,
    handleConnectionsChange,
    handleAddTools,
  };
}
