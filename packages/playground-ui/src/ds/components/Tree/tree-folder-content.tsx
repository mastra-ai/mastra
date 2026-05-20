import * as React from 'react';
import { useTreeDepth, TreeDepthProvider } from './tree-context';
import { CollapsibleContent } from '@/ds/components/Collapsible';
import { cn } from '@/lib/utils';

export interface TreeFolderContentProps {
  className?: string;
  children: React.ReactNode;
}

export const TreeFolderContent = React.forwardRef<HTMLDivElement, TreeFolderContentProps>(
  ({ className, children }, ref) => {
    const depth = useTreeDepth();

    return (
      <CollapsibleContent ref={ref} className={cn(className)}>
        <TreeDepthProvider depth={depth + 1}>
          <ul role="group" className="flex flex-col">
            {children}
          </ul>
        </TreeDepthProvider>
      </CollapsibleContent>
    );
  },
);
TreeFolderContent.displayName = 'Tree.FolderContent';
