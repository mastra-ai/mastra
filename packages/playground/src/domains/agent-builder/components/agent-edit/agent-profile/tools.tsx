import { Checkbox, Txt, cn } from '@mastra/playground-ui';
import { useQueryClient } from '@tanstack/react-query';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { IntegrationConnectionPicker } from '../../../../tool-providers/components/integration-connection-picker';
import { useAuthorize } from '../../../../tool-providers/hooks/use-authorize';
import { useToolProviders } from '../../../../tool-providers/hooks/use-tool-providers';
import type { ToolProviderConnectionFormValue } from '../../../../tool-providers/schemas';
import { useAgentColor } from '../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool } from '../../../types/agent-tool';
import { AgentSearchbar } from '../agent-searchbar';
import { AgentSelectableCard } from '../agent-selectable-card';

interface ToolsProps {
  editable?: boolean;
  availableAgentTools?: AgentTool[];
}

export const Tools = ({ editable = true, availableAgentTools = [] }: ToolsProps) => {
  const { setValue, getValues } = useFormContext<AgentBuilderEditFormValues>();
  const agentColor = useAgentColor();
  const [search, setSearch] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);

  // Per-provider capability lookup so the picker knows whether multiple
  // connections per toolkit are allowed for a given provider.
  const providersQuery = useToolProviders();
  const providerCapsById = useMemo(() => {
    const map = new Map<string, { multipleConnectionsPerToolkit: boolean }>();
    for (const provider of providersQuery.data?.providers ?? []) {
      map.set(provider.id, {
        multipleConnectionsPerToolkit: provider.capabilities?.multipleConnectionsPerToolkit ?? false,
      });
    }
    return map;
  }, [providersQuery.data?.providers]);

  const filterCheckboxStyle: CSSProperties | undefined = onlySelected
    ? {
        backgroundColor: agentColor.background,
        borderColor: agentColor.background,
        color: agentColor.foreground,
      }
    : undefined;

  const toggle = (item: AgentTool, next: boolean) => {
    if (item.type === 'integration' && item.providerId && item.toolkit) {
      // Integration tools live in `toolProviders[providerId].tools`, keyed by
      // the bare slug (the AgentTool `name` field, see use-available-agent-tools.ts).
      const slug = item.name;
      const current = (getValues('toolProviders') ?? {}) as Record<
        string,
        {
          tools?: Record<string, { toolkit: string; description?: string }>;
          connections?: Record<string, ToolProviderConnectionFormValue[]>;
        }
      >;
      const existing = current[item.providerId] ?? { tools: {}, connections: {} };
      const nextTools = { ...(existing.tools ?? {}) };
      const nextConnections = { ...(existing.connections ?? {}) };
      if (next) {
        nextTools[slug] = { toolkit: item.toolkit, ...(item.description ? { description: item.description } : {}) };
      } else {
        delete nextTools[slug];
      }
      setValue(
        'toolProviders',
        { ...current, [item.providerId]: { ...existing, tools: nextTools, connections: nextConnections } } as never,
        { shouldDirty: true },
      );
      return;
    }
    const fieldName = item.type === 'agent' ? 'agents' : item.type === 'workflow' ? 'workflows' : 'tools';
    const current = getValues(fieldName) ?? {};
    setValue(fieldName, { ...current, [item.id]: next }, { shouldDirty: true });
  };

  if (availableAgentTools.length === 0) {
    return <ToolListEmptyState details={'No tools available in this project'} />;
  }

  const visibleTools = getVisibleTools(availableAgentTools, search, onlySelected);
  const trimmedSearch = search.trim();

  let emptyStateDetails: ReactNode;
  if (onlySelected && trimmedSearch === '') {
    emptyStateDetails = 'No tools selected yet';
  } else if (onlySelected) {
    emptyStateDetails = <>No selected tools match "{trimmedSearch}"</>;
  } else {
    emptyStateDetails = (
      <>
        No tools match <strong>"${trimmedSearch}"</strong>
      </>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-6 px-6" data-testid="tools-card-picker">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div data-testid="tools-card-picker-search" className="max-w-[30ch] flex-1">
          <AgentSearchbar
            onSearch={setSearch}
            label="Search tools"
            placeholder="Search tools..."
            size="lg"
            debounceMs={0}
          />
        </div>

        <label
          data-testid="tools-only-selected-filter"
          className={cn(
            'inline-flex items-center gap-2 text-ui-xs text-neutral3 select-none cursor-pointer',
            !editable && 'cursor-not-allowed opacity-60',
          )}
        >
          <Checkbox
            checked={onlySelected}
            onCheckedChange={value => setOnlySelected(value === true)}
            disabled={!editable}
            data-testid="tools-only-selected-filter-checkbox"
            style={filterCheckboxStyle}
            className="h-3 w-3 shadow-none [&_svg]:h-2.5 [&_svg]:w-2.5 data-[state=checked]:shadow-none"
          />
          <span>Show only selected</span>
        </label>
      </div>

      {visibleTools.length === 0 ? (
        <ToolListEmptyState details={emptyStateDetails} />
      ) : (
        <div className="grid min-h-0 grid-cols-1 content-start gap-2 lg:gap-6 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {visibleTools.map(item => {
            const isIntegration = item.type === 'integration' && !!item.providerId && !!item.toolkit;
            const needsConnection = isIntegration && item.hasConnection === false;
            const showPicker = isIntegration && item.isChecked;
            const multipleAllowed = isIntegration
              ? (providerCapsById.get(item.providerId!)?.multipleConnectionsPerToolkit ?? false)
              : false;
            return (
              <div key={`${item.type}__${item.id}`} className="flex flex-col gap-2">
                <AgentSelectableCard
                  title={item.name}
                  subtitle={item.description || 'No description provided'}
                  isSelected={item.isChecked}
                  disabled={!editable}
                  onClick={() => toggle(item, !item.isChecked)}
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
                    onConnected={connectionId => {
                      // Pin the freshly-authorized connection only when the
                      // tool is already toggled on. If the user clicked
                      // Connect without selecting the tool, we leave the
                      // form untouched and let the picker handle pinning
                      // when they select it.
                      if (!item.isChecked) return;
                      const current = (getValues('toolProviders') ?? {}) as Record<
                        string,
                        {
                          tools?: Record<string, { toolkit: string; description?: string }>;
                          connections?: Record<string, ToolProviderConnectionFormValue[]>;
                        }
                      >;
                      const existing = current[item.providerId!] ?? { tools: {}, connections: {} };
                      const existingPinned = existing.connections?.[item.toolkit!] ?? [];
                      if (existingPinned.some(c => c.connectionId === connectionId)) return;
                      const nextConnections = {
                        ...(existing.connections ?? {}),
                        [item.toolkit!]: [
                          ...existingPinned,
                          {
                            kind: 'author' as const,
                            toolkit: item.toolkit!,
                            connectionId,
                            scope: 'per-author' as const,
                          },
                        ],
                      };
                      setValue(
                        'toolProviders',
                        {
                          ...current,
                          [item.providerId!]: { ...existing, connections: nextConnections },
                        } as never,
                        { shouldDirty: true },
                      );
                    }}
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
          })}
        </div>
      )}
    </div>
  );
};

interface ToolListEmptyStateProps {
  details: ReactNode;
}

const ToolListEmptyState = ({ details }: ToolListEmptyStateProps) => {
  return (
    <div className="flex min-h-0 items-center justify-center px-3 py-6">
      <Txt variant="ui-md" className="text-neutral3">
        {details}
      </Txt>
    </div>
  );
};

function getVisibleTools(availableAgentTools: AgentTool[], search: string, onlySelected: boolean) {
  const term = search.trim().toLowerCase();

  return availableAgentTools.filter(item => {
    if (onlySelected && !item.isChecked) return false;
    if (!term) return true;
    return item.name.toLowerCase().includes(term) || (item.description?.toLowerCase().includes(term) ?? false);
  });
}

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
