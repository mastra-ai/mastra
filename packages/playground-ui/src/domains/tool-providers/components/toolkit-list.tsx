import { ScrollArea } from '@/ds/components/ScrollArea';
import { Skeleton } from '@/ds/components/Skeleton';
import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';

import { useToolkits } from '../hooks/use-toolkits';

interface ToolkitListProps {
  providerId: string;
  selectedToolkit: string | undefined;
  onSelectToolkit: (toolkit: string | undefined) => void;
}

export function ToolkitList({ providerId, selectedToolkit, onSelectToolkit }: ToolkitListProps) {
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
