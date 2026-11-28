import type { PlanResume } from '@mastra/client-js';
import type { ComponentProps } from 'react';
import { useCallback } from 'react';
import { isEndedPrompt } from '../context/ChatSessionActionsContext';
import { useChatSessionActions } from '../context/useChatSessionActions';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';

import { drawsModelFallback } from '../services/modelFallback';
import { FactoryKnowledgeLinks } from './knowledge/FactoryKnowledgeLinks';
import { ModelFallbackPart } from './ModelFallbackActivity';
import { RunErrorNotice } from './RunErrorNotice';
import { SubmitPlanCard } from './SubmitPlanCard';
import { NotificationCard, NotificationSummaryCard } from './TranscriptNotifications';
import { ApprovalCard, SubagentCard, SuspensionCard } from './TranscriptPromptCards';
import { TranscriptSlotsProvider } from '@/domains/chat/transcript/components/slots';
import type { TranscriptSlots } from '@/domains/chat/transcript/components/slots';
import { TranscriptEntries as HostTranscriptEntries } from '@/domains/chat/transcript/components/transcript-entries';
import type { TranscriptTail } from '@/domains/chat/transcript/components/transcript-entries';

import { ArrivalScope } from '@/ds/components/Arrival';

export type { TranscriptTail };

/** Factory's own cards for the rows that act on its backend. */
const FACTORY_TRANSCRIPT_SLOTS: TranscriptSlots = {
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
  const { sessionEnabled, owner } = useChatSessionContext();
  const { transcript, resolvePrompt, busy, viewerId } = useChatTranscript();
  const { entries } = transcript;
  const { approveTool: approve, respondToSuspension: respond, replying } = useChatSessionActions();

  // Pinned: these reach every entry, and a fresh pair each token would redraw the lot.
  const onApprove = useCallback(
    async (toolCallId: string, approved: boolean, promptId: string) => {
      const done = await approve(toolCallId, approved).then(
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
      const done = await respond(toolCallId, resumeData).then(
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
        isSubmitting={replying || !sessionEnabled}
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
