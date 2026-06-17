import * as React from 'react';
import { useTreeContext, useTreeDepth } from './tree-context';
import { Collapsible } from '@/ds/components/Collapsible';
import { cn } from '@/lib/utils';

export interface TreeFolderProps {
  id?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
}

export const TreeFolder = React.forwardRef<HTMLLIElement, TreeFolderProps>(
  ({ id, defaultOpen, open, onOpenChange, className, children }, ref) => {
    const treeCtx = useTreeContext();
    const depth = useTreeDepth();
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
    const isOpen = open ?? internalOpen;

    const handleOpenChange = React.useCallback(
      (nextOpen: boolean) => {
        setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
      },
      [onOpenChange],
    );

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLLIElement>) => {
        if (e.target !== e.currentTarget) return;
        treeCtx?.focusItem?.(e.currentTarget, { focus: false });
      },
      [treeCtx],
    );

    return (
      <li
        ref={ref}
        role="treeitem"
        aria-expanded={isOpen}
        aria-level={depth + 1}
        data-tree-item-kind="folder"
        data-tree-item-id={id}
        tabIndex={-1}
        className={cn('group/treeitem flex flex-col outline-hidden', className)}
        onFocus={handleFocus}
      >
        <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
          {children}
        </Collapsible>
      </li>
    );
  },
);
TreeFolder.displayName = 'Tree.Folder';
