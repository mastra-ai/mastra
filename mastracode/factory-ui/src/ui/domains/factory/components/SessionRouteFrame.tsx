import type { ReactNode } from 'react';
import { useParams } from 'react-router';

import { ChatPageLayout } from '../../chat/components/ChatPageLayout';
import { WorkspaceFilesToggle } from '../../workspace-viewer/components/WorkspaceFilesToggle';
import { WorkspacePanelDock } from '../../workspace-viewer/components/WorkspacePanelDock';
import { WorkspaceFilesProvider } from '../../workspace-viewer/context/WorkspaceFilesProvider';
import type { WorkspacePanelPage } from '../../workspace-viewer/context/WorkspacePanelContext';
import { useCardDraftFrame } from '../hooks/useCardDraftFrame';
import { useThreadFrame } from '../hooks/useThreadFrame';
import { ThreadSubscriptionsRefresh } from './ThreadSubscriptionsRefresh';

export interface SessionFrameSlots {
  panel: WorkspacePanelPage | undefined;
  title?: ReactNode;
  titleMenu?: ReactNode;
  headerCenter?: ReactNode;
}

/** One frame for a card draft and its thread, so a Start keeps the header and panel mounted. */
export function SessionRouteFrame({ children }: { children: ReactNode }) {
  const { workItemId } = useParams<{ workItemId?: string }>();
  const thread = useThreadFrame();
  const { panel, title, titleMenu, headerCenter } = useCardDraftFrame(workItemId) ?? thread;
  return (
    <WorkspaceFilesProvider page={panel}>
      <ChatPageLayout
        title={title}
        titleMenu={titleMenu}
        headerCenter={headerCenter}
        headerActions={<WorkspaceFilesToggle />}
        dockActions={actions => <WorkspacePanelDock>{actions}</WorkspacePanelDock>}
      >
        <ThreadSubscriptionsRefresh />
        {children}
      </ChatPageLayout>
    </WorkspaceFilesProvider>
  );
}
