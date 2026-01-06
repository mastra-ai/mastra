import { cn } from '@/lib/utils';
import * as RadixTabs from '@radix-ui/react-tabs';
import { X } from 'lucide-react';

type TabProps = {
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
      className={cn('hover:text-icon5 flex items-center gap-1.5', className)}
      onClick={onClick}
    >
      {children}
      {onClose && (
        <button
          onClick={e => {
            e.stopPropagation();
            onClose();
          }}
          className="p-0.5 hover:bg-surface3 rounded transition-colors"
          aria-label="Close tab"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </RadixTabs.Trigger>
  );
};
