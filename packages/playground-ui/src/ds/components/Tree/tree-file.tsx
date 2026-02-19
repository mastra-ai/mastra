import * as React from 'react';
import { cn } from '@/lib/utils';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { File, FileCode, FileJson, FileText } from 'lucide-react';
import { useTreeContext, useTreeDepth } from './tree-context';
import { TreeIcon } from './tree-icon';
import { TreeLabel } from './tree-label';

export interface TreeFileProps {
  name?: string;
  icon?: React.ReactNode;
  id?: string;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

function getDefaultFileIcon(name?: string): { icon: React.ReactNode; colorClass: string } {
  if (!name) return { icon: <File />, colorClass: 'text-neutral3' };

  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return { icon: <FileCode />, colorClass: 'text-accent3' };
    case 'json':
      return { icon: <FileJson />, colorClass: 'text-accent6' };
    case 'md':
    case 'mdx':
      return { icon: <FileText />, colorClass: 'text-accent5' };
    default:
      return { icon: <File />, colorClass: 'text-neutral3' };
  }
}

export const TreeFile = React.forwardRef<HTMLLIElement, TreeFileProps>(
  ({ name, icon, id, action, className, children }, ref) => {
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

    const hasChildren = children != null;
    const defaultIcon = !hasChildren && !icon ? getDefaultFileIcon(name) : null;

    return (
      <li
        ref={ref}
        role="treeitem"
        aria-selected={isSelected || undefined}
        tabIndex={0}
        className={cn(
          'group flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5',
          transitions.colors,
          focusRing.visible,
          'hover:bg-surface4',
          isSelected && 'bg-accent1Dark text-neutral6',
          className,
        )}
        // +18 offsets past the chevron (size-3 = 12px) + flex gap (gap-1.5 = 6px) that folders have
        style={{ paddingLeft: depth * 12 + 18 }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {hasChildren ? (
          children
        ) : (
          <>
            <TreeIcon className={icon ? 'text-neutral3' : defaultIcon!.colorClass}>
              {icon ?? defaultIcon!.icon}
            </TreeIcon>
            <TreeLabel>{name}</TreeLabel>
            {action && <span className="ml-auto shrink-0 opacity-0 group-hover:opacity-100">{action}</span>}
          </>
        )}
      </li>
    );
  },
);
TreeFile.displayName = 'Tree.File';
