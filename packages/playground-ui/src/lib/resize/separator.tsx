import { Separator } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

export const PanelSeparator = () => {
  return (
    <Separator
      className={cn(
        'group/separator relative w-0 bg-transparent z-10',
        'focus:outline-hidden focus-visible:outline-hidden',
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-0 -left-1 -right-1', 'cursor-col-resize touch-none')}>
        <span
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'h-10 w-0.5 bg-surface5 pointer-events-none rounded-full',
            'transition-all duration-150 ease-out motion-reduce:transition-none',
            'group-hover/separator:h-12 group-hover/separator:w-1 group-hover/separator:bg-surface5',
            "group-data-[separator='hover']/separator:h-12 group-data-[separator='hover']/separator:w-1 group-data-[separator='hover']/separator:bg-surface5",
            "group-data-[separator='active']/separator:h-12 group-data-[separator='active']/separator:w-1 group-data-[separator='active']/separator:bg-accent1",
            'group-focus-visible/separator:h-12 group-focus-visible/separator:w-1 group-focus-visible/separator:bg-accent1',
          )}
        />
      </span>
    </Separator>
  );
};
