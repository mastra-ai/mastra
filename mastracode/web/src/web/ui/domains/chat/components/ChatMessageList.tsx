import type { PlanResume } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowDown } from 'lucide-react';
import type { RefObject } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { SkeletonRows, Wordmark } from '../../../ui';
import type { Project } from '../../workspaces';
import { useActiveProjectContext } from '../../workspaces';
import type { ChatSessionApi } from '../context/ChatSessionProvider';
import { useChatSession } from '../context/ChatSessionProvider';
import {
  useClearAgentControllerGoalMutation,
  usePauseAgentControllerGoalMutation,
  useResumeAgentControllerGoalMutation,
  useSetAgentControllerGoalMutation,
} from '../hooks/useAgentControllerGoalMutations';
import {
  useApproveAgentControllerToolMutation,
  useRespondAgentControllerSuspensionMutation,
} from '../hooks/useAgentControllerRunMutations';
import { useTranscriptScroll } from '../hooks/useTranscriptScroll';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ConnectionNotice } from './ConnectionNotice';
import { GoalPanel } from './GoalPanel';
import { Transcript } from './Transcript';

type TranscriptState = ChatSessionApi['transcript'];

const transcriptScrollClass =
  'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scroll-smooth px-3 pb-2 pt-6 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[80ch]';
const emptyThreadClass = 'w-full max-w-[80ch] px-7 text-left font-mono text-sm leading-relaxed text-icon3';

export function ChatMessageList() {
  const { baseUrl } = useApiConfig();
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const { transcript, status, showWorkingIndicator, messagesPending, resolvePrompt } = useChatSession();
  const { threadRef, showScrollDown, scrollToBottom } = useTranscriptScroll(transcript);
  const hookArgs = { agentControllerId: AGENT_CONTROLLER_ID, resourceId, baseUrl, enabled: sessionEnabled };
  const approveMutation = useApproveAgentControllerToolMutation(hookArgs);
  const respondMutation = useRespondAgentControllerSuspensionMutation(hookArgs);
  const setGoalMutation = useSetAgentControllerGoalMutation(hookArgs);
  const pauseGoalMutation = usePauseAgentControllerGoalMutation(hookArgs);
  const resumeGoalMutation = useResumeAgentControllerGoalMutation(hookArgs);
  const clearGoalMutation = useClearAgentControllerGoalMutation(hookArgs);

  if (!activeProject) return null;

  const onApprove = (toolCallId: string, approved: boolean, id: string) => {
    resolvePrompt(id);
    void approveMutation.mutateAsync({ toolCallId, approved });
  };
  const onRespond = (toolCallId: string, resumeData: string | string[] | PlanResume, id: string) => {
    resolvePrompt(id);
    void respondMutation.mutateAsync({ toolCallId, resumeData });
  };

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      {transcript.goal && (
        <GoalPanel
          goal={transcript.goal}
          onSetGoal={goal => void setGoalMutation.mutateAsync(goal)}
          onPauseGoal={() => void pauseGoalMutation.mutateAsync()}
          onResumeGoal={() => void resumeGoalMutation.mutateAsync()}
          onClearGoal={() => void clearGoalMutation.mutateAsync()}
        />
      )}

      <ConnectionNotice />

      <TranscriptPanel
        activeProject={activeProject}
        transcript={transcript}
        showWorkingIndicator={showWorkingIndicator}
        messagesPending={messagesPending || status === 'connecting'}
        threadRef={threadRef}
        onApprove={onApprove}
        onRespond={onRespond}
      />

      {showScrollDown && <ScrollToLatestButton onClick={() => scrollToBottom('smooth')} />}
    </div>
  );
}

type TranscriptPanelProps = {
  activeProject: Project;
  transcript: TranscriptState;
  showWorkingIndicator: boolean;
  messagesPending: boolean;
  threadRef: RefObject<HTMLDivElement | null>;
  onApprove: (toolCallId: string, approved: boolean, id: string) => void;
  onRespond: (toolCallId: string, data: string | string[] | PlanResume, id: string) => void;
};

function TranscriptPanel({
  activeProject,
  transcript,
  showWorkingIndicator,
  messagesPending,
  threadRef,
  onApprove,
  onRespond,
}: TranscriptPanelProps) {
  if (transcript.entries.length === 0 && messagesPending) {
    return (
      <div className={transcriptScrollClass} ref={threadRef}>
        <SkeletonRows label="Loading messages" rows={6} />
      </div>
    );
  }

  const panelClassName =
    transcript.entries.length === 0 ? `${transcriptScrollClass} place-items-center` : transcriptScrollClass;

  return (
    <div className={panelClassName} ref={threadRef}>
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
