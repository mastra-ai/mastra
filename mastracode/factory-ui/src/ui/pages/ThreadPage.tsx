import type { ReactNode } from 'react';
import { useRef } from 'react';

import { useRouteThreadSync } from '../../hooks/useRouteThreadSync';
import { EmptyThreadState } from '../domains/chat/components/EmptyThreadState';
import { GoalPanel } from '../domains/chat/components/GoalPanel';
import { PageTitle } from '../domains/chat/components/PageTitle';
import { SessionChatSurface } from '../domains/chat/components/SessionChatSurface';
import { ThreadRailLayer } from '../domains/chat/components/ThreadRailLayer';
import { TeammateSessionLine } from '../domains/chat/components/TeammateSessionLine';
import { useChatTranscript } from '../domains/chat/context/useChatTranscript';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { useHandoffPrompt } from '../domains/chat/hooks/useHandoffPrompt';
import { useThreadWorkspacePath } from '../domains/workspace-viewer/hooks/useThreadWorkspacePath';
import { useWiderThan } from '../domains/workspace-viewer/hooks/useWiderThan';
import { RAIL_MIN_REM } from '../domains/workspace-viewer/layout';
import { useInvalidateWorkspaceChangesOnRunCompletion } from '../domains/workspace-viewer/useInvalidateWorkspaceChangesOnRunCompletion';
import { useRefreshWorkspaceFilesOnToolCalls } from '../domains/workspace-viewer/useRefreshWorkspaceFilesOnToolCalls';

export function ThreadPage() {
  const { workspacePath } = useThreadWorkspacePath();
  return (
    <ThreadSessionEffects workspacePath={workspacePath}>
      <PageTitle />
      <SessionChatSurface
        secondaryBar={<GoalPanel />}
        emptyState={<EmptyThreadState />}
        composerLabel="Thread composer"
        composerStatus={<TeammateSessionLine />}
        contentOverlay={<ThreadRailSlot />}
      />
    </ThreadSessionEffects>
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

function ThreadSessionEffects({ workspacePath, children }: { workspacePath: string | undefined; children: ReactNode }) {
  useGlobalShortcuts();
  useRouteThreadSync();
  useHandoffPrompt();
  const { busy, transcript } = useChatTranscript();
  useInvalidateWorkspaceChangesOnRunCompletion(workspacePath, busy);
  useRefreshWorkspaceFilesOnToolCalls(workspacePath, transcript.entries);
  return children;
}
