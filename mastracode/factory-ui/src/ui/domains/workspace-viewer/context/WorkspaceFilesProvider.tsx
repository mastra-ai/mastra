import { cn } from '@mastra/playground-ui/utils/cn';
import { useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { ChatTranscriptContext } from '../../chat/context/ChatTranscriptContext';
import { useThreadWorkspacePath } from '../hooks/useThreadWorkspacePath';
import { useWiderThan } from '../hooks/useWiderThan';
import { DOCK_MIN_REM, cardWidthClass, reservedSpaceClass, threadGeometryClass } from '../layout';
import type { WorkspacePanelSize } from '../layout';
import { WorkspacePanelContext } from './WorkspacePanelContext';

/** Owns the box the card measures itself against, and shares its state with the session header. */
export function WorkspaceFilesProvider({ children }: { children: ReactNode }) {
  const { workspacePath, threadId } = useThreadWorkspacePath();
  const chatRef = useRef<HTMLDivElement>(null);
  const { wider: canDock, revision: layoutRevision } = useWiderThan(chatRef, DOCK_MIN_REM);
  const [toggled, setToggled] = useState<{ layoutRevision: number; open: boolean }>();
  const [sizing, setSizing] = useState<{ layoutRevision: number; size: WorkspacePanelSize }>();

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
  const size = sizing?.layoutRevision === layoutRevision ? sizing.size : 'compact';
  const setSize = (next: WorkspacePanelSize) => setSizing({ layoutRevision, size: next });

  const claimsSpace = open && canDock && Boolean(workspacePath);
  const hasPanelInteraction = panelToggle !== undefined || sizing?.layoutRevision === layoutRevision;

  return (
    <WorkspacePanelContext.Provider
      value={{ open, setOpen, workspacePath, threadId, size, setSize, canDock, readsChanges }}
    >
      <div
        ref={chatRef}
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-col',
          threadGeometryClass,
          cardWidthClass[size],
          hasPanelInteraction ? '[--workspace-files-transition:padding]' : '[--workspace-files-transition:none]',
          claimsSpace ? reservedSpaceClass.docked : reservedSpaceClass.none,
        )}
      >
        {children}
      </div>
    </WorkspacePanelContext.Provider>
  );
}
