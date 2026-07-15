import * as React from 'react';
import { useTreeContext, useTreeDepth } from './tree-context';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface TreeFileProps extends Omit<React.HTMLAttributes<HTMLLIElement>, 'id'> {
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export const TreeFile = React.forwardRef<HTMLLIElement, TreeFileProps>(({ id, className, children, ...props }, ref) => {
  const treeCtx = useTreeContext();
  const depth = useTreeDepth();
  const isSelected = id != null && treeCtx?.selectedId === id;

  const handleClick = (e: React.MouseEvent<HTMLLIElement>) => {
    treeCtx?.focusItem?.(e.currentTarget);
    if (id != null && treeCtx?.onSelect) {
      treeCtx.onSelect(id);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLLIElement>) => {
    treeCtx?.focusItem?.(e.currentTarget, { focus: false });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && id != null && treeCtx?.onSelect) {
      e.preventDefault();
      treeCtx.onSelect(id);
    }
  };

  return (
    <li
      ref={ref}
      {...props}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={isSelected || undefined}
      data-tree-item-kind="file"
      data-tree-item-id={id}
      tabIndex={-1}
      className={cn(
        'group flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-sm px-1',
        transitions.colors,
        'outline-hidden hover:bg-surface4 focus-visible:bg-surface4 focus-visible:text-neutral6 focus-visible:outline-hidden',
        isSelected && 'bg-surface4 text-neutral6',
        className,
      )}
      // +18 offsets past the chevron (size-3 = 12px) + flex gap (gap-1.5 = 6px) that folders have
      style={{ paddingLeft: depth * 12 + 18 }}
      onClick={handleClick}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
    >
      {children}
    </li>
  );
});
TreeFile.displayName = 'Tree.File';
