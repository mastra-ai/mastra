import { WorkspaceTreeView } from '@mastra/playground-ui/domains/workspace';
import type { WorkspaceTreeViewProps } from '@mastra/playground-ui/domains/workspace';
import { WorkspaceProvider } from '@mastra/playground-ui/domains/workspace/components/workspace-context';
import { createPortal } from 'react-dom';
import { WorkspaceExplorer } from './workspace-explorer';
import { WorkspaceFileView } from './workspace-file-view';
import { useSidebarSlot } from '@/components/ui/sidebar-slot-context';

/** Keep file state and actions in one provider while placing the tree in the route's sidebar. */
export function WorkspaceBrowser({ asideActions, renderPreview, ...props }: WorkspaceTreeViewProps) {
  const slot = useSidebarSlot();
  if (!slot) return <WorkspaceTreeView {...props} asideActions={asideActions} renderPreview={renderPreview} />;
  return (
    <WorkspaceProvider {...props}>
      {slot && createPortal(<WorkspaceExplorer skillActions={asideActions} />, slot.target)}
      <WorkspaceFileView renderPreview={renderPreview} />
    </WorkspaceProvider>
  );
}
