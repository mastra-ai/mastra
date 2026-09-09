import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip/tooltip';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type TabProps = {
  children: React.ReactNode;
  value: string;
  onClick?: () => void;
  onClose?: () => void;
  disabled?: boolean;
  attention?: boolean;
  disabledTooltip?: React.ReactNode;
  className?: string;
};

export const Tab = ({
  children,
  value,
  onClick,
  onClose,
  disabled,
  disabledTooltip,
  attention = false,
  className,
}: TabProps) => {
  const tab = (
    <BaseTabs.Tab
      value={value}
      disabled={disabled}
      data-slot="tab"
      className={cn(
        'text-ui-md font-normal text-neutral3',
        attention && 'relative',
        'flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap outline-none',
        transitions.colors,
        focusRing.visible,
        'hover:text-neutral4',
        'data-[active]:text-neutral5',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-neutral3',
        'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:text-neutral3',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:hover:text-neutral3',
        // Line variant legacy fallback — active state drawn by <Tabs.Indicator> in TabList
        'group-data-[appearance=default]/tabs:group-data-[variant=line]/tabs-list:px-5 group-data-[appearance=default]/tabs:group-data-[variant=line]/tabs-list:py-2',
        'group-data-[appearance=default]/tabs:group-data-[variant=line]/tabs-list:border-b-2 group-data-[appearance=default]/tabs:group-data-[variant=line]/tabs-list:border-transparent',
        // Pill variant
        'group-data-[appearance=default]/tabs:group-data-[variant=pill]/tabs-list:relative group-data-[appearance=default]/tabs:group-data-[variant=pill]/tabs-list:z-10',
        'group-data-[appearance=default]/tabs:group-data-[variant=pill]/tabs-list:px-3 group-data-[appearance=default]/tabs:group-data-[variant=pill]/tabs-list:py-1',
        'group-data-[appearance=default]/tabs:group-data-[variant=pill]/tabs-list:rounded-full',
        // Pill-ghost variant (pill without list background)
        'group-data-[appearance=default]/tabs:group-data-[variant=pill-ghost]/tabs-list:relative group-data-[appearance=default]/tabs:group-data-[variant=pill-ghost]/tabs-list:z-10',
        'group-data-[appearance=default]/tabs:group-data-[variant=pill-ghost]/tabs-list:px-3 group-data-[appearance=default]/tabs:group-data-[variant=pill-ghost]/tabs-list:py-1',
        'group-data-[appearance=default]/tabs:group-data-[variant=pill-ghost]/tabs-list:rounded-full',
        'group-data-[appearance=contained]/tabs:relative group-data-[appearance=contained]/tabs:z-10 group-data-[appearance=contained]/tabs:mb-0 group-data-[appearance=contained]/tabs:min-h-9 group-data-[appearance=contained]/tabs:rounded-t-lg group-data-[appearance=contained]/tabs:border group-data-[appearance=contained]/tabs:border-border1 group-data-[appearance=contained]/tabs:bg-surface4 group-data-[appearance=contained]/tabs:px-4 group-data-[appearance=contained]/tabs:py-1.5 group-data-[appearance=contained]/tabs:not-first:-ml-px pointer-coarse:group-data-[appearance=contained]/tabs:min-h-11',
        'group-data-[appearance=contained]/tabs:hover:bg-surface3 group-data-[appearance=contained]/tabs:data-[active]:z-20 group-data-[appearance=contained]/tabs:data-[active]:border-b-surface2 group-data-[appearance=contained]/tabs:data-[active]:bg-surface2',
        'group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:rounded-[calc(var(--radius-xl)-4px)] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:border-0 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:bg-transparent group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:shadow-none group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:not-first:ml-0 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:hover:bg-transparent group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:data-[active]:bg-transparent',
        "group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:first:before:hidden group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:before:pointer-events-none group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:before:absolute group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:before:right-full group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:before:bottom-[-2px] group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:before:size-2.5 group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:before:bg-[radial-gradient(circle_at_top_left,transparent_9px,var(--border1)_9px,var(--border1)_10px,var(--surface2)_10px),radial-gradient(circle_at_top_left,transparent_9px,var(--surface2)_9px)] group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:before:content-[''] group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:after:pointer-events-none group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:after:absolute group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:after:bottom-[-2px] group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:after:left-full group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:after:size-2.5 group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:after:bg-[radial-gradient(circle_at_top_right,transparent_9px,var(--border1)_9px,var(--border1)_10px,var(--surface2)_10px),radial-gradient(circle_at_top_right,transparent_9px,var(--surface2)_9px)] group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:data-[active]:after:content-['']",
        className,
      )}
      onClick={onClick}
    >
      {children}
      {attention && (
        <>
          <span
            aria-hidden="true"
            className="bg-accent1/10 ring-accent1/40 pointer-events-none absolute inset-0 animate-pulse rounded-[inherit] ring-1 [animation-iteration-count:3] ring-inset motion-reduce:animate-none"
          />
          <span className="sr-only"> Needs attention</span>
        </>
      )}
      {onClose && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onClose();
          }}
          className={cn('rounded p-0.5 hover:bg-surface4', transitions.colors, 'hover:text-neutral5')}
          aria-label="Close tab"
        >
          <X className="size-3" />
        </button>
      )}
    </BaseTabs.Tab>
  );

  if (disabled && disabledTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{tab}</TooltipTrigger>
        <TooltipContent>{disabledTooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return tab;
};
