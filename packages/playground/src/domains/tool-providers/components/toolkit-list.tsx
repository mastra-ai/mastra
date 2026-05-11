import { ScrollArea, Skeleton, transitions, cn } from '@mastra/playground-ui';
import { useToolkits } from '../hooks/use-toolkits';

export const SELECTED_TOOLKIT_SENTINEL = '__selected__';

interface ToolkitListProps {
  providerId: string;
  selectedToolkit: string | undefined;
  onSelectToolkit: (toolkit: string | undefined) => void;
  selectedCount?: number;
}

export function ToolkitList({ providerId, selectedToolkit, onSelectToolkit, selectedCount = 0 }: ToolkitListProps) {
  const { data, isLoading } = useToolkits(providerId);
  const toolkits = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-0.5 p-3">
        <button
          type="button"
          onClick={() => onSelectToolkit(undefined)}
          className={cn(
            'text-left px-3 py-2 rounded-md text-ui-sm',
            transitions.colors,
            selectedToolkit === undefined
              ? 'bg-surface4 text-neutral6 font-medium'
              : 'text-neutral3 hover:bg-surface4 hover:text-neutral5',
          )}
        >
          All
        </button>

        <button
          type="button"
          onClick={() => onSelectToolkit(SELECTED_TOOLKIT_SENTINEL)}
          className={cn(
            'text-left px-3 py-2 rounded-md text-ui-sm flex items-center justify-between gap-2',
            transitions.colors,
            selectedToolkit === SELECTED_TOOLKIT_SENTINEL
              ? 'bg-surface4 text-neutral6 font-medium'
              : 'text-neutral3 hover:bg-surface4 hover:text-neutral5',
          )}
        >
          Selected
          {selectedCount > 0 && (
            <span className="text-ui-xs tabular-nums bg-surface3 rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
              {selectedCount}
            </span>
          )}
        </button>

        {toolkits.map(toolkit => (
          <button
            key={toolkit.slug}
            type="button"
            onClick={() => onSelectToolkit(toolkit.slug)}
            className={cn(
              'text-left px-3 py-2 rounded-md text-ui-sm truncate',
              transitions.colors,
              selectedToolkit === toolkit.slug
                ? 'bg-surface4 text-neutral6 font-medium'
                : 'text-neutral3 hover:bg-surface4 hover:text-neutral5',
            )}
            title={toolkit.name}
          >
            {toolkit.name}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
