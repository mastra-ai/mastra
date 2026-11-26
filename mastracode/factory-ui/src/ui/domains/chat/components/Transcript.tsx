import type { PlanResume } from '@mastra/client-js';
import { ArrivalScope } from '@mastra/playground-ui/components/Arrival';
import { TranscriptEntries as HostTranscriptEntries } from '@mastra/playground-ui/domains/chat/transcript/components/transcript-entries';
import { TranscriptSlotsProvider } from '@mastra/playground-ui/domains/chat/transcript/components/slots';
import type { TranscriptSlots } from '@mastra/playground-ui/domains/chat/transcript/components/slots';
import type { ComponentProps } from 'react';
import { useCallback } from 'react';

import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import {
  useApproveAgentControllerToolMutation,
  useRespondAgentControllerSuspensionMutation,
  isEndedPrompt,
} from '../../../../hooks/useAgentControllerRunMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { drawsModelFallback, ModelFallbackPart } from './ModelFallbackActivity';
import { RunErrorNotice } from './RunErrorNotice';
import { NotificationCard, NotificationSummaryCard } from './TranscriptNotifications';
import { ApprovalCard, SubagentCard, SuspensionCard } from './TranscriptPromptCards';
import { SubmitPlanCard } from './SubmitPlanCard';
import { FactoryKnowledgeLinks } from './knowledge/FactoryKnowledgeLinks';

import type { TranscriptTail } from '@mastra/playground-ui/domains/chat/transcript/components/transcript-entries';

export type { TranscriptTail };

/** Factory's own cards for the rows that act on its backend. */
export const FACTORY_TRANSCRIPT_SLOTS: TranscriptSlots = {
  RunError: RunErrorNotice,
  Notification: NotificationCard,
  NotificationSummary: NotificationSummaryCard,
  Approval: ApprovalCard,
  Suspension: SuspensionCard,
  Subagent: SubagentCard,
  SubmitPlan: SubmitPlanCard,
  DataPart: { draws: drawsModelFallback, Component: ModelFallbackPart },
};

export function TranscriptEntries(props: ComponentProps<typeof HostTranscriptEntries>) {
  return (
    <TranscriptSlotsProvider slots={FACTORY_TRANSCRIPT_SLOTS}>
      <FactoryKnowledgeLinks>
        <HostTranscriptEntries {...props} />
      </FactoryKnowledgeLinks>
    </TranscriptSlotsProvider>
  );
}

export function Transcript({ tail }: { tail?: TranscriptTail }) {
  const { sessionId, sessionEnabled, baseUrl, owner } = useChatSessionContext();
  const { transcript, resolvePrompt, busy, viewerId } = useChatTranscript();
  const { entries } = transcript;
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  };
  const { mutateAsync: approve, isPending: approving } = useApproveAgentControllerToolMutation(hookArgs);
  const { mutateAsync: respond, isPending: responding } = useRespondAgentControllerSuspensionMutation(hookArgs);

  // Pinned: these reach every entry, and a fresh pair each token would redraw the lot.
  const onApprove = useCallback(
    async (toolCallId: string, approved: boolean, promptId: string) => {
      const done = await approve({ toolCallId, approved }).then(
        () => true,
        // The mutation already reported it. Drop a prompt whose run has ended;
        // keep any other so the card stays truthful.
        isEndedPrompt,
      );
      if (done) resolvePrompt(promptId);
    },
    [approve, resolvePrompt],
  );
  const onRespond = useCallback(
    async (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => {
      const done = await respond({ toolCallId, resumeData }).then(
        () => true,
        // The mutation already reported it. Drop a prompt whose run has ended;
        // keep any other so the card stays truthful.
        isEndedPrompt,
      );
      if (done) resolvePrompt(promptId);
    },
    [respond, resolvePrompt],
  );

  return (
    <ArrivalScope>
      <TranscriptEntries
        entries={entries}
        restoredHistory
        isSubmitting={approving || responding || !sessionEnabled}
        onApprove={onApprove}
        onRespond={onRespond}
        running={busy}
        viewerId={viewerId}
        owner={owner}
        tail={tail}
      />
    </ArrivalScope>
  );
}
