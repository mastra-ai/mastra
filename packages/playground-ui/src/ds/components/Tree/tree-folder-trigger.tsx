import * as React from 'react';
import { cn } from '@/lib/utils';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { CollapsibleTrigger } from '@/ds/components/Collapsible';
import { ChevronRight } from 'lucide-react';
import { useTreeDepth } from './tree-context';

export interface TreeFolderTriggerProps {
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const TreeFolderTrigger = React.forwardRef<HTMLButtonElement, TreeFolderTriggerProps>(
  ({ action, className, children }, ref) => {
    const depth = useTreeDepth();

    return (
      <CollapsibleTrigger
        ref={ref}
        className={cn(
          'group flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5',
          transitions.colors,
          focusRing.visible,
          'hover:bg-surface4',
          className,
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <ChevronRight className="size-3 shrink-0 text-neutral3" />
        {children}
        {action && <span className="ml-auto shrink-0 opacity-0 group-hover:opacity-100">{action}</span>}
      </CollapsibleTrigger>
    );
  },
);
TreeFolderTrigger.displayName = 'Tree.FolderTrigger';
