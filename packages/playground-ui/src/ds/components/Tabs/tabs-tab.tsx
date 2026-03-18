import { cn } from '@/lib/utils';
import * as RadixTabs from '@radix-ui/react-tabs';
import { X } from 'lucide-react';
import { transitions } from '@/ds/primitives/transitions';
import { focusRing } from '@/ds/primitives/transitions';

export type TabProps = {
  children: React.ReactNode;
  value: string;
  size?: 'default' | 'smaller';
  onClick?: () => void;
  onClose?: () => void;
  className?: string;
};

export const Tab = ({ children, value, size = 'default', onClick, onClose, className }: TabProps) => {
  return (
    <RadixTabs.Trigger
      value={value}
      className={cn(
        'relative text-neutral3 whitespace-nowrap flex-shrink-0 flex items-center justify-center gap-1.5 outline-none leading-relaxed',
        { 'text-ui-md py-2': size === 'default', 'text-ui-smd h-8': size === 'smaller' },
        transitions.all,
        focusRing.visible,
        'hover:text-neutral4',
        'after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[1px] after:bg-transparent',
        `after:${transitions.colors}`,
        'hover:after:bg-white/20',
        'data-[state=active]:text-neutral4 data-[state=active]:after:bg-white/50',
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
