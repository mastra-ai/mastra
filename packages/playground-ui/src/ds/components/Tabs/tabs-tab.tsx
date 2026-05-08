import * as RadixTabs from '@radix-ui/react-tabs';
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
    <RadixTabs.Trigger
      value={value}
      disabled={disabled}
      className={cn(
        'py-2 px-5 text-ui-md font-normal text-neutral3 border-b-2 border-transparent',
        'whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 outline-none cursor-pointer',
        transitions.colors,
        focusRing.visible,
        'hover:text-neutral4',
        'data-[state=active]:text-neutral5 data-[state=active]:border-neutral3',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:hover:text-neutral3',
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
    </RadixTabs.Trigger>
  );
};
