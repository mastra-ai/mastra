import { Txt } from '@mastra/playground-ui';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
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
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-6 px-6" data-testid="tools-card-picker">
      <div data-testid="tools-card-picker-search" className="shrink-0 max-w-[30ch]">
        <AgentSearchbar
          onSearch={setSearch}
          label="Search tools"
          placeholder="Search tools..."
          size="lg"
          debounceMs={0}
        />
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
        <div className="grid min-h-0 grid-cols-1 gap-2 lg:gap-6 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {visibleTools.map(item => (
            <AgentSelectableCard
              key={`${item.type}__${item.id}`}
              title={item.name}
              subtitle={item.description || 'No description provided'}
              isSelected={item.isChecked}
              disabled={!editable}
              onClick={() => toggle(item, !item.isChecked)}
              ariaLabel={item.name}
              testId={`tool-card-${item.type}-${item.id}`}
              checkTestId={`tool-card-check-${item.type}-${item.id}`}
            />
          ))}
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

function getVisibleTools(availableAgentTools: AgentTool[], search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return availableAgentTools;

  return availableAgentTools.filter(
    item => item.name.toLowerCase().includes(term) || (item.description?.toLowerCase().includes(term) ?? false),
  );
}
