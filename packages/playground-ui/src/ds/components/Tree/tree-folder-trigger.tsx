import * as React from 'react';
import { cn } from '@/lib/utils';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { CollapsibleTrigger } from '@/ds/components/Collapsible';
import { ChevronRight } from 'lucide-react';
import { useTreeDepth } from './tree-context';

export interface TreeFolderTriggerProps {
  className?: string;
  children: React.ReactNode;
}

export const TreeFolderTrigger = React.forwardRef<HTMLButtonElement, TreeFolderTriggerProps>(
  ({ className, children }, ref) => {
    const depth = useTreeDepth();

    return (
      <CollapsibleTrigger
        ref={ref}
        className={cn(
          'group flex h-7 min-w-0 w-full cursor-pointer items-center gap-1.5 rounded-sm px-1',
          transitions.colors,
          focusRing.visible,
          'hover:bg-surface4',
          className,
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <ChevronRight className="size-3 shrink-0 text-neutral3" />
        {children}
      </CollapsibleTrigger>
    );
  },
);
TreeFolderTrigger.displayName = 'Tree.FolderTrigger';
