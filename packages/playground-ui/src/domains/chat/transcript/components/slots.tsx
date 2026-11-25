import type { PlanResume } from '@mastra/client-js';
import type { MastraErrorPart } from '@mastra/core/agent/message-list';
import { createContext, useContext } from 'react';
import type { ComponentType, ReactNode } from 'react';

import type {
  ApprovalPrompt,
  NotificationEntry,
  NotificationSummaryEntry,
  SubagentEntry,
  SuspensionPrompt,
} from '../services/transcript';
import { ToolApproval } from '@/ds/components/ai/tool-approval';

import { Notice } from '@/ds/components/Notice';

export interface TranscriptRunErrorProps {
  error: MastraErrorPart['error'];
  entryId: string;
}

export interface TranscriptSubmitPlanProps {
  toolCallId: string;
  input?: unknown;
  output?: unknown;
  isSubmitting?: boolean;
  onRespond?: (response: PlanResume) => void;
}

/**
 * The rows a host draws itself: anything that acts on the host's own backend (recovery actions,
 * approvals, plan handoff, notification links). A host that leaves one out gets a plain read-only row.
 */
export interface TranscriptSlots {
  RunError?: ComponentType<TranscriptRunErrorProps>;
  Notification?: ComponentType<{ entry: NotificationEntry }>;
  NotificationSummary?: ComponentType<{ entry: NotificationSummaryEntry }>;
  Approval?: ComponentType<{
    prompt: ApprovalPrompt;
    isSubmitting: boolean;
    onApprove: (toolCallId: string, approved: boolean, promptId: string) => void;
  }>;
  Suspension?: ComponentType<{
    prompt: SuspensionPrompt;
    isSubmitting: boolean;
    onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
  }>;
  Subagent?: ComponentType<{ entry: SubagentEntry }>;
  SubmitPlan?: ComponentType<TranscriptSubmitPlanProps>;
}

const TranscriptSlotsContext = createContext<TranscriptSlots>({});

export function TranscriptSlotsProvider({ slots, children }: { slots: TranscriptSlots; children: ReactNode }) {
  return <TranscriptSlotsContext.Provider value={slots}>{children}</TranscriptSlotsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- helper intentionally co-located with the components that use it
export function useTranscriptSlots(): TranscriptSlots {
  return useContext(TranscriptSlotsContext);
}

function errorText(error: MastraErrorPart['error']): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'The run failed.';
}

export function DefaultRunError({ error }: TranscriptRunErrorProps) {
  return (
    <Notice className="my-2" variant="destructive">
      {errorText(error)}
    </Notice>
  );
}

export function ApprovalCard({
  prompt,
  isSubmitting,
  onApprove,
}: {
  prompt: ApprovalPrompt;
  isSubmitting: boolean;
  onApprove: (toolCallId: string, approved: boolean, promptId: string) => void;
}) {
  return (
    <ToolApproval
      toolName={prompt.toolName}
      args={prompt.args}
      autoFocus
      disabled={isSubmitting}
      onApprove={() => onApprove(prompt.toolCallId, true, prompt.id)}
      onDecline={() => onApprove(prompt.toolCallId, false, prompt.id)}
    />
  );
}

export function DefaultNotification({ entry }: { entry: NotificationEntry | NotificationSummaryEntry }) {
  return (
    <Notice className="my-2" variant="info">
      {entry.message}
    </Notice>
  );
}
