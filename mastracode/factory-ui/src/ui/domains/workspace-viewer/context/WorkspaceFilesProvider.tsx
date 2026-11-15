import { cn } from '@mastra/playground-ui/utils/cn';
import { useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { usePrefersReducedMotion } from '../../../../hooks/usePrefersReducedMotion';
import { ChatTranscriptContext } from '../../chat/context/ChatTranscriptContext';
import { useScrollbarGutters } from '../hooks/useScrollbarGutters';
import { useThreadWorkspacePath } from '../hooks/useThreadWorkspacePath';
import { useWiderThan } from '../hooks/useWiderThan';
import { DOCK_MIN_REM, panelStateAttributes, threadGeometryClass, threadGeometryStyle } from '../layout';
import { WorkspacePanelContext, WorkspacePanelDockableContext } from './WorkspacePanelContext';
import type { WorkspacePanelPage } from './WorkspacePanelContext';

/** Owns the box the card measures itself against, and shares its state with the session header. */
export function WorkspaceFilesProvider({ page, children }: { page?: WorkspacePanelPage; children: ReactNode }) {
  const { workspacePath, threadId } = useThreadWorkspacePath();
  const hasWorkspace = Boolean(workspacePath);
  const chatRef = useRef<HTMLDivElement>(null);
  const scrollbarGutters = useScrollbarGutters();
  const { wider: canDock, revision: layoutRevision } = useWiderThan(
    chatRef,
    DOCK_MIN_REM,
    hasWorkspace,
    scrollbarGutters,
  );
  const [toggled, setToggled] = useState<{ layoutRevision: number; open: boolean }>();
  const [settled, setSettled] = useState({ layoutRevision, toggled });
  const reducedMotion = usePrefersReducedMotion();

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

  const crossed = settled.layoutRevision !== layoutRevision;
  const openBeforeNarrowing = toggled?.layoutRevision === layoutRevision - 1 ? toggled.open : true;
  const folding = panelToggle === undefined && !canDock && crossed && openBeforeNarrowing && !reducedMotion;
  const dockable = (canDock || folding) && hasWorkspace;
  const moving = dockable && !reducedMotion && (crossed || settled.toggled !== toggled);
  const claimsSpace = open && canDock && Boolean(workspacePath);
  const onDockSettled = () =>
    setSettled(current =>
      current.layoutRevision === layoutRevision && current.toggled === toggled ? current : { layoutRevision, toggled },
    );

  return (
    <WorkspacePanelContext.Provider
      value={{ open, setOpen, workspacePath, threadId, canDock, moving, onDockSettled, readsChanges, page }}
    >
      <WorkspacePanelDockableContext.Provider value={dockable}>
        <div
          ref={chatRef}
          {...panelStateAttributes(claimsSpace, moving)}
          style={threadGeometryStyle(scrollbarGutters)}
          className={cn('flex h-full min-h-0 min-w-0 flex-col', threadGeometryClass)}
        >
          {children}
        </div>
      </WorkspacePanelDockableContext.Provider>
    </WorkspacePanelContext.Provider>
  );
}
