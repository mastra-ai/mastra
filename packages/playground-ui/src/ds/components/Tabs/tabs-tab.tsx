import * as RadixTabs from '@radix-ui/react-tabs';
import { X } from 'lucide-react';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type TabProps = {
  children: React.ReactNode;
  value: string;
  onClick?: () => void;
  onClose?: () => void;
  className?: string;
};

export const Tab = ({ children, value, onClick, onClose, className }: TabProps) => {
  return (
    <RadixTabs.Trigger
      value={value}
      className={cn(
        'text-sm p-3 text-neutral3 whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5',
        transitions.all,
        focusRing.visible,
        'hover:text-neutral4',
        'data-[state=active]:text-neutral5 data-[state=active]:border-b-2 data-[state=active]:border-black/50 data-[state=active]:dark:border-white/50',
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
