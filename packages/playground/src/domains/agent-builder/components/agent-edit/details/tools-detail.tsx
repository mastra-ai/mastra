import { Searchbar, Txt, cn } from '@mastra/playground-ui';
import { Bot, Check, Workflow, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool, AgentToolType } from '../../../types/agent-tool';

interface ToolsDetailProps {
  editable?: boolean;
  availableAgentTools?: AgentTool[];
}

function getToolIcon(type: AgentToolType) {
  if (type === 'agent') return Bot;
  if (type === 'workflow') return Workflow;
  return Wrench;
}

export const ToolsDetail = ({ editable = true, availableAgentTools = [] }: ToolsDetailProps) => {
  const { setValue, getValues } = useFormContext<AgentBuilderEditFormValues>();

  const [search, setSearch] = useState('');

  const toggle = (item: AgentTool, next: boolean) => {
    const fieldName = item.type === 'agent' ? 'agents' : item.type === 'workflow' ? 'workflows' : 'tools';
    const current = getValues(fieldName) ?? {};
    setValue(fieldName, { ...current, [item.id]: next }, { shouldDirty: true });
  };

  const visibleTools = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return availableAgentTools;
    return availableAgentTools.filter(
      item => item.name.toLowerCase().includes(term) || (item.description?.toLowerCase().includes(term) ?? false),
    );
  }, [availableAgentTools, search]);

  if (availableAgentTools.length === 0) {
    return (
      <div className="p-4">
        <Txt variant="ui-sm" className="text-neutral3">
          No tools available in this project.
        </Txt>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 p-4" data-testid="tools-card-picker">
      <div data-testid="tools-card-picker-search" className="shrink-0">
        <Searchbar onSearch={setSearch} label="Search tools" placeholder="Search tools..." size="sm" debounceMs={0} />
      </div>

      {visibleTools.length === 0 ? (
        <div className="flex min-h-0 items-center justify-center px-3 py-6">
          <Txt variant="ui-sm" className="text-neutral3">
            {`No tools match "${search.trim()}"`}
          </Txt>
        </div>
      ) : (
        <div className="grid min-h-0 grid-cols-1 gap-1.5 lg:gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {visibleTools.map(item => {
            const Icon = getToolIcon(item.type);
            return (
              <button
                key={`${item.type}__${item.id}`}
                type="button"
                onClick={() => toggle(item, !item.isChecked)}
                disabled={!editable}
                aria-pressed={item.isChecked}
                aria-label={item.name}
                data-testid={`tool-card-${item.type}-${item.id}`}
                className={cn(
                  'flex items-center gap-3 rounded-md border bg-surface3 px-3 py-2.5 text-left transition-colors',
                  'hover:bg-surface4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1',
                  item.isChecked ? 'border-accent1 bg-surface4 ring-1 ring-accent1' : 'border-border1',
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
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    item.isChecked ? 'border-accent1 bg-accent1 text-surface1' : 'border-border1 bg-transparent',
                  )}
                >
                  {item.isChecked && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
