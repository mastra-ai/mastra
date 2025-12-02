import { cn } from '@/lib/utils';
import * as RadixTabs from '@radix-ui/react-tabs';

type TabProps = {
  children: React.ReactNode;
  value: string;
  onClick?: () => void;
  className?: string;
};

export const Tab = ({ children, value, onClick, className }: TabProps) => {
  return (
    <RadixTabs.Trigger value={value} className={cn('hover:text-icon5', className)} onClick={onClick}>
      {children}
    </RadixTabs.Trigger>
  );
};
