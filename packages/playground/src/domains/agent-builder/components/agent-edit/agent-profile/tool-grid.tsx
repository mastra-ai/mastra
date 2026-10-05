import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { CSSProperties, ReactNode } from 'react';
import { useAgentColor } from '../../../contexts/agent-color-context';
import type { AgentTool } from '../../../types/agent-tool';
import { ToolCard } from './tool-card';

interface ToolGridProps {
  tools: AgentTool[];
  editable: boolean;
  onlySelected: boolean;
  onOnlySelectedChange: (next: boolean) => void;
  search: string;
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
  search,
  onSearch,
  emptyStateDetails,
  onToggle,
}: ToolGridProps) => {
  const agentColor = useAgentColor();
  const filterCheckboxStyle: CSSProperties | undefined = onlySelected
    ? {
        backgroundColor: agentColor.tint,
        borderColor: agentColor.tint,
        color: 'var(--background)',
      }
    : undefined;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 px-4 py-4">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <SearchInput
          label="Search tools"
          size="md"
          className="max-w-[30ch] flex-1"
          data-testid="tools-card-picker-search"
          placeholder="Search tools..."
          value={search}
          onValueChange={onSearch}
        />

        <Field
          orientation="horizontal"
          disabled={!editable}
          data-testid="tools-only-selected-filter"
          className="inline-flex select-none data-disabled:opacity-60"
        >
          <Checkbox
            checked={onlySelected}
            onCheckedChange={value => onOnlySelectedChange(value === true)}
            data-testid="tools-only-selected-filter-checkbox"
            style={filterCheckboxStyle}
            className="h-3 w-3 shadow-none data-[state=checked]:shadow-none [&_svg]:h-2.5 [&_svg]:w-2.5"
          />
          <FieldLabel className="text-muted-foreground text-meta">Show only selected</FieldLabel>
        </Field>
      </div>

      {tools.length === 0 ? (
        <ToolListEmptyState details={emptyStateDetails} />
      ) : (
        <div className="grid min-h-0 grid-cols-1 content-start gap-2 overflow-y-auto 2xl:grid-cols-3 sm:grid-cols-2 lg:gap-4">
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
    <div className="flex min-h-0 items-center justify-center px-3 py-4">
      <Txt variant="body" tone="muted">
        {details}
      </Txt>
    </div>
  );
};
