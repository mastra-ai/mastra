import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { transitions } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
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
            'rounded-md px-3 py-2 text-left text-ui-sm',
            transitions.colors,
            selectedToolkit === undefined
              ? 'bg-surface4 font-medium text-neutral6'
              : 'text-neutral3 hover:bg-surface4 hover:text-neutral5',
          )}
        >
          All
        </button>

        <button
          type="button"
          onClick={() => onSelectToolkit(SELECTED_TOOLKIT_SENTINEL)}
          className={cn(
            'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-ui-sm',
            transitions.colors,
            selectedToolkit === SELECTED_TOOLKIT_SENTINEL
              ? 'bg-surface4 font-medium text-neutral6'
              : 'text-neutral3 hover:bg-surface4 hover:text-neutral5',
          )}
        >
          Selected
          {selectedCount > 0 && (
            <span className="min-w-5 rounded-full bg-surface3 px-1.5 py-0.5 text-center text-ui-xs tabular-nums">
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
              'truncate rounded-md px-3 py-2 text-left text-ui-sm',
              transitions.colors,
              selectedToolkit === toolkit.slug
                ? 'bg-surface4 font-medium text-neutral6'
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
