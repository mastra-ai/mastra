import * as React from 'react';
import { cn } from '@/lib/utils';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { CollapsibleTrigger } from '@/ds/components/Collapsible';
import { ChevronRight } from 'lucide-react';
import { useTreeDepth } from './tree-context';

export interface TreeFolderTriggerProps {
  className?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const TreeFolderTrigger = React.forwardRef<HTMLDivElement, TreeFolderTriggerProps>(
  ({ className, children, actions }, ref) => {
    const depth = useTreeDepth();

    return (
      <div
        ref={ref}
        className={cn(
          'group flex h-7 min-w-0 w-full items-center rounded-sm hover:bg-surface4',
          transitions.colors,
          className,
        )}
      >
        <CollapsibleTrigger
          className={cn(
            'flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-sm px-1',
            focusRing.visible,
          )}
          style={{ paddingLeft: depth * 12 }}
        >
          <ChevronRight className="size-3 shrink-0 text-neutral3" />
          {children}
        </CollapsibleTrigger>
        {actions && (
          <span className="shrink-0 pr-1" onClick={e => e.stopPropagation()}>
            {actions}
          </span>
        )}
      </div>
    );
  },
);
TreeFolderTrigger.displayName = 'Tree.FolderTrigger';
