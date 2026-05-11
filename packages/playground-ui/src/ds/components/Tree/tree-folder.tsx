import * as React from 'react';
import { Collapsible } from '@/ds/components/Collapsible';
import { cn } from '@/lib/utils';

export interface TreeFolderProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
}

export const TreeFolder = React.forwardRef<HTMLLIElement, TreeFolderProps>(
  ({ defaultOpen, open, onOpenChange, className, children }, ref) => {
    return (
      <li ref={ref} role="treeitem" className={cn('flex flex-col', className)}>
        <Collapsible defaultOpen={defaultOpen} open={open} onOpenChange={onOpenChange}>
          {children}
        </Collapsible>
      </li>
    );
  },
);
TreeFolder.displayName = 'Tree.Folder';
