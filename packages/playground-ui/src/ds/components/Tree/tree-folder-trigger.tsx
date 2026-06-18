import { ChevronRight } from 'lucide-react';
import * as React from 'react';
import { useTreeContext, useTreeDepth } from './tree-context';
import { CollapsibleTrigger } from '@/ds/components/Collapsible';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface TreeFolderTriggerProps {
  className?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const TreeFolderTrigger = React.forwardRef<HTMLDivElement, TreeFolderTriggerProps>(
  ({ className, children, actions }, ref) => {
    const treeCtx = useTreeContext();
    const depth = useTreeDepth();

    const focusFolderItem = React.useCallback(
      (target: HTMLElement, options?: { focus?: boolean }) => {
        const item = target.closest<HTMLElement>('[data-tree-item-kind="folder"]');
        if (item) {
          treeCtx?.focusItem?.(item, options);
        }
      },
      [treeCtx],
    );

    return (
      <div
        ref={ref}
        data-tree-folder-row="true"
        className={cn(
          'group flex h-7 min-w-0 w-full items-center rounded-sm hover:bg-surface4 group-focus-visible/treeitem:outline-hidden group-focus-visible/treeitem:bg-surface4 group-focus-visible/treeitem:text-neutral6',
          transitions.colors,
          className,
        )}
      >
        <CollapsibleTrigger
          data-tree-folder-trigger="true"
          tabIndex={-1}
          className="flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-sm px-1 outline-hidden focus-visible:outline-hidden focus-visible:ring-0"
          style={{ paddingLeft: depth * 12 }}
          onMouseDown={e => {
            e.preventDefault();
            focusFolderItem(e.currentTarget);
          }}
          onFocus={e => {
            focusFolderItem(e.currentTarget, { focus: false });
          }}
        >
          <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-neutral3" />
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
