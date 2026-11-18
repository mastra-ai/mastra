import type { ReactNode } from 'react';
import { useRef } from 'react';

import { useRouteThreadSync } from '../../../../hooks/useRouteThreadSync';
import { useThreadWorkspacePath } from '../../workspace-viewer/hooks/useThreadWorkspacePath';
import { useWiderThan } from '../../workspace-viewer/hooks/useWiderThan';
import { RAIL_MIN_REM } from '../../workspace-viewer/layout';
import { useInvalidateWorkspaceChangesOnRunCompletion } from '../../workspace-viewer/useInvalidateWorkspaceChangesOnRunCompletion';
import { useRefreshWorkspaceFilesOnToolCalls } from '../../workspace-viewer/useRefreshWorkspaceFilesOnToolCalls';
import { DraftSessionStartContext } from '../context/DraftSessionStartContext';
import type { DraftSessionStart } from '../context/DraftSessionStartContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { useHandoffPrompt } from '../hooks/useHandoffPrompt';
import { GoalPanel } from './GoalPanel';
import { PageTitle } from './PageTitle';
import { SessionChatSurface } from './SessionChatSurface';
import { TeammateSessionLine } from './TeammateSessionLine';
import { ThreadRailLayer } from './ThreadRailLayer';

export function SessionView({
  start,
  openingSession = false,
  emptyState,
}: {
  start?: DraftSessionStart;
  openingSession?: boolean;
  emptyState: ReactNode;
}) {
  const { workspacePath } = useThreadWorkspacePath();
  return (
    <SessionEffects workspacePath={workspacePath}>
      <PageTitle />
      <DraftSessionStartContext.Provider value={start}>
        <SessionChatSurface
          secondaryBar={<GoalPanel />}
          emptyState={emptyState}
          openingSession={openingSession}
          composerLabel="Thread composer"
          composerStatus={<TeammateSessionLine />}
          contentOverlay={<ThreadRailSlot />}
        />
      </DraftSessionStartContext.Provider>
    </SessionEffects>
  );
}

function ThreadRailSlot() {
  const boxRef = useRef<HTMLDivElement>(null);
  const { wider: railFits } = useWiderThan(boxRef, RAIL_MIN_REM);

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0">
      {railFits && <ThreadRailLayer />}
    </div>
  );
}

function SessionEffects({ workspacePath, children }: { workspacePath: string | undefined; children: ReactNode }) {
  useGlobalShortcuts();
  useRouteThreadSync();
  useHandoffPrompt();
  const { busy, transcript } = useChatTranscript();
  useInvalidateWorkspaceChangesOnRunCompletion(workspacePath, busy);
  useRefreshWorkspaceFilesOnToolCalls(workspacePath, transcript.entries);
  return children;
}
