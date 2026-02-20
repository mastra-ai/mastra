import * as React from 'react';
import { cn } from '@/lib/utils';
import { TreeProvider, TreeDepthProvider } from './tree-context';

export interface TreeRootProps {
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  children: React.ReactNode;
}

export const TreeRoot = React.forwardRef<HTMLUListElement, TreeRootProps>(
  ({ selectedId, onSelect, className, children }, ref) => {
    const contextValue = React.useMemo(() => ({ selectedId, onSelect }), [selectedId, onSelect]);

    return (
      <TreeProvider value={contextValue}>
        <TreeDepthProvider depth={0}>
          <ul ref={ref} role="tree" className={cn('flex flex-col text-xs', className)}>
            {children}
          </ul>
        </TreeDepthProvider>
      </TreeProvider>
    );
  },
);
TreeRoot.displayName = 'Tree';
