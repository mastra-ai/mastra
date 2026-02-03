import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/ds/components/Checkbox';
import { Txt } from '@/ds/components/Txt/Txt';
import { cn } from '@/lib/utils';
import { Searchbar, SearchbarWrapper } from '@/ds/components/Searchbar';
import { EmptyState } from '@/ds/components/EmptyState';
import { ToolCoinIcon } from '@/ds/icons/ToolCoinIcon';
import { Button } from '@/ds/components/Button';

import type { ProviderTool } from '../types';

export interface ToolSelectorProps {
  /** Array of tools to display (from selected toolkits) */
  tools?: ProviderTool[];
  /** Whether the tools are currently loading */
  isLoading?: boolean;
  /** Set of tool slugs that are currently selected (all selected by default) */
  selectedTools?: Set<string>;
  /** Callback when tool selection changes */
  onSelectionChange?: (selectedSlugs: Set<string>) => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Displays tools grouped by toolkit with the ability to deselect individual tools.
 * Used in the Add Tools dialog after toolkit selection to allow fine-grained tool control.
 *
 * @example
 * ```tsx
 * const [selectedTools, setSelectedTools] = useState(new Set<string>());
 * const { data: tools, isLoading } = useProviderTools('composio', {
 *   toolkitSlugs: ['github', 'slack']
 * });
 *
 * <ToolSelector
 *   tools={tools?.tools}
 *   isLoading={isLoading}
 *   selectedTools={selectedTools}
 *   onSelectionChange={setSelectedTools}
 * />
 * ```
 */
export function ToolSelector({
  tools = [],
  isLoading = false,
  selectedTools = new Set(),
  onSelectionChange,
  className,
}: ToolSelectorProps) {
  const [search, setSearch] = useState('');

  // Filter tools by search
  const filteredTools = tools.filter((tool) => {
    if (search === '') return true;
    const searchLower = search.toLowerCase();
    return (
      tool.name.toLowerCase().includes(searchLower) ||
      tool.description?.toLowerCase().includes(searchLower) ||
      tool.toolkit?.toLowerCase().includes(searchLower)
    );
  });

  // Group tools by toolkit
  const toolsByToolkit = useMemo(() => {
    const groups = new Map<string, ProviderTool[]>();
    filteredTools.forEach((tool) => {
      const toolkit = tool.toolkit || 'Uncategorized';
      const existing = groups.get(toolkit) || [];
      groups.set(toolkit, [...existing, tool]);
    });
    // Sort toolkits alphabetically
    return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [filteredTools]);

  const handleToggleTool = (toolSlug: string) => {
    if (!onSelectionChange) return;

    const newSelection = new Set(selectedTools);
    if (newSelection.has(toolSlug)) {
      newSelection.delete(toolSlug);
    } else {
      newSelection.add(toolSlug);
    }
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(new Set(filteredTools.map((t) => t.slug)));
  };

  const handleClearSelection = () => {
    if (!onSelectionChange) return;
    onSelectionChange(new Set());
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-icon3" />
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className={cn('py-8', className)}>
        <EmptyState
          iconSlot={<ToolCoinIcon />}
          titleSlot="No tools available"
          descriptionSlot="Select toolkits in the previous step to see available tools."
          actionSlot={null}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Search bar */}
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search tools" placeholder="Search by name or description" />
      </SearchbarWrapper>

      {/* Selection controls */}
      <div className="border-border1 flex items-center justify-between border-b px-4 py-2">
        <Txt variant="ui-sm" className="text-icon3">
          {selectedTools.size} of {filteredTools.length} selected
        </Txt>
        <div className="flex gap-2">
          <Button variant="ghost" size="md" onClick={handleSelectAll} disabled={!onSelectionChange}>
            Select all
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={handleClearSelection}
            disabled={!onSelectionChange || selectedTools.size === 0}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Tools grouped by toolkit */}
      {filteredTools.length === 0 ? (
        <div className="py-12">
          <EmptyState
            iconSlot={<ToolCoinIcon />}
            titleSlot="No tools found"
            descriptionSlot={`No tools match "${search}". Try a different search term.`}
            actionSlot={null}
          />
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {Array.from(toolsByToolkit.entries()).map(([toolkit, toolsList]) => (
            <div key={toolkit} className="space-y-3">
              {/* Toolkit header */}
              <div className="flex items-center justify-between">
                <Txt variant="ui-md" className="text-icon6 font-medium">
                  {toolkit}
                </Txt>
                <Txt variant="ui-xs" className="text-icon3">
                  {toolsList.length} {toolsList.length === 1 ? 'tool' : 'tools'}
                </Txt>
              </div>

              {/* Tools in this toolkit */}
              <div className="space-y-2">
                {toolsList.map((tool) => (
                  <ToolRow
                    key={tool.slug}
                    tool={tool}
                    isSelected={selectedTools.has(tool.slug)}
                    onToggle={onSelectionChange ? () => handleToggleTool(tool.slug) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ToolRowProps {
  tool: ProviderTool;
  isSelected: boolean;
  onToggle?: () => void;
}

function ToolRow({ tool, isSelected, onToggle }: ToolRowProps) {
  return (
    <div
      className={cn(
        'border-border1 bg-surface3 flex items-start gap-3 rounded-lg border p-3 transition-colors',
        onToggle && 'cursor-pointer hover:border-border2 hover:bg-surface4',
        isSelected && 'border-accent1 bg-surface4',
      )}
      onClick={onToggle}
      role={onToggle ? 'button' : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onKeyDown={
        onToggle
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
    >
      {/* Checkbox */}
      {onToggle && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5"
        />
      )}

      {/* Tool info */}
      <div className="flex-1 space-y-1">
        <Txt variant="ui-md" className="text-icon6 font-medium">
          {tool.name}
        </Txt>
        {tool.description && (
          <Txt variant="ui-sm" className="text-icon3 line-clamp-2">
            {tool.description}
          </Txt>
        )}
      </div>

      {/* Tool icon */}
      <ToolCoinIcon className="h-5 w-5 text-icon3 flex-shrink-0" />
    </div>
  );
}
