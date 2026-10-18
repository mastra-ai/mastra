import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useToolkits } from '@mastra/react/hooks/tool-providers';

export const SELECTED_TOOLKIT_SENTINEL = '__selected__';

interface ToolkitListProps {
  providerId: string;
  selectedToolkit: string | undefined;
  onSelectToolkit: (toolkit: string | undefined) => void;
  selectedCount?: number;
}

export function ToolkitList({ providerId, selectedToolkit, onSelectToolkit, selectedCount = 0 }: ToolkitListProps) {
  const { data, isLoading } = useToolkits({ providerId: providerId, queryOptions: { enabled: !!providerId } });
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
            'text-foreground',
            'rounded-md px-3 py-2 text-left',
            controlStateColorTransition,
            selectedToolkit === undefined ? 'bg-fill-hover' : cn(quietTextHover, 'hover:bg-fill-subtle'),
          )}
        >
          <Txt as="span" variant="column" className="block">
            All
          </Txt>
        </button>

        <button
          type="button"
          onClick={() => onSelectToolkit(SELECTED_TOOLKIT_SENTINEL)}
          className={cn(
            'text-foreground',
            'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left',
            controlStateColorTransition,
            selectedToolkit === SELECTED_TOOLKIT_SENTINEL
              ? 'bg-fill-hover'
              : cn(quietTextHover, 'hover:bg-fill-subtle'),
          )}
        >
          <Txt as="span" variant="column" className="block">
            Selected
          </Txt>
          {selectedCount > 0 && (
            <Txt
              as="span"
              variant="meta"
              className="min-w-[1.25rem] rounded-full bg-card px-1.5 py-0.5 text-center tabular-nums"
            >
              {selectedCount}
            </Txt>
          )}
        </button>

        {toolkits.map(toolkit => (
          <button
            key={toolkit.slug}
            type="button"
            onClick={() => onSelectToolkit(toolkit.slug)}
            title={toolkit.name}
            className={cn(
              'text-foreground',
              'truncate rounded-md px-3 py-2 text-left',
              controlStateColorTransition,
              selectedToolkit === toolkit.slug ? 'bg-fill-hover' : cn(quietTextHover, 'hover:bg-fill-subtle'),
            )}
          >
            <Txt as="span" variant="column" className="block">
              {toolkit.name}
            </Txt>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
