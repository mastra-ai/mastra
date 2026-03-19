import * as React from 'react';
import { cn } from '@/lib/utils';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { useTreeContext, useTreeDepth } from './tree-context';

export interface TreeFileProps {
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export const TreeFile = React.forwardRef<HTMLLIElement, TreeFileProps>(({ id, className, children }, ref) => {
  const treeCtx = useTreeContext();
  const depth = useTreeDepth();
  const isSelected = id != null && treeCtx?.selectedId === id;

  const handleClick = () => {
    if (id != null && treeCtx?.onSelect) {
      treeCtx.onSelect(id);
    }
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
      role="treeitem"
      aria-selected={isSelected || undefined}
      tabIndex={0}
      className={cn(
        'group flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-sm px-1',
        transitions.colors,
        focusRing.visible,
        'hover:bg-surface4',
        isSelected && 'bg-surface4 text-neutral6',
        className,
      )}
      // +18 offsets past the chevron (size-3 = 12px) + flex gap (gap-1.5 = 6px) that folders have
      style={{ paddingLeft: depth * 12 + 18 }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </li>
  );
});
TreeFile.displayName = 'Tree.File';
