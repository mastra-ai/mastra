import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface WorkspaceArtifactRef {
  workspaceId: string;
  workspaceName?: string;
  path: string;
  name?: string;
  mimeType?: string;
  sourceToolCallId?: string;
}

interface ArtifactPreviewContextValue {
  selectedArtifact: WorkspaceArtifactRef | null;
  openArtifact: (artifact: WorkspaceArtifactRef) => void;
  closeArtifact: () => void;
}

const ArtifactPreviewContext = createContext<ArtifactPreviewContextValue | null>(null);

export function ArtifactPreviewProvider({ children }: { children: ReactNode }) {
  const [selectedArtifact, setSelectedArtifact] = useState<WorkspaceArtifactRef | null>(null);

  const openArtifact = useCallback((artifact: WorkspaceArtifactRef) => {
    setSelectedArtifact(artifact);
  }, []);

  const closeArtifact = useCallback(() => {
    setSelectedArtifact(null);
  }, []);

  const value = useMemo(
    () => ({
      selectedArtifact,
      openArtifact,
      closeArtifact,
    }),
    [closeArtifact, openArtifact, selectedArtifact],
  );

  return <ArtifactPreviewContext.Provider value={value}>{children}</ArtifactPreviewContext.Provider>;
}

export function useArtifactPreview() {
  const context = useContext(ArtifactPreviewContext);

  if (!context) {
    throw new Error('useArtifactPreview must be used within an ArtifactPreviewProvider');
  }

  return context;
}
