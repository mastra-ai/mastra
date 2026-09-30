import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { WorkspaceContext } from './use-workspace-context';

export interface WorkspaceProviderProps {
  workspaceId: string;
  /** Seeds the active file on mount; later changes do not override the user's selection. */
  initialFile?: string;
  children: ReactNode;
}

export function WorkspaceProvider({ workspaceId, initialFile, children }: WorkspaceProviderProps) {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(initialFile ?? null);
  const [query, setQuery] = useState('');

  const value = useMemo(
    () => ({ workspaceId, activeFilePath, setActiveFilePath, query, setQuery }),
    [workspaceId, activeFilePath, query],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
