import * as React from 'react';

export interface TreeContextValue {
  selectedId?: string;
  onSelect?: (id: string) => void;
}

const TreeContext = React.createContext<TreeContextValue | null>(null);

export function TreeProvider({ children, value }: { children: React.ReactNode; value: TreeContextValue }) {
  return <TreeContext.Provider value={value}>{children}</TreeContext.Provider>;
}

export function useTreeContext(): TreeContextValue | null {
  return React.useContext(TreeContext);
}

const TreeDepthContext = React.createContext<number>(0);

export function TreeDepthProvider({ children, depth }: { children: React.ReactNode; depth: number }) {
  return <TreeDepthContext.Provider value={depth}>{children}</TreeDepthContext.Provider>;
}

export function useTreeDepth(): number {
  return React.useContext(TreeDepthContext);
}
