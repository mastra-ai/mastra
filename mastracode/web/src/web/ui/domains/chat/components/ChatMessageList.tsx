import type { PlanResume } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowDown } from 'lucide-react';

import { Wordmark } from '../../../ui';
import type { Project } from '../../workspaces';
import { useActiveProjectContext } from '../../workspaces';
import { useChatConnection } from '../context/useChatConnection';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import {
  useApproveAgentControllerToolMutation,
  useRespondAgentControllerSuspensionMutation,
} from '../hooks/useAgentControllerRunMutations';
import { useTranscriptScroll } from '../hooks/useTranscriptScroll';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { GoalPanel } from './GoalPanel';
import { Transcript } from './Transcript';

const transcriptScrollClass =
  'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scroll-smooth px-3 pb-2 pt-6 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[80ch]';
const emptyThreadClass = 'w-full max-w-[80ch] px-7 text-left font-mono text-sm leading-relaxed text-icon3';

export function ChatMessageList() {
  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      <GoalPanel />
      <ConnectionNotice />
      <TranscriptPanel />
    </div>
  );
}

function ConnectionNotice() {
  const { status } = useChatConnection();
  if (status !== 'reconnecting' && status !== 'error') return null;

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

function TranscriptPanel() {
  const { activeProject } = useActiveProjectContext();
  const { resourceId, sessionEnabled, baseUrl } = useChatSessionContext();
  const { transcript, showWorkingIndicator, resolvePrompt } = useChatTranscript();
  const { threadRef, showScrollDown, scrollToBottom } = useTranscriptScroll(transcript);
  const hookArgs = { agentControllerId: AGENT_CONTROLLER_ID, resourceId, baseUrl, enabled: sessionEnabled };
  const approveMutation = useApproveAgentControllerToolMutation(hookArgs);
  const respondMutation = useRespondAgentControllerSuspensionMutation(hookArgs);

  if (!activeProject) return null;

  const onApprove = (toolCallId: string, approved: boolean, id: string) => {
    resolvePrompt(id);
    void approveMutation.mutateAsync({ toolCallId, approved });
  };

  const onRespond = (toolCallId: string, resumeData: string | string[] | PlanResume, id: string) => {
    resolvePrompt(id);
    void respondMutation.mutateAsync({ toolCallId, resumeData });
  };

  const panelClassName =
    transcript.entries.length === 0 ? `${transcriptScrollClass} place-items-center` : transcriptScrollClass;

  const scrollToLatest = () => scrollToBottom('smooth');

  return (
    <>
      <div className={panelClassName} ref={threadRef}>
        {transcript.entries.length === 0 && <EmptyThreadState activeProject={activeProject} />}
        <Transcript entries={transcript.entries} onApprove={onApprove} onRespond={onRespond} />
        {showWorkingIndicator && <WorkingIndicator />}
      </div>

      {showScrollDown && (
        <Button
          variant="default"
          size="icon-sm"
          className="absolute bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full shadow-md"
          onClick={scrollToLatest}
          aria-label="Jump to latest message"
        >
          <ArrowDown size={18} />
        </Button>
      )}
    </>
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
