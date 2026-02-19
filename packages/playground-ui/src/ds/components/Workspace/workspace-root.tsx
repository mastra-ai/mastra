import * as React from 'react';
import { WorkspaceProvider, type WorkspaceContextValue } from './workspace-context';

export interface WorkspaceRootProps {
  workspaceId?: string;
  defaultSelectedPath?: string;
  onFileSelect?: (path: string) => void;
  className?: string;
  children: React.ReactNode;
}

export const WorkspaceRoot = React.forwardRef<HTMLDivElement, WorkspaceRootProps>(
  ({ workspaceId, defaultSelectedPath, onFileSelect, className, children }, ref) => {
    const [selectedPath, setSelectedPath] = React.useState<string | null>(defaultSelectedPath ?? null);

    const handleSetSelectedPath = React.useCallback(
      (path: string | null) => {
        setSelectedPath(path);
        if (path) {
          onFileSelect?.(path);
        }
      },
      [onFileSelect],
    );

    const contextValue = React.useMemo<WorkspaceContextValue>(
      () => ({
        workspaceId,
        selectedPath,
        setSelectedPath: handleSetSelectedPath,
      }),
      [workspaceId, selectedPath, handleSetSelectedPath],
    );

    return (
      <WorkspaceProvider value={contextValue}>
        <div ref={ref} className={className}>
          {children}
        </div>
      </WorkspaceProvider>
    );
  },
);
WorkspaceRoot.displayName = 'Workspace';
