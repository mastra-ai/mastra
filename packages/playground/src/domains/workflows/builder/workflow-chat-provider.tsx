import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { ClientToolsInput } from '@mastra/react';
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { serializeWorkflowDraftInstructions } from './workflow-conversation';
import type { WorkflowDraftAuthoringState, WorkflowDraftValidationContext } from './workflow-draft';
import { createWorkflowDraftCandidate } from './workflow-draft-tools';
import type { WorkflowDraftCandidate, WorkflowDraftToolResult } from './workflow-draft-tools';
import { StreamChatProvider } from '@/domains/agent-builder/contexts/stream-chat-provider';

export interface WorkflowGenerationFailure {
  code: 'repair-budget-exhausted' | 'no-accepted-draft' | 'generation-failed';
  message: string;
}

type WorkflowGenerationPhase = 'constructing' | 'checkpointed' | 'repairing' | 'finalized';

const WORKFLOW_MUTATION_TOOL_IDS = new Set([
  'add-workflow-step',
  'update-workflow-step',
  'remove-workflow-step',
  'set-workflow-metadata',
]);

export interface WorkflowChatProviderProps {
  threadId: string;
  authoringState: WorkflowDraftAuthoringState;
  validationContext?: WorkflowDraftValidationContext;
  initialMessages: MastraDBMessage[];
  initialUserMessage?: string;
  createTools: (
    isCurrentGeneration?: () => boolean,
    onResult?: (event: WorkflowDraftToolResult) => void,
    candidate?: WorkflowDraftCandidate,
    onCandidateChange?: (candidate: WorkflowDraftCandidate) => void,
    getToolBlockReason?: (toolId: string) => string | undefined,
  ) => ClientToolsInput;
  onGenerationFailure?: (failure: WorkflowGenerationFailure | null) => void;
  onCandidateChange?: (candidate: WorkflowDraftCandidate | undefined) => void;
  debounceTime?: number;
  children: ReactNode;
}

export function WorkflowChatProvider(props: WorkflowChatProviderProps) {
  const hydrationKey = props.initialMessages[0]?.id ?? 'empty';
  return <WorkflowChatSession key={hydrationKey} {...props} />;
}

function WorkflowChatSession({
  threadId,
  authoringState,
  validationContext,
  initialMessages,
  initialUserMessage,
  createTools,
  onGenerationFailure,
  onCandidateChange,
  debounceTime = 300,
  children,
}: WorkflowChatProviderProps) {
  const [hydrationMessages] = useState(initialMessages);
  const [candidateSnapshot, setCandidateSnapshot] = useState<WorkflowDraftCandidate>();
  const candidateRef = useRef<WorkflowDraftCandidate | undefined>(undefined);
  const authoringStateRef = useRef(authoringState);
  authoringStateRef.current = authoringState;
  const generationRef = useRef(0);
  const generationStateRef = useRef({
    accepted: false,
    finalized: false,
    phase: 'constructing' as WorkflowGenerationPhase,
    rejected: 0,
    rejectionSignature: undefined as string | undefined,
    stopped: false,
  });

  const updateCandidate = useCallback(
    (candidate: WorkflowDraftCandidate) => {
      candidateRef.current = candidate;
      setCandidateSnapshot(candidate);
      onCandidateChange?.(candidate);
    },
    [onCandidateChange],
  );

  const failGeneration = useCallback(
    (failure: WorkflowGenerationFailure) => {
      generationStateRef.current.stopped = true;
      onGenerationFailure?.(failure);
    },
    [onGenerationFailure],
  );

  const createClientTools = useCallback(() => {
    const generation = ++generationRef.current;
    const acceptedState = authoringStateRef.current;
    const existingCandidate = candidateRef.current;
    const candidate =
      existingCandidate?.baseAcceptedRevision === acceptedState.revision
        ? existingCandidate
        : createWorkflowDraftCandidate(acceptedState);
    generationStateRef.current = {
      accepted: acceptedState.revision > 0,
      finalized: false,
      phase: candidate.hasUncheckpointedChanges
        ? 'repairing'
        : acceptedState.revision > 0
          ? 'checkpointed'
          : 'constructing',
      rejected: 0,
      rejectionSignature: undefined,
      stopped: false,
    };
    onGenerationFailure?.(null);
    updateCandidate(candidate);

    const onResult = ({ toolId, result }: WorkflowDraftToolResult) => {
      if (generation !== generationRef.current || generationStateRef.current.stopped) return;
      const isCheckpoint = toolId === 'checkpoint-workflow-draft' || toolId === 'checkpoint-workflow-candidate';
      const isFinalize = toolId === 'finalize-workflow-draft';
      const isMutation = WORKFLOW_MUTATION_TOOL_IDS.has(toolId);
      if (result.success) {
        if (isCheckpoint || isFinalize) {
          generationStateRef.current.accepted = true;
          generationStateRef.current.rejected = 0;
          generationStateRef.current.rejectionSignature = undefined;
        }
        if (isCheckpoint) generationStateRef.current.phase = 'checkpointed';
        if (isMutation) generationStateRef.current.phase = 'repairing';
        if (isFinalize) {
          generationStateRef.current.finalized = true;
          generationStateRef.current.phase = 'finalized';
        }
        return;
      }
      if (isFinalize) generationStateRef.current.phase = 'repairing';
      if (!isCheckpoint && !isFinalize) return;
      if (
        result.error === 'Draft changed before this operation completed.' ||
        result.error === 'Generation candidate changed before checkpoint completed.' ||
        result.error === 'Submission was superseded.'
      )
        return;

      const rejectionSignature = JSON.stringify({
        toolId,
        issues: result.issues?.map(issue => ({ code: issue.code, path: issue.path })) ?? [],
        error: result.issues?.length ? undefined : result.error,
      });
      if (generationStateRef.current.rejectionSignature === rejectionSignature) {
        generationStateRef.current.rejected += 1;
      } else {
        generationStateRef.current.rejectionSignature = rejectionSignature;
        generationStateRef.current.rejected = 1;
      }
      if (generationStateRef.current.rejected >= 3) {
        failGeneration({
          code: 'repair-budget-exhausted',
          message:
            'Workflow generation stopped after three equivalent rejected draft repairs. Review the latest issues and retry.',
        });
      }
    };

    const getToolBlockReason = (toolId: string) => {
      const phase = generationStateRef.current.phase;
      if (phase === 'checkpointed' && WORKFLOW_MUTATION_TOOL_IDS.has(toolId)) {
        return 'The accepted draft is already checkpointed. Call finalize-workflow-draft before making further edits.';
      }
      if (toolId === 'checkpoint-workflow-draft' && phase === 'checkpointed') {
        return 'The accepted draft is already checkpointed. Call finalize-workflow-draft with its accepted revision.';
      }
      if (toolId === 'checkpoint-workflow-draft' && phase === 'repairing') {
        return 'Preserve the last accepted revision. Use targeted workflow-step repair tools, then checkpoint-workflow-candidate.';
      }
      if (toolId === 'checkpoint-workflow-candidate' && phase !== 'repairing') {
        return 'There are no generation-local repairs to checkpoint. Finalize the accepted draft instead.';
      }
      if (toolId === 'finalize-workflow-draft' && phase === 'constructing') {
        return 'Checkpoint a complete workflow draft before finalizing it.';
      }
      if (toolId === 'finalize-workflow-draft' && phase === 'repairing') {
        return 'Checkpoint the repaired candidate with checkpoint-workflow-candidate before finalizing it.';
      }
      return undefined;
    };

    return createTools(
      () =>
        generation === generationRef.current &&
        !generationStateRef.current.stopped &&
        !generationStateRef.current.finalized,
      onResult,
      candidate,
      updateCandidate,
      getToolBlockReason,
    );
  }, [createTools, failGeneration, onGenerationFailure, updateCandidate]);

  const handleSendComplete = useCallback(() => {
    const state = generationStateRef.current;
    if (state.stopped || state.finalized) return;
    failGeneration({
      code: state.accepted ? 'generation-failed' : 'no-accepted-draft',
      message: state.accepted
        ? 'Workflow generation ended before the draft was finalized. The last accepted draft was preserved.'
        : 'Workflow generation ended without creating an accepted draft. Retry with more specific workflow steps.',
    });
  }, [failGeneration]);

  const handleSendError = useCallback(
    (error: Error) => failGeneration({ code: 'generation-failed', message: error.message }),
    [failGeneration],
  );

  return (
    <StreamChatProvider
      agentId="workflow-builder"
      streamPath="/editor/workflow-builder/stream"
      threadId={threadId}
      initialMessages={hydrationMessages}
      initialUserMessage={initialUserMessage}
      createClientTools={createClientTools}
      extraInstructions={serializeWorkflowDraftInstructions(authoringState, validationContext, candidateSnapshot)}
      enableThreadSignals={false}
      debounceTime={debounceTime}
      maxSteps={10}
      onSendComplete={handleSendComplete}
      onSendError={handleSendError}
    >
      {children}
    </StreamChatProvider>
  );
}
