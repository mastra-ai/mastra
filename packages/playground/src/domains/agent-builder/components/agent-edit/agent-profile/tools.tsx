import { Searchbar, Txt, cn } from '@mastra/playground-ui';
import { Bot, Check, Plug, Workflow, Wrench } from 'lucide-react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useAgentColor } from '../../../contexts/agent-color-context';
import { needsConnectionSetup, useToolProvidersBridge } from '../../../hooks/use-tool-providers-bridge';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool } from '../../../types/agent-tool';

interface ToolsProps {
  editable?: boolean;
  availableAgentTools?: AgentTool[];
  /**
   * Called when an integration row's "Set up connection" button is clicked.
   * Parent is expected to switch the active tab to "Connections". Omit to
   * hide the pill (e.g. when the Connections tab itself is disabled).
   */
  onOpenConnections?: () => void;
}

export const Tools = ({ editable = true, availableAgentTools = [], onOpenConnections }: ToolsProps) => {
  const { setValue, getValues } = useFormContext<AgentBuilderEditFormValues>();
  const { addIntegrationTool, removeIntegrationTool } = useToolProvidersBridge();
  const toolProvidersValue = useWatch<AgentBuilderEditFormValues>({
    name: 'toolProviders',
  }) as AgentBuilderEditFormValues['toolProviders'];
  const [search, setSearch] = useState('');

  const toggle = (item: AgentTool, next: boolean) => {
    if (item.type === 'integration') {
      if (!item.providerId || !item.toolkit) return;
      if (next) {
        addIntegrationTool({
          providerId: item.providerId,
          toolkit: item.toolkit,
          toolSlug: item.name,
          description: item.description,
        });
      } else {
        removeIntegrationTool({ providerId: item.providerId, toolSlug: item.name });
      }
      return;
    }
    const fieldName = item.type === 'agent' ? 'agents' : item.type === 'workflow' ? 'workflows' : 'tools';
    const current = getValues(fieldName) ?? {};
    setValue(fieldName, { ...current, [item.id]: next }, { shouldDirty: true });
  };

  if (availableAgentTools.length === 0) {
    return <ToolListEmptyState details={'No tools available in this project'} />;
  }

  const visibleTools = getVisibleTools(availableAgentTools, search);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 p-4" data-testid="tools-card-picker">
      <div data-testid="tools-card-picker-search" className="shrink-0">
        <Searchbar onSearch={setSearch} label="Search tools" placeholder="Search tools..." size="sm" debounceMs={0} />
      </div>

      {visibleTools.length === 0 ? (
        <ToolListEmptyState
          details={
            <>
              No tools match <strong>"${search.trim()}"</strong>
            </>
          }
        />
      ) : (
        <div className="grid min-h-0 grid-cols-1 gap-1.5 lg:gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {visibleTools.map(item => (
            <ToolItem
              key={`${item.type}__${item.id}`}
              item={item}
              editable={editable}
              onToggle={toggle}
              needsSetup={needsConnectionSetup(item, toolProvidersValue)}
              onOpenConnections={onOpenConnections}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ToolItemProps {
  item: AgentTool;
  editable: boolean;
  onToggle: (item: AgentTool, next: boolean) => void;
  needsSetup?: boolean;
  onOpenConnections?: () => void;
}

const ToolItem = ({ item, editable, onToggle, needsSetup, onOpenConnections }: ToolItemProps) => {
  let Icon =
    item.type === 'agent' ? Bot : item.type === 'workflow' ? Workflow : item.type === 'integration' ? Plug : Wrench;
  const agentColor = useAgentColor();
  const hasAgentColor = agentColor !== null;
  const useAgentColors = item.isChecked && hasAgentColor;

  const containerStyle: CSSProperties | undefined = hasAgentColor
    ? {
        ['--agent-color-fg' as string]: agentColor.foreground,
        ...(item.isChecked ? { borderColor: agentColor.foreground } : null),
      }
    : undefined;

  const checkStyle: CSSProperties | undefined = useAgentColors
    ? {
        borderColor: agentColor.foreground,
        backgroundColor: agentColor.background,
        color: agentColor.foreground,
      }
    : undefined;

  const showSetup = needsSetup && Boolean(onOpenConnections);
  const handleSetupClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Sibling button — stopPropagation guards against synthetic event bubbling
    // up to the row toggle button if the layout is ever reparented.
    event.stopPropagation();
    onOpenConnections?.();
  };

  const row = (
    <button
      key={`${item.type}__${item.id}`}
      type="button"
      onClick={() => onToggle(item, !item.isChecked)}
      disabled={!editable}
      aria-pressed={item.isChecked}
      aria-label={item.name}
      data-testid={`tool-card-${item.type}-${item.id}`}
      style={containerStyle}
      className={cn(
        'flex items-center gap-3 rounded-md border bg-surface3 px-3 py-2.5 text-left transition-colors',
        hasAgentColor
          ? 'focus-visible:!border-[var(--agent-color-fg)] focus-visible:outline-none'
          : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1',
        item.isChecked
          ? useAgentColors
            ? 'bg-surface4'
            : 'border-accent1 bg-surface4 ring-1 ring-accent1'
          : 'border-border1',
        !editable && 'cursor-not-allowed opacity-60',
      )}
    >
      <Icon className="h-5 w-5 shrink-0 text-neutral3" aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col">
        <Txt variant="ui-sm" className="truncate font-medium text-neutral6">
          {item.name}
        </Txt>
        {item.description && (
          <Txt variant="ui-xs" className="truncate text-neutral3" title={item.description}>
            {item.description}
          </Txt>
        )}
      </div>

      <span
        aria-hidden="true"
        data-testid={`tool-card-check-${item.type}-${item.id}`}
        style={checkStyle}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          item.isChecked
            ? useAgentColors
              ? ''
              : 'border-accent1 bg-accent1 text-surface1'
            : 'border-border1 bg-transparent',
        )}
      >
        {item.isChecked && <Check className="h-3 w-3" />}
      </span>
    </button>
  );

  if (!showSetup) return row;

  return (
    <div className="flex flex-col gap-1">
      {row}
      <button
        type="button"
        onClick={handleSetupClick}
        data-testid={`tool-card-setup-${item.providerId}-${item.name}`}
        className="ml-11 self-start rounded border border-warning bg-transparent px-2 py-0.5 text-xs text-warning hover:bg-warning/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning"
      >
        Set up connection
      </button>
    </div>
  );
};

interface ToolListEmptyStateProps {
  details: ReactNode;
}

const ToolListEmptyState = ({ details }: ToolListEmptyStateProps) => {
  return (
    <div className="flex min-h-0 items-center justify-center px-3 py-6">
      <Txt variant="ui-sm" className="text-neutral3">
        {details}
      </Txt>
    </div>
  );
};

function getVisibleTools(availableAgentTools: AgentTool[], search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return availableAgentTools;

  return availableAgentTools.filter(
    item => item.name.toLowerCase().includes(term) || (item.description?.toLowerCase().includes(term) ?? false),
  );
}
