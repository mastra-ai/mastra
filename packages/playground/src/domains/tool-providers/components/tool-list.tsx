import { Badge } from '@mastra/playground-ui/components/Badge';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useProviderTools } from '@mastra/react/hooks';
import { useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface ToolListProps {
  providerId: string;
  toolkit: string | undefined;
  selectedIds?: Set<string>;
  onToggle?: (id: string, description: string) => void;
}

export function ToolList({ providerId, toolkit, selectedIds, onToggle }: ToolListProps) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 300);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const { data, isLoading } = useProviderTools({
    providerId: providerId,
    params: {
      toolkit,
      search: search || undefined,
    },
    queryOptions: { enabled: !!providerId },
  });
  const tools = data?.data ?? [];

  return (
    <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden">
      <div className="border-b border-border px-3 py-2.5">
        <SearchInput
          label="Search tools"
          size="sm"
          placeholder="Search tools..."
          value={query}
          onValueChange={value => {
            setQuery(value);
            debouncedSearch(value);
          }}
        />
      </div>

      <ScrollArea className="h-full">
        <div className="flex flex-col gap-1 p-3">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5 p-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))
          ) : tools.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Txt variant="caption" tone="muted">
                No tools found
              </Txt>
            </div>
          ) : (
            tools.map(tool => {
              const toolId = `${providerId}:${tool.slug}`;
              const isSelected = selectedIds?.has(toolId) ?? false;

              return (
                <div
                  key={tool.slug}
                  role={onToggle ? 'button' : undefined}
                  tabIndex={onToggle ? 0 : undefined}
                  onClick={onToggle ? () => onToggle(toolId, tool.description || '') : undefined}
                  onKeyDown={
                    onToggle
                      ? e => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onToggle(toolId, tool.description || '');
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'state-layer flex items-start gap-3 rounded-md px-3 py-2.5',
                    onToggle && 'cursor-pointer',
                    isSelected && 'bg-fill-hover',
                  )}
                >
                  {onToggle && (
                    <div className="pt-0.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggle(toolId, tool.description || '')}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  )}

                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Txt variant="column" tone="ink">
                        {tool.name}
                      </Txt>
                      {toolkit === undefined && tool.toolkit && <Badge>{tool.toolkit}</Badge>}
                    </div>
                    {tool.description && (
                      <Txt variant="caption" tone="muted" className="line-clamp-2">
                        {tool.description}
                      </Txt>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
