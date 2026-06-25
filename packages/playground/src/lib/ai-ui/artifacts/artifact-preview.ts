import { createContext, useContext } from 'react';

export interface WorkspaceArtifactRef {
  workspaceId: string;
  workspaceName?: string;
  path: string;
  name?: string;
  mimeType?: string;
  sourceToolCallId?: string;
}

export interface ArtifactPreviewContextValue {
  selectedArtifact: WorkspaceArtifactRef | null;
  openArtifact: (artifact: WorkspaceArtifactRef) => void;
  closeArtifact: () => void;
}

export const ArtifactPreviewContext = createContext<ArtifactPreviewContextValue | null>(null);

export function useArtifactPreview() {
  const context = useContext(ArtifactPreviewContext);

  if (!context) {
    throw new Error('useArtifactPreview must be used within an ArtifactPreviewProvider');
  }

  return context;
}
