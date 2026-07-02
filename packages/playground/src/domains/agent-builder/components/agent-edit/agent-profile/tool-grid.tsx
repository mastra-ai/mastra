import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@mastra/playground-ui/components/InputGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { SearchIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useAgentColor } from '../../../contexts/agent-color-context';
import type { AgentTool } from '../../../types/agent-tool';
import { ToolCard } from './tool-card';

interface ToolGridProps {
  tools: AgentTool[];
  editable: boolean;
  onlySelected: boolean;
  onOnlySelectedChange: (next: boolean) => void;
  onSearch: (value: string) => void;
  emptyStateDetails: ReactNode;
  onToggle: (item: AgentTool, next: boolean) => void;
}

/**
 * Right pane of the tool picker: search box, "Show only selected" toggle, and
 * the responsive grid of tool cards (or the empty state).
 */
export const ToolGrid = ({
  tools,
  editable,
  onlySelected,
  onOnlySelectedChange,
  onSearch,
  emptyStateDetails,
  onToggle,
}: ToolGridProps) => {
  const agentColor = useAgentColor();
  const filterCheckboxStyle: CSSProperties | undefined = onlySelected
    ? {
        backgroundColor: agentColor.background,
        borderColor: agentColor.background,
        color: agentColor.foreground,
      }
    : undefined;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-6 px-6 py-6">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div data-testid="tools-card-picker-search" className="max-w-[30ch] flex-1 rounded-full bg-surface3">
          <InputGroup variant="outline" size="lg">
            <InputGroupAddon align="inline-start">
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="Search tools"
              placeholder="Search tools..."
              onChange={event => onSearch(event.target.value)}
            />
          </InputGroup>
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
            onCheckedChange={value => onOnlySelectedChange(value === true)}
            disabled={!editable}
            data-testid="tools-only-selected-filter-checkbox"
            style={filterCheckboxStyle}
            className="h-3 w-3 shadow-none [&_svg]:h-2.5 [&_svg]:w-2.5 data-[state=checked]:shadow-none"
          />
          <span>Show only selected</span>
        </label>
      </div>

      {tools.length === 0 ? (
        <ToolListEmptyState details={emptyStateDetails} />
      ) : (
        <div className="grid min-h-0 grid-cols-1 content-start gap-2 lg:gap-6 overflow-y-auto sm:grid-cols-2 2xl:grid-cols-3">
          {tools.map(item => (
            <ToolCard key={`${item.type}__${item.id}`} item={item} editable={editable} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
};

interface ToolListEmptyStateProps {
  details: ReactNode;
}

export const ToolListEmptyState = ({ details }: ToolListEmptyStateProps) => {
  return (
    <div className="flex min-h-0 items-center justify-center px-3 py-6">
      <Txt variant="ui-md" className="text-neutral3">
        {details}
      </Txt>
    </div>
  );
};
