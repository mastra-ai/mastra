import { cn } from '@mastra/playground-ui/utils/cn';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useThreadWorkspacePath } from '../hooks/useThreadWorkspacePath';
import { useWiderThan } from '../hooks/useWiderThan';
import { DOCK_MIN_REM, cardWidthClass, reservedSpaceClass } from '../layout';
import { WorkspaceFilesContext } from './WorkspaceFilesContext';

/** Owns the box the card measures itself against, and shares its state with the session header. */
export function WorkspaceFilesProvider({ children }: { children: ReactNode }) {
  const { workspacePath, threadId } = useThreadWorkspacePath();
  const chatRef = useRef<HTMLDivElement>(null);
  const canDock = useWiderThan(chatRef, DOCK_MIN_REM);
  const [toggled, setToggled] = useState<{ whileDocked: boolean; open: boolean }>();
  const [viewingFile, setViewingFile] = useState(false);

  // Toggle records the layout it was made in — crossing the threshold discards it, so a popover
  // left open closes itself instead of reopening as a docked card.
  // TODO(COR-1075): dock open by default again once file names and metadata come from the
  // database — today the first paint would list the pod and wake a sandbox nobody asked for.
  const open = toggled?.whileDocked === canDock ? toggled.open : false;
  const setOpen = (next: boolean) => setToggled({ whileDocked: canDock, open: next });

  const claimsSpace = open && canDock && Boolean(workspacePath);

  return (
    <WorkspaceFilesContext.Provider
      value={{ open, setOpen, workspacePath, threadId, viewingFile, setViewingFile, canDock }}
    >
      <div
        ref={chatRef}
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-col',
          cardWidthClass[viewingFile ? 'viewing' : 'browsing'],
          claimsSpace ? reservedSpaceClass.docked : reservedSpaceClass.none,
        )}
      >
        {children}
      </div>
    </WorkspaceFilesContext.Provider>
  );
}
