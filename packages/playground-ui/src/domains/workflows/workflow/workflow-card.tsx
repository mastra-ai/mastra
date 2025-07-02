import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';

export interface WorkflowCardProps {
  header: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export const WorkflowCard = ({ header, children, footer }: WorkflowCardProps) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border-sm border-border1 bg-surface4">
      <button className="py-1 px-2 flex items-center gap-3 justify-between w-full" onClick={() => setExpanded(s => !s)}>
        <div className="w-full">{header}</div>
        <Icon>
          <ChevronDownIcon className={cn('text-icon3 transition-transform -rotate-90', expanded && 'rotate-0')} />
        </Icon>
      </button>
      {children && expanded && <div className="border-t-sm border-border1">{children}</div>}
      {footer && <div className="py-1 px-2 border-t-sm border-border1">{footer}</div>}
    </div>
  );
};
