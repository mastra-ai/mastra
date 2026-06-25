import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArtifactPreviewContext } from './artifact-preview';
import type { WorkspaceArtifactRef } from './artifact-preview';

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
