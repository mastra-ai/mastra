import { Checkbox, ScrollArea, Txt, cn } from '@mastra/playground-ui';
import { useMemo } from 'react';

interface SelectedToolListProps {
  providerId: string;
  selectedTools: Map<string, string>;
  onToggle?: (id: string, description: string) => void;
}

export function SelectedToolList({ providerId, selectedTools, onToggle }: SelectedToolListProps) {
  const tools = useMemo(() => {
    const result: { id: string; slug: string; description: string }[] = [];
    for (const [id, description] of selectedTools) {
      const sep = id.indexOf(':');
      if (sep === -1) continue;
      if (id.slice(0, sep) !== providerId) continue;
      result.push({ id, slug: id.slice(sep + 1), description });
    }
    return result;
  }, [selectedTools, providerId]);

  if (tools.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Txt variant="ui-sm" className="text-neutral3">
          No tools selected
        </Txt>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1 p-3">
        {tools.map(tool => (
          <div
            key={tool.id}
            role={onToggle ? 'button' : undefined}
            tabIndex={onToggle ? 0 : undefined}
            onClick={onToggle ? () => onToggle(tool.id, tool.description) : undefined}
            onKeyDown={
              onToggle
                ? e => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggle(tool.id, tool.description);
                    }
                  }
                : undefined
            }
            className={cn('flex items-start gap-3 rounded-md px-3 py-2.5 bg-surface4', onToggle && 'cursor-pointer')}
          >
            {onToggle && (
              <div className="pt-0.5">
                <Checkbox
                  checked
                  onCheckedChange={() => onToggle(tool.id, tool.description)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
            )}

            <div className="flex flex-col gap-1 min-w-0">
              <Txt variant="ui-sm" className="text-neutral6 font-medium">
                {tool.slug}
              </Txt>
              {tool.description && (
                <Txt variant="ui-sm" className="text-neutral3 line-clamp-2">
                  {tool.description}
                </Txt>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
