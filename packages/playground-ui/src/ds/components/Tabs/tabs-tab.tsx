import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { X } from 'lucide-react';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type TabProps = {
  children: React.ReactNode;
  value: string;
  onClick?: () => void;
  onClose?: () => void;
  disabled?: boolean;
  className?: string;
};

export const Tab = ({ children, value, onClick, onClose, disabled, className }: TabProps) => {
  return (
    <BaseTabs.Tab
      value={value}
      disabled={disabled}
      className={cn(
        'text-ui-md font-normal text-neutral3',
        'whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 outline-none cursor-pointer',
        transitions.colors,
        focusRing.visible,
        'hover:text-neutral4',
        'data-[active]:text-neutral5',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:hover:text-neutral3',
        // Line variant (default) — active state drawn by <Tabs.Indicator> in TabList
        'group-data-[variant=line]/tabs-list:py-2 group-data-[variant=line]/tabs-list:px-5',
        'group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent',
        // Pill variant
        'group-data-[variant=pill]/tabs-list:relative group-data-[variant=pill]/tabs-list:z-10',
        'group-data-[variant=pill]/tabs-list:py-1 group-data-[variant=pill]/tabs-list:px-3',
        'group-data-[variant=pill]/tabs-list:rounded-full',
        className,
      )}
      onClick={onClick}
    >
      {children}
      {onClose && (
        <button
          onClick={e => {
            e.stopPropagation();
            onClose();
          }}
          className={cn('p-0.5 hover:bg-surface4 rounded', transitions.colors, 'hover:text-neutral5')}
          aria-label="Close tab"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </BaseTabs.Tab>
  );
};
