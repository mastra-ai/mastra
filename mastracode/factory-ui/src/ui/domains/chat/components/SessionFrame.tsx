import type { ReactNode } from 'react';

import { WorkspaceFilesToggle } from '../../workspace-viewer/components/WorkspaceFilesToggle';
import { WorkspacePanelDock } from '../../workspace-viewer/components/WorkspacePanelDock';
import { WorkspaceFilesProvider } from '../../workspace-viewer/context/WorkspaceFilesProvider';
import type { WorkspacePanelPage } from '../../workspace-viewer/context/WorkspacePanelContext';
import { ChatPageLayout } from './ChatPageLayout';

export interface SessionFrameSlots {
  panel: WorkspacePanelPage | undefined;
  title?: ReactNode;
  titleMenu?: ReactNode;
  headerCenter?: ReactNode;
}

export function SessionFrame({
  panel,
  title,
  titleMenu,
  headerCenter,
  children,
}: SessionFrameSlots & { children: ReactNode }) {
  return (
    <WorkspaceFilesProvider page={panel}>
      <ChatPageLayout
        title={title}
        titleMenu={titleMenu}
        headerCenter={headerCenter}
        headerActions={<WorkspaceFilesToggle />}
        dockActions={actions => <WorkspacePanelDock>{actions}</WorkspacePanelDock>}
      >
        {children}
      </ChatPageLayout>
    </WorkspaceFilesProvider>
  );
}
