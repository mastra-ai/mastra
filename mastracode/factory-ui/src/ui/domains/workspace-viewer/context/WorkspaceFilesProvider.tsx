import { cn } from '@mastra/playground-ui/utils/cn';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useThreadWorkspacePath } from '../hooks/useThreadWorkspacePath';
import { useWiderThan } from '../hooks/useWiderThan';
import { DOCK_MIN_REM, cardWidthClass, reservedSpaceClass, threadGeometryClass } from '../layout';
import { WorkspacePanelContext } from './WorkspacePanelContext';

/** Owns the box the card measures itself against, and shares its state with the session header. */
export function WorkspaceFilesProvider({ children }: { children: ReactNode }) {
  const { workspacePath, threadId } = useThreadWorkspacePath();
  const chatRef = useRef<HTMLDivElement>(null);
  const { wider: canDock, revision: layoutRevision } = useWiderThan(chatRef, DOCK_MIN_REM);
  const [toggled, setToggled] = useState<{ layoutRevision: number; open: boolean }>();
  const [expansion, setExpansion] = useState<{ layoutRevision: number; expanded: boolean }>();

  // Toggle records the layout it was made in — crossing the threshold discards it, so a popover
  // left open closes itself instead of reopening as a docked card.
  // TODO(COR-1075): dock open by default again once file names and metadata come from the
  // database — today the first paint would list the pod and wake a sandbox nobody asked for.
  const open = toggled?.layoutRevision === layoutRevision ? toggled.open : false;
  const setOpen = (next: boolean) => setToggled({ layoutRevision, open: next });
  const expanded = expansion?.layoutRevision === layoutRevision ? expansion.expanded : false;
  const setExpanded = (next: boolean) => setExpansion({ layoutRevision, expanded: next });

  const claimsSpace = open && canDock && Boolean(workspacePath);

  return (
    <WorkspacePanelContext.Provider value={{ open, setOpen, workspacePath, threadId, expanded, setExpanded, canDock }}>
      <div
        ref={chatRef}
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-col',
          threadGeometryClass,
          cardWidthClass[expanded ? 'expanded' : 'compact'],
          claimsSpace ? reservedSpaceClass.docked : reservedSpaceClass.none,
        )}
      >
        {children}
      </div>
    </WorkspacePanelContext.Provider>
  );
}
