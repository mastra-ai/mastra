import { useState } from 'react';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { Icon } from '@/ds/icons/Icon';

export interface WorkflowCardProps {
  header: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export const WorkflowCard = ({ header, children, footer }: WorkflowCardProps) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-muted">
      <button
        className="flex w-full items-center justify-between gap-3 px-2 py-1"
        aria-expanded={expanded}
        onClick={() => setExpanded(s => !s)}
      >
        <div className="w-full">{header}</div>
        <Icon>
          <DisclosureChevron direction="right" className="text-muted-foreground" />
        </Icon>
      </button>
      {children && expanded && <div className="max-h-100 overflow-y-auto border-t border-border">{children}</div>}
      {footer && <div className="border-t border-border px-2 py-1">{footer}</div>}
    </div>
  );
};
