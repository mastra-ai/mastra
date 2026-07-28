import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
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
    <div className="border-border1 bg-surface4 rounded-lg border">
      <button className="flex w-full items-center justify-between gap-3 px-2 py-1" onClick={() => setExpanded(s => !s)}>
        <div className="w-full">{header}</div>
        <Icon>
          <ChevronDownIcon className={cn('text-neutral3 transition-transform -rotate-90', expanded && 'rotate-0')} />
        </Icon>
      </button>
      {children && expanded && <div className="border-border1 max-h-[400px] overflow-y-auto border-t">{children}</div>}
      {footer && <div className="border-border1 border-t px-2 py-1">{footer}</div>}
    </div>
  );
};
