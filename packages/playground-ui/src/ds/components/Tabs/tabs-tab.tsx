import { cn } from '@/lib/utils';
import * as RadixTabs from '@radix-ui/react-tabs';
import { X } from 'lucide-react';

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
        'text-xs p-3 text-mastra-el-3 data-[state=active]:text-mastra-el-5 data-[state=active]:border-b-2 whitespace-nowrap flex-shrink-0 flex items-center justify-center gap-1.5',
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
          className="p-0.5 hover:bg-surface3 rounded transition-colors"
          aria-label="Close tab"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </RadixTabs.Trigger>
  );
};
