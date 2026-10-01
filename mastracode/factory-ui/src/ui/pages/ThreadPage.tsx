import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { Suspense, lazy, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { useFactoryQuery } from '../../hooks/useFactories';
import { useRouteThreadSync } from '../../hooks/useRouteThreadSync';
import { ChatPageLayout } from '../domains/chat/components/ChatPageLayout';
import { EmptyThreadState } from '../domains/chat/components/EmptyThreadState';
import { GoalPanel } from '../domains/chat/components/GoalPanel';
import { PageTitle } from '../domains/chat/components/PageTitle';
import { SessionChatSurface } from '../domains/chat/components/SessionChatSurface';
import { SessionFavicon } from '../domains/chat/components/SessionFavicon';
import { ThreadRailLayer } from '../domains/chat/components/ThreadRailLayer';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { useChatTranscript } from '../domains/chat/context/useChatTranscript';
import { useGlobalShortcuts } from '../domains/chat/hooks/useGlobalShortcuts';
import { useHandoffPrompt } from '../domains/chat/hooks/useHandoffPrompt';
import { FactorySessionPage } from '../domains/factory/components/RelatedFactorySessions';
import { WorkspaceFilesProvider } from '../domains/workspace-viewer/context/WorkspaceFilesProvider';
import { WorkspaceFilesSurface } from '../domains/workspace-viewer/components/WorkspaceFilesSurface';
import { useThreadWorkspacePath } from '../domains/workspace-viewer/hooks/useThreadWorkspacePath';
import { useWiderThan } from '../domains/workspace-viewer/hooks/useWiderThan';
import { chatColumnClass, RAIL_MIN_REM } from '../domains/workspace-viewer/layout';
import { useInvalidateWorkspaceChangesOnRunCompletion } from '../domains/workspace-viewer/useInvalidateWorkspaceChangesOnRunCompletion';

import '../domains/chat/components/chat-enter.css';

// Lazy so CodeMirror + editor chrome stay out of the chat-path bundle; the
// chunk loads the first time a session flips to `?view=editor`.
const EditorSurface = lazy(() =>
  import('../domains/editor/EditorSurface').then(module => ({ default: module.EditorSurface })),
);

const threadShellClass = cn(
  chatColumnClass,
  '[--chat-inset-end:var(--workspace-files-inset,0px)] [--chat-gutter:0.25rem]',
);

export function ThreadPage() {
  const { factoryId, threadId } = useParams<{ factoryId: string; threadId?: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const workspace = useThreadWorkspacePath();
  const resolvingSession = factoryQuery.isPending || workspace.isPending;

  return (
    <>
      {resolvingSession ? (
        <ResolvingSessionMain />
      ) : (
        <ChatSessionBoundary threadId={threadId}>
          <PageTitle />
          <WorkspaceFilesProvider>
            <ThreadPageMain workspacePath={workspace.workspacePath} threadId={workspace.threadId} />
          </WorkspaceFilesProvider>
        </ChatSessionBoundary>
      )}
    </>
  );
}

function ResolvingSessionMain() {
  return (
    <ChatPageLayout>
      <SessionFavicon state="initializing" />
      <div className="grid min-h-0 place-items-center">
        <Spinner aria-label="Loading session" className="text-muted-foreground" />
      </div>
    </ChatPageLayout>
  );
}

function ThreadPageMain({
  workspacePath,
  threadId,
}: {
  workspacePath: string | undefined;
  threadId: string | undefined;
}) {
  useGlobalShortcuts();
  useRouteThreadSync();
  useHandoffPrompt();
  const railBoxRef = useRef<HTMLDivElement>(null);
  const { wider: railFits } = useWiderThan(railBoxRef, RAIL_MIN_REM);
  const [searchParams] = useSearchParams();
  // The editor is a session-view tab: `?view=editor` swaps the chat stage for
  // the code editor while the chat session (streaming, transcript cache) stays
  // alive in the boundary above.
  const editorView = searchParams.get('view') === 'editor' && Boolean(workspacePath);

  return (
    <ThreadSessionEffects workspacePath={workspacePath} threadId={threadId}>
      <FactorySessionPage>
        {editorView && workspacePath ? (
          <Suspense
            fallback={
              <div className="grid min-h-0 flex-1 place-items-center">
                <Spinner aria-label="Loading editor" className="text-muted-foreground" />
              </div>
            }
          >
            <EditorSurface workspacePath={workspacePath} threadId={threadId} />
          </Suspense>
        ) : (
          <SessionChatSurface
            secondaryBar={<GoalPanel />}
            emptyState={<EmptyThreadState />}
            composerLabel="Thread composer"
            className={threadShellClass}
            contentRef={railBoxRef}
            contentOverlay={railFits ? <ThreadRailLayer /> : undefined}
            stageSurface={<WorkspaceFilesSurface />}
          />
        )}
      </FactorySessionPage>
    </ThreadSessionEffects>
  );
}

function ThreadSessionEffects({
  workspacePath,
  threadId,
  children,
}: {
  workspacePath: string | undefined;
  threadId: string | undefined;
  children: ReactNode;
}) {
  const { busy } = useChatTranscript();
  useInvalidateWorkspaceChangesOnRunCompletion(workspacePath, threadId, busy);
  return children;
}
