import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowDown } from 'lucide-react';
import type { RefObject } from 'react';
import { useLocation } from 'react-router';

import { SkeletonRows, Wordmark } from '../../../ui';
import type { Project } from '../../workspaces';
import { useActiveProjectContext } from '../../workspaces';
import type { ChatSessionApi } from '../context/ChatSessionProvider';
import { useChatSession } from '../context/ChatSessionProvider';
import { useTranscriptScroll } from '../hooks/useTranscriptScroll';
import { GoalPanel } from './GoalPanel';
import { Transcript } from './Transcript';

type TranscriptState = ChatSessionApi['transcript'];

const transcriptScrollClass =
  'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scroll-smooth px-3 pb-2 pt-6 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[80ch]';
const emptyThreadClass = 'w-full max-w-[80ch] px-7 text-left font-mono text-sm leading-relaxed text-icon3';

/**
 * The actual chat: the scrollable column holding the goal panel, connection
 * notice, transcript entries (or the empty-thread welcome), and the working
 * indicator. Propless — must render inside `ChatSessionProvider` with an
 * active project (the composition root guarantees it).
 */
export function ChatMessageList({ routeErrorNotice }: { routeErrorNotice?: string | null } = {}) {
  const { activeProject } = useActiveProjectContext();
  const session = useChatSession();
  const { transcript, status, showWorkingIndicator, messagesPending, onApprove, onRespond } = session;
  const location = useLocation();
  const { threadRef, showScrollDown, scrollToBottom } = useTranscriptScroll(transcript);

  const draft = location.pathname === '/new';

  // Parent only renders this component with an active project; TS narrowing.
  if (!activeProject) return null;

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      {transcript.goal && (
        <GoalPanel
          goal={transcript.goal}
          onSetGoal={goal => void session.setGoal(goal)}
          onPauseGoal={() => void session.pauseGoal()}
          onResumeGoal={() => void session.resumeGoal()}
          onClearGoal={() => void session.clearGoal()}
        />
      )}

      <ConnectionNotice status={status} />

      <TranscriptPanel
        activeProject={activeProject}
        transcript={transcript}
        showWorkingIndicator={showWorkingIndicator}
        messagesPending={!draft && (messagesPending || status === 'connecting')}
        draft={draft}
        routeErrorNotice={routeErrorNotice}
        threadRef={threadRef}
        onApprove={onApprove}
        onRespond={onRespond}
      />

      {showScrollDown && <ScrollToLatestButton onClick={() => scrollToBottom('smooth')} />}
    </div>
  );
}

function ConnectionNotice({ status }: { status: ChatSessionApi['status'] }) {
  if (status !== 'reconnecting' && status !== 'error') {
    return null;
  }

  return (
    <div role="status" aria-live="polite" className="px-3 pt-2">
      <Notice variant={status === 'reconnecting' ? 'warning' : 'destructive'}>
        {status === 'reconnecting'
          ? 'Connection lost — reconnecting…'
          : 'Disconnected. Check the server and reload to reconnect.'}
      </Notice>
    </div>
  );
}

type TranscriptPanelProps = {
  activeProject: Project;
  transcript: TranscriptState;
  showWorkingIndicator: boolean;
  messagesPending: boolean;
  draft: boolean;
  routeErrorNotice?: string | null;
  threadRef: RefObject<HTMLDivElement | null>;
  onApprove: ChatSessionApi['onApprove'];
  onRespond: ChatSessionApi['onRespond'];
};

function TranscriptPanel({
  activeProject,
  transcript,
  showWorkingIndicator,
  messagesPending,
  draft,
  routeErrorNotice,
  threadRef,
  onApprove,
  onRespond,
}: TranscriptPanelProps) {
  // The /new draft page: a fresh composer regardless of what thread the
  // session is bound to under the hood. Keep local notices visible so route-sync
  // failures can explain why a persisted deep link fell back to the draft page.
  if (draft) {
    const noticeEntries = transcript.entries.filter(entry => entry.kind === 'notice');

    if (routeErrorNotice || noticeEntries.length > 0) {
      return (
        <div className={transcriptScrollClass} ref={threadRef}>
          <EmptyThreadState activeProject={activeProject} />
          {routeErrorNotice && <Notice variant="destructive">{routeErrorNotice}</Notice>}
          <Transcript entries={noticeEntries} onApprove={onApprove} onRespond={onRespond} />
        </div>
      );
    }

    return (
      <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-3 py-8 md:px-5" ref={threadRef}>
        <EmptyThreadState activeProject={activeProject} />
      </div>
    );
  }

  // Persisted history is still loading (or the session is still connecting) —
  // show the shared skeleton instead of flashing the empty-thread welcome.
  if (transcript.entries.length === 0 && messagesPending) {
    return (
      <div className={transcriptScrollClass} ref={threadRef}>
        <SkeletonRows label="Loading messages" rows={6} />
      </div>
    );
  }

  if (transcript.entries.length === 0 && !showWorkingIndicator) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-3 py-8 md:px-5" ref={threadRef}>
        <EmptyThreadState activeProject={activeProject} />
      </div>
    );
  }

  return (
    <div className={transcriptScrollClass} ref={threadRef}>
      {transcript.entries.length === 0 && <EmptyThreadState activeProject={activeProject} />}
      <Transcript entries={transcript.entries} onApprove={onApprove} onRespond={onRespond} />
      {showWorkingIndicator && <WorkingIndicator />}
    </div>
  );
}

function EmptyThreadState({ activeProject }: { activeProject: Project }) {
  return (
    <div className={emptyThreadClass}>
      <Wordmark className="mb-6" />
      <dl className="mb-4 mt-0 grid gap-0.5">
        <ProjectMetadata label="Project" value={activeProject.name} />
        {activeProject.resourceId && <ProjectMetadata label="Resource ID" value={activeProject.resourceId} />}
        {activeProject.gitBranch && <ProjectMetadata label="Branch" value={activeProject.gitBranch} />}
        <ProjectMetadata label="Workspace" value={activeProject.path} />
      </dl>
      <p className="mb-6 mt-0 text-icon3">Ready for new conversation</p>
    </div>
  );
}

function ProjectMetadata({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-24 text-icon2">{label}</dt>
      <dd className="m-0 break-words text-icon5">{value}</dd>
    </div>
  );
}

function WorkingIndicator() {
  return (
    <div className="flex items-center gap-2 px-2 py-2" aria-live="polite" aria-label="Agent is working">
      <Spinner className="text-icon3" />
      <Txt as="span" variant="ui-sm" className="text-icon3">
        Thinking…
      </Txt>
    </div>
  );
}

function ScrollToLatestButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="default"
      size="icon-sm"
      className="absolute bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full shadow-md"
      onClick={onClick}
      aria-label="Jump to latest message"
    >
      <ArrowDown size={18} />
    </Button>
  );
}
