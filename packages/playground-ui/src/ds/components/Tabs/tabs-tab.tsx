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
  disabledTooltip?: React.ReactNode;
  className?: string;
};

export const Tab = ({ children, value, onClick, onClose, disabled, disabledTooltip, className }: TabProps) => {
  const tab = (
    <BaseTabs.Tab
      value={value}
      disabled={disabled}
      className={cn(
        'text-ui-md font-normal text-(--text-secondary)',
        'flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap outline-none',
        transitions.colors,
        focusRing.visible,
        'hover:text-(--text-primary)',
        'data-[active]:text-(--text-primary)',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-(--text-secondary)',
        'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:text-(--text-secondary)',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:hover:text-(--text-secondary)',
        // Line variant legacy fallback — active state drawn by <Tabs.Indicator> in TabList
        'group-data-[variant=line]/tabs-list:px-5 group-data-[variant=line]/tabs-list:py-2',
        'group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent',
        // Pill variant
        'group-data-[variant=pill]/tabs-list:relative group-data-[variant=pill]/tabs-list:z-10',
        'group-data-[variant=pill]/tabs-list:px-3 group-data-[variant=pill]/tabs-list:py-1',
        'group-data-[variant=pill]/tabs-list:rounded-full',
        // Pill-ghost variant (pill without list background)
        'group-data-[variant=pill-ghost]/tabs-list:relative group-data-[variant=pill-ghost]/tabs-list:z-10',
        'group-data-[variant=pill-ghost]/tabs-list:px-3 group-data-[variant=pill-ghost]/tabs-list:py-1',
        'group-data-[variant=pill-ghost]/tabs-list:rounded-full',
        className,
      )}
      onClick={onClick}
    >
      {children}
      {onClose && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onClose();
          }}
          className={cn('rounded p-0.5 hover:bg-surface-hover', transitions.colors, 'hover:text-(--text-primary)')}
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
