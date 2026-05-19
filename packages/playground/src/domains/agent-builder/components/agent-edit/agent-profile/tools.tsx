import { Searchbar, Txt, cn } from '@mastra/playground-ui';
import { Bot, Check, Workflow, Wrench } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useAgentColor } from '../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool } from '../../../types/agent-tool';

interface ToolsProps {
  editable?: boolean;
  availableAgentTools?: AgentTool[];
}

export const Tools = ({ editable = true, availableAgentTools = [] }: ToolsProps) => {
  const { setValue, getValues } = useFormContext<AgentBuilderEditFormValues>();
  const [search, setSearch] = useState('');

  const toggle = (item: AgentTool, next: boolean) => {
    const fieldName = item.type === 'agent' ? 'agents' : item.type === 'workflow' ? 'workflows' : 'tools';
    const current = getValues(fieldName) ?? {};
    setValue(fieldName, { ...current, [item.id]: next }, { shouldDirty: true });
  };

  if (availableAgentTools.length === 0) {
    return <ToolListEmptyState details={'No tools available in this project'} />;
  }

  const visibleTools = getVisibleTools(availableAgentTools, search);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 px-3" data-testid="tools-card-picker">
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
            <ToolItem key={`${item.type}__${item.id}`} item={item} editable={editable} onToggle={toggle} />
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
}

const ToolItem = ({ item, editable, onToggle }: ToolItemProps) => {
  let Icon = item.type === 'agent' ? Bot : item.type === 'workflow' ? Workflow : Wrench;
  const agentColor = useAgentColor();
  const hasAgentColor = agentColor !== null;
  const useAgentColors = item.isChecked && hasAgentColor;

  const containerStyle: CSSProperties | undefined = hasAgentColor
    ? {
        ['--agent-color-bg' as string]: agentColor.background,
        ...(item.isChecked ? { borderColor: agentColor.background } : null),
      }
    : undefined;

  const checkStyle: CSSProperties | undefined = useAgentColors
    ? {
        borderColor: agentColor.background,
        backgroundColor: agentColor.background,
        color: agentColor.foreground,
      }
    : undefined;

  return (
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
          ? 'focus-visible:!border-[var(--agent-color-bg)] focus-visible:outline-none'
          : 'hover:bg-surface4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1',
        hasAgentColor && 'hover:bg-surface4',
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
