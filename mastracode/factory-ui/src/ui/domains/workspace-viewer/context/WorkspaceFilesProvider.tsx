import { useMaybeSidebarState } from '@mastra/playground-ui/components/Sidebar';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { ChatTranscriptContext } from '../../chat/context/ChatTranscriptContext';
import { useScrollbarGutters } from '../hooks/useScrollbarGutters';
import { useThreadWorkspacePath } from '../hooks/useThreadWorkspacePath';
import { useWiderThan } from '../hooks/useWiderThan';
import { DOCK_MIN_REM, panelStateAttributes, threadGeometryClass, threadGeometryStyle } from '../layout';
import { WorkspacePanelContext } from './WorkspacePanelContext';
import type { WorkspacePanelPage } from './WorkspacePanelContext';

/** Owns the box the card measures itself against, and shares its state with the session header. */
export function WorkspaceFilesProvider({ page, children }: { page?: WorkspacePanelPage; children: ReactNode }) {
  const { workspacePath, threadId } = useThreadWorkspacePath();
  const chatRef = useRef<HTMLDivElement>(null);
  const scrollbarGutters = useScrollbarGutters();
  const { wider: canDock, revision: layoutRevision } = useWiderThan(
    chatRef,
    DOCK_MIN_REM,
    scrollbarGutters,
    useMaybeSidebarState(),
  );
  const [toggled, setToggled] = useState<{ layoutRevision: number; open: boolean }>();

  const busy = useContext(ChatTranscriptContext)?.busy ?? false;
  const [awakeWorkspace, setAwakeWorkspace] = useState<string>();
  if (busy && workspacePath && awakeWorkspace !== workspacePath) setAwakeWorkspace(workspacePath);

  // Wide layouts reserve the panel from the first paint. Narrow layouts start
  // with a closed popover; an explicit toggle lasts until the layout changes.
  const panelToggle = toggled?.layoutRevision === layoutRevision ? toggled : undefined;
  const open = panelToggle?.open ?? canDock;
  // Reading changes runs git in the sandbox, which resumes a paused VM. A dock
  // that opened by default waits until the viewer opens it or a run here has
  // the sandbox awake.
  const readsChanges = panelToggle?.open === true || (Boolean(workspacePath) && awakeWorkspace === workspacePath);
  const setOpen = (next: boolean) => setToggled({ layoutRevision, open: next });

  const docked = open && canDock && Boolean(workspacePath);
  const hasDocked = canDock || layoutRevision > 0;
  const moved = layoutRevision > 0 || toggled !== undefined;

  return (
    <WorkspacePanelContext.Provider
      value={{ open, setOpen, workspacePath, threadId, canDock, docked, hasDocked, readsChanges, page }}
    >
      <div
        ref={chatRef}
        {...panelStateAttributes(docked, moved)}
        style={threadGeometryStyle(scrollbarGutters)}
        className={cn('flex h-full min-h-0 min-w-0 flex-col', threadGeometryClass)}
      >
        {children}
      </div>
    </WorkspacePanelContext.Provider>
  );
}
