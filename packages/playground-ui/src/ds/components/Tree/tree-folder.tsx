import * as React from 'react';
import { cn } from '@/lib/utils';
import { Collapsible } from '@/ds/components/Collapsible';
import { Folder } from 'lucide-react';
import { useTreeContext } from './tree-context';
import { TreeFolderTrigger } from './tree-folder-trigger';
import { TreeFolderContent } from './tree-folder-content';
import { TreeIcon } from './tree-icon';
import { TreeLabel } from './tree-label';

export interface TreeFolderProps {
  name?: string;
  icon?: React.ReactNode;
  id?: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children?: React.ReactNode;
}

function hasCustomTrigger(children: React.ReactNode): boolean {
  let found = false;
  React.Children.forEach(children, child => {
    if (React.isValidElement(child) && (child.type as { displayName?: string })?.displayName === 'Tree.FolderTrigger') {
      found = true;
    }
  });
  return found;
}

export const TreeFolder = React.forwardRef<HTMLLIElement, TreeFolderProps>(
  ({ name, icon, id, action, defaultOpen, open, onOpenChange, className, children }, ref) => {
    const treeCtx = useTreeContext();
    const isSelected = id != null && treeCtx?.selectedId === id;
    const isComposable = hasCustomTrigger(children);

    return (
      <li ref={ref} role="treeitem" aria-selected={isSelected || undefined} className={cn('flex flex-col', className)}>
        <Collapsible defaultOpen={defaultOpen} open={open} onOpenChange={onOpenChange}>
          {isComposable ? (
            children
          ) : (
            <>
              <TreeFolderTrigger action={action}>
                <TreeIcon className="text-accent6">{icon ?? <Folder />}</TreeIcon>
                <TreeLabel>{name}</TreeLabel>
              </TreeFolderTrigger>
              <TreeFolderContent>{children}</TreeFolderContent>
            </>
          )}
        </Collapsible>
      </li>
    );
  },
);
TreeFolder.displayName = 'Tree.Folder';
