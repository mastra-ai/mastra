import { Separator } from 'react-resizable-panels';
import { ResizeHandleIndicator } from '@/ds/primitives/resize-handle-indicator';
import { cn } from '@/lib/utils';

export type PanelSeparatorProps = {
  /** `line` fits a visible container edge; `pill` floats when there is none. */
  variant?: 'line' | 'pill';
};

const stateClasses = {
  line: cn(
    'group-hover/separator:opacity-100',
    "group-data-[separator='hover']/separator:opacity-100",
    "group-data-[separator='active']/separator:via-gray-alpha-8 group-data-[separator='active']/separator:opacity-100",
    'group-focus-visible/separator:via-green-7 group-focus-visible/separator:opacity-100',
  ),
  pill: cn(
    'group-hover/separator:h-12 group-hover/separator:w-1',
    "group-data-[separator='hover']/separator:h-12 group-data-[separator='hover']/separator:w-1",
    "group-data-[separator='active']/separator:h-12 group-data-[separator='active']/separator:w-1 group-data-[separator='active']/separator:bg-green-7",
    'group-focus-visible/separator:bg-green-7',
  ),
};

export const PanelSeparator = ({ variant = 'line' }: PanelSeparatorProps) => {
  return (
    <Separator
      className={cn(
        'group/separator relative z-10 w-0 bg-transparent',
        'focus:outline-hidden focus-visible:outline-hidden',
      )}
    >
      {/* Hit zone wider than the 0px separator; indicator centered inside. */}
      <span
        aria-hidden
        className="absolute -inset-x-1 inset-y-0 flex cursor-col-resize touch-none items-center justify-center"
      >
        <ResizeHandleIndicator variant={variant} className={stateClasses[variant]} />
      </span>
    </Separator>
  );
};
