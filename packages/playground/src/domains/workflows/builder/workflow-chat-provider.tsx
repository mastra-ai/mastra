import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { ClientToolsInput } from '@mastra/react';
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { getWorkflowToolsForPhase, isWorkflowMutationTool } from './workflow-chat-tools';
import type { WorkflowGenerationPhase } from './workflow-chat-tools';
import { getOriginalWorkflowRequest, serializeWorkflowDraftInstructions } from './workflow-conversation';
import type { WorkflowDraftAuthoringState, WorkflowDraftValidationContext } from './workflow-draft';
import { createWorkflowDraftCandidate } from './workflow-draft-tools';
import type { WorkflowDraftCandidate, WorkflowDraftToolResult } from './workflow-draft-tools';
import { StreamChatProvider } from '@/domains/agent-builder/contexts/stream-chat-provider';

export interface WorkflowGenerationFailure {
  code: 'repair-budget-exhausted' | 'no-accepted-draft' | 'generation-failed';
  message: string;
}

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
    autoFinalizeRepair?: boolean,
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
  const [originalRequest] = useState(() => initialUserMessage ?? getOriginalWorkflowRequest(initialMessages));
  const [candidateSnapshot, setCandidateSnapshot] = useState<WorkflowDraftCandidate>();
  const candidateRef = useRef<WorkflowDraftCandidate | undefined>(undefined);
  const authoringStateRef = useRef(authoringState);
  authoringStateRef.current = authoringState;
  const generationRef = useRef(0);
  const generationToolsRef = useRef<ClientToolsInput>({});
  const generationStateRef = useRef({
    accepted: false,
    finalized: false,
    phase: 'constructing' as WorkflowGenerationPhase,
    constructionRejected: 0,
    constructionRejectionSignature: undefined as string | undefined,
    repairRejected: 0,
    repairRejectionSignature: undefined as string | undefined,
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
      constructionRejected: 0,
      constructionRejectionSignature: undefined,
      repairRejected: 0,
      repairRejectionSignature: undefined,
      stopped: false,
    };
    onGenerationFailure?.(null);
    updateCandidate(candidate);

    const onResult = ({ toolId, result }: WorkflowDraftToolResult) => {
      if (generation !== generationRef.current || generationStateRef.current.stopped) return;
      const isCheckpoint = toolId === 'checkpoint-workflow-draft' || toolId === 'checkpoint-workflow-candidate';
      const isFinalize = toolId === 'finalize-workflow-draft';
      const isMutation = isWorkflowMutationTool(toolId);
      if (result.success) {
        if (isCheckpoint || isFinalize) generationStateRef.current.accepted = true;
        if (toolId === 'checkpoint-workflow-draft') {
          generationStateRef.current.constructionRejected = 0;
          generationStateRef.current.constructionRejectionSignature = undefined;
        }
        if (toolId === 'checkpoint-workflow-candidate' || isFinalize) {
          generationStateRef.current.repairRejected = 0;
          generationStateRef.current.repairRejectionSignature = undefined;
        }
        if (isCheckpoint) generationStateRef.current.phase = 'checkpointed';
        if (isMutation) generationStateRef.current.phase = 'repairing';
        if (
          isFinalize ||
          (toolId === 'checkpoint-workflow-candidate' && result.finalizedRevision === result.revision)
        ) {
          generationStateRef.current.finalized = true;
          generationStateRef.current.phase = 'finalized';
        }
        return;
      }
      if (
        result.error === 'Draft changed before this operation completed.' ||
        result.error === 'Generation candidate changed before checkpoint completed.' ||
        result.error === 'Submission was superseded.' ||
        getToolBlockReason(toolId) !== undefined
      )
        return;
      if (!isCheckpoint && !isFinalize && !isMutation) return;

      const budget = toolId === 'checkpoint-workflow-draft' ? 'construction' : 'repair';
      if (isFinalize) generationStateRef.current.phase = 'repairing';
      const rejectionSignature = JSON.stringify({
        toolId,
        issues: result.issues?.map(issue => ({ code: issue.code, path: issue.path })) ?? [],
        error: result.issues?.length ? undefined : result.error,
      });
      const signatureKey = budget === 'construction' ? 'constructionRejectionSignature' : 'repairRejectionSignature';
      const countKey = budget === 'construction' ? 'constructionRejected' : 'repairRejected';
      if (generationStateRef.current[signatureKey] === rejectionSignature) {
        generationStateRef.current[countKey] += 1;
      } else {
        generationStateRef.current[signatureKey] = rejectionSignature;
        generationStateRef.current[countKey] = 1;
      }
      if (generationStateRef.current[countKey] >= 3) {
        failGeneration({
          code: 'repair-budget-exhausted',
          message:
            budget === 'construction'
              ? 'Workflow generation stopped after three equivalent rejected construction attempts. Review the latest issues and retry.'
              : 'Workflow generation stopped after three equivalent rejected repairs. Review the latest issues and retry.',
        });
      }
    };

    const getToolBlockReason = (toolId: string) => {
      const phase = generationStateRef.current.phase;
      if (phase === 'checkpointed' && isWorkflowMutationTool(toolId)) {
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

    const tools = createTools(
      () =>
        generation === generationRef.current &&
        !generationStateRef.current.stopped &&
        !generationStateRef.current.finalized,
      onResult,
      candidate,
      updateCandidate,
      getToolBlockReason,
      true,
    );
    generationToolsRef.current = tools;
    return getWorkflowToolsForPhase(tools, generationStateRef.current.phase);
  }, [createTools, failGeneration, onGenerationFailure, updateCandidate]);

  const resolveClientTools = useCallback(() => {
    const state = generationStateRef.current;
    if (state.stopped || state.finalized) return {};
    return getWorkflowToolsForPhase(generationToolsRef.current, state.phase);
  }, []);

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
      clientToolsResolver={resolveClientTools}
      extraInstructions={serializeWorkflowDraftInstructions(
        authoringState,
        validationContext,
        candidateSnapshot,
        originalRequest,
      )}
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
