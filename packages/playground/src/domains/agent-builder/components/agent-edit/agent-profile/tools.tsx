import { Checkbox, Txt, cn } from '@mastra/playground-ui';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
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

  const filterCheckboxStyle: CSSProperties | undefined = onlySelected
    ? {
        backgroundColor: agentColor.background,
        borderColor: agentColor.background,
        color: agentColor.foreground,
      }
    : undefined;

  const toggle = (item: AgentTool, next: boolean) => {
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

function getVisibleTools(availableAgentTools: AgentTool[], search: string, onlySelected: boolean) {
  const term = search.trim().toLowerCase();

  return availableAgentTools.filter(item => {
    if (onlySelected && !item.isChecked) return false;
    if (!term) return true;
    return item.name.toLowerCase().includes(term) || (item.description?.toLowerCase().includes(term) ?? false);
  });
}
