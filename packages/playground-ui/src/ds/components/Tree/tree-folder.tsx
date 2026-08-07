import * as React from 'react';
import { TreeFolderProvider, useTreeContext, useTreeDepth } from './tree-context';
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
    const [isFocused, setIsFocused] = React.useState(false);
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
        if (e.target !== e.currentTarget) {
          setIsFocused(false);
          return;
        }

        setIsFocused(true);
        treeCtx?.focusItem?.(e.currentTarget, { focus: false });
      },
      [treeCtx],
    );

    const handleBlur = React.useCallback(() => {
      setIsFocused(false);
    }, []);

    const folderContextValue = React.useMemo(() => ({ isFocused }), [isFocused]);

    return (
      <li
        ref={ref}
        role="treeitem"
        aria-expanded={isOpen}
        aria-level={depth + 1}
        data-tree-item-kind="folder"
        data-tree-item-id={id}
        tabIndex={-1}
        className={cn('flex flex-col outline-hidden', className)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <TreeFolderProvider value={folderContextValue}>
          <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
            {children}
          </Collapsible>
        </TreeFolderProvider>
      </li>
    );
  },
);
TreeFolder.displayName = 'Tree.Folder';
