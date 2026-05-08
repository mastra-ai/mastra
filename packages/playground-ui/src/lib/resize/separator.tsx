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
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 -left-1 -right-1 flex items-center justify-center',
          'cursor-col-resize touch-none',
        )}
      >
        <span
          className={cn(
            'block h-full w-px bg-border1 pointer-events-none',
            'transition-[width,background-color] duration-150 ease-out motion-reduce:transition-none',
            'group-hover/separator:w-0.5 group-hover/separator:bg-surface5',
            "group-data-[separator='hover']/separator:w-0.5 group-data-[separator='hover']/separator:bg-surface5",
            "group-data-[separator='active']/separator:w-0.5 group-data-[separator='active']/separator:bg-accent1",
            'group-focus-visible/separator:w-0.5 group-focus-visible/separator:bg-accent1',
          )}
        />
      </span>
    </Separator>
  );
};
