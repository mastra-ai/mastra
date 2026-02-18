import { useState } from 'react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Searchbar, SearchbarWrapper } from '@/ds/components/Searchbar';
import { Badge } from '@/ds/components/Badge';
import { Skeleton } from '@/ds/components/Skeleton';
import { Checkbox } from '@/ds/components/Checkbox';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

import { useProviderTools } from '../hooks/use-provider-tools';

interface ToolListProps {
  providerId: string;
  toolkit: string | undefined;
  selectedIds?: Set<string>;
  onToggle?: (id: string, description: string) => void;
}

export function ToolList({ providerId, toolkit, selectedIds, onToggle }: ToolListProps) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useProviderTools(providerId, {
    toolkit,
    search: search || undefined,
  });
  const tools = data?.data ?? [];

  return (
    <div className="grid grid-rows-[auto_1fr] h-full overflow-hidden">
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search tools" placeholder="Search tools..." size="sm" />
      </SearchbarWrapper>

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
            <div className="flex items-center justify-center py-12">
              <Txt variant="ui-sm" className="text-neutral3">
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
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onToggle(toolId, tool.description || '');
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'flex items-start gap-3 rounded-md px-3 py-2.5',
                    onToggle ? 'cursor-pointer hover:bg-surface4' : 'hover:bg-surface4',
                    isSelected && 'bg-surface4',
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

                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Txt variant="ui-sm" className="text-neutral6 font-medium">
                        {tool.name}
                      </Txt>
                      {toolkit === undefined && tool.toolkit && <Badge>{tool.toolkit}</Badge>}
                    </div>
                    {tool.description && (
                      <Txt variant="ui-sm" className="text-neutral3 line-clamp-2">
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
