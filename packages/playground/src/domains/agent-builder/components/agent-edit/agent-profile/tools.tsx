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
import { FilterableList } from './filterable-list';

interface ToolsProps {
  editable?: boolean;
  availableAgentTools?: AgentTool[];
}

// Sentinel id for the synthetic "Built-in" toolkit entry that groups all
// native tools/agents/workflows in the left filter pane. Chosen so it can
// never collide with a real Composio toolkit slug.
const BUILT_IN_TOOLKIT_ID = '__built-in__';

const toolkitOf = (item: AgentTool): string =>
  item.type === 'integration' && item.toolkit ? item.toolkit : BUILT_IN_TOOLKIT_ID;

export const Tools = ({ editable = true, availableAgentTools = [] }: ToolsProps) => {
  const { setValue, getValues } = useFormContext<AgentBuilderEditFormValues>();
  const agentColor = useAgentColor();
  const [search, setSearch] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const [selectedToolkits, setSelectedToolkits] = useState<Set<string> | null>(null);

  // One left-pane entry per distinct integration toolkit, plus a single
  // "Built-in" entry covering native tools/agents/workflows (only when any
  // native item exists). All toolkits are checked by default (`null`).
  const toolkitOptions = useMemo(() => {
    const integrations = new Set<string>();
    let hasBuiltIn = false;
    for (const item of availableAgentTools) {
      if (item.type === 'integration' && item.toolkit) {
        integrations.add(item.toolkit);
      } else {
        hasBuiltIn = true;
      }
    }
    const entries = Array.from(integrations)
      .sort((a, b) => a.localeCompare(b))
      .map(toolkit => ({ id: toolkit, label: toolkit }));
    if (hasBuiltIn) {
      entries.unshift({ id: BUILT_IN_TOOLKIT_ID, label: 'Built-in' });
    }
    return entries;
  }, [availableAgentTools]);

  const isToolkitChecked = (id: string) => selectedToolkits === null || selectedToolkits.has(id);

  const handleToggleToolkit = (id: string) => {
    setSelectedToolkits(prev => {
      const base = prev ?? new Set(toolkitOptions.map(t => t.id));
      const next = new Set(base);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllToolkits = () => {
    setSelectedToolkits(new Set(toolkitOptions.map(t => t.id)));
  };

  const handleClearAllToolkits = () => {
    setSelectedToolkits(new Set());
  };

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

  const visibleTools = getVisibleTools(availableAgentTools, search, onlySelected, selectedToolkits);
  const trimmedSearch = search.trim();
  const allToolkitsUnchecked = selectedToolkits !== null && selectedToolkits.size === 0;

  let emptyStateDetails: ReactNode;
  if (allToolkitsUnchecked) {
    emptyStateDetails = 'Select at least one toolkit to see tools';
  } else if (onlySelected && trimmedSearch === '') {
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
    <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)]" data-testid="tools-card-picker">
      {toolkitOptions.length > 0 && (
        <FilterableList
          title="Toolkits"
          items={toolkitOptions}
          isChecked={isToolkitChecked}
          onToggle={handleToggleToolkit}
          onSelectAll={handleSelectAllToolkits}
          onClearAll={handleClearAllToolkits}
          disabled={!editable}
          testIdPrefix="tools-toolkit"
        />
      )}

      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-6 px-6 py-6">
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
          <div className="grid min-h-0 grid-cols-1 content-start gap-2 lg:gap-6 overflow-y-auto sm:grid-cols-2 2xl:grid-cols-3">
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
                        // Clicking Connect on a tool card means "I want this
                        // tool with this connection". Check the tool if it
                        // isn't already, and pin the freshly-authorized
                        // connection so the user doesn't have to open the
                        // picker afterwards.
                        const current = (getValues('toolProviders') ?? {}) as Record<
                          string,
                          {
                            tools?: Record<string, { toolkit: string; description?: string }>;
                            connections?: Record<string, ToolProviderConnectionFormValue[]>;
                          }
                        >;
                        const existing = current[item.providerId!] ?? { tools: {}, connections: {} };
                        const nextTools = { ...(existing.tools ?? {}) };
                        if (!nextTools[item.name]) {
                          nextTools[item.name] = {
                            toolkit: item.toolkit!,
                            ...(item.description ? { description: item.description } : {}),
                          };
                        }
                        const existingPinned = existing.connections?.[item.toolkit!] ?? [];
                        const alreadyPinned = existingPinned.some(c => c.connectionId === connectionId);
                        const nextPinned = alreadyPinned
                          ? existingPinned
                          : [
                              ...existingPinned,
                              {
                                kind: 'author' as const,
                                toolkit: item.toolkit!,
                                connectionId,
                                scope: 'per-author' as const,
                              },
                            ];
                        const nextConnections = {
                          ...(existing.connections ?? {}),
                          [item.toolkit!]: nextPinned,
                        };
                        setValue(
                          'toolProviders',
                          {
                            ...current,
                            [item.providerId!]: { ...existing, tools: nextTools, connections: nextConnections },
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

function getVisibleTools(
  availableAgentTools: AgentTool[],
  search: string,
  onlySelected: boolean,
  selectedToolkits: Set<string> | null,
) {
  const term = search.trim().toLowerCase();

  return availableAgentTools.filter(item => {
    if (selectedToolkits !== null && !selectedToolkits.has(toolkitOf(item))) return false;
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
