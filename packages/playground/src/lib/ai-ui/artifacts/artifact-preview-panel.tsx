import { useArtifactPreview } from './artifact-preview-context';
import { WorkspaceFilePreview } from '@/domains/workspace/components/workspace-file-preview';

export function ArtifactPreviewPanel() {
  const { closeArtifact, selectedArtifact } = useArtifactPreview();

  if (!selectedArtifact) return null;

  return (
    <div className="h-full min-h-0">
      <WorkspaceFilePreview
        workspaceId={selectedArtifact.workspaceId}
        workspaceName={selectedArtifact.workspaceName}
        path={selectedArtifact.path}
        onClose={closeArtifact}
        variant="artifact"
      />
    </div>
  );
}
