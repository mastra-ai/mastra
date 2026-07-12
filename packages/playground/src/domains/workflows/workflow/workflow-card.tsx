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
    <div className="rounded-lg border border-border1 bg-surface4">
      <button className="flex w-full items-center justify-between gap-3 px-2 py-1" onClick={() => setExpanded(s => !s)}>
        <div className="w-full">{header}</div>
        <Icon>
          <ChevronDownIcon className={cn('-rotate-90 text-neutral3 transition-transform', expanded && 'rotate-0')} />
        </Icon>
      </button>
      {children && expanded && <div className="max-h-100 overflow-y-auto border-t border-border1">{children}</div>}
      {footer && <div className="border-t border-border1 px-2 py-1">{footer}</div>}
    </div>
  );
};
