import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { ClientToolsInput } from '@mastra/react';
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { getOriginalWorkflowRequest, serializeWorkflowDraftInstructions } from './workflow-conversation';
import type { WorkflowDraftAuthoringState } from './workflow-draft';
import { createWorkflowDraftCandidate } from './workflow-draft-tools';
import type { WorkflowDraftCandidate, WorkflowDraftToolResult } from './workflow-draft-tools';
import { StreamChatProvider } from '@/domains/agent-builder/contexts/stream-chat-provider';

export interface WorkflowGenerationFailure {
  code: 'no-accepted-draft' | 'generation-failed' | 'stopped-by-user';
  message: string;
}

export interface WorkflowChatProviderProps {
  threadId: string;
  authoringState: WorkflowDraftAuthoringState;
  initialMessages: MastraDBMessage[];
  initialUserMessage?: string;
  createTools: (
    isCurrentGeneration?: () => boolean,
    onResult?: (event: WorkflowDraftToolResult) => void,
    candidate?: WorkflowDraftCandidate,
    onCandidateChange?: (candidate: WorkflowDraftCandidate) => void,
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

/**
 * Whether a complete, finalized definition is currently on the canvas. A draft
 * loaded from a stored workflow starts at revision 0, so `revision > 0` only
 * means "edited during this session" and must never be used to decide whether
 * an accepted draft exists.
 */
function hasAcceptedDraft(state: WorkflowDraftAuthoringState) {
  return state.lifecycle === 'ready' && state.finalizedRevision === state.revision;
}

function WorkflowChatSession({
  threadId,
  authoringState,
  initialMessages,
  initialUserMessage,
  createTools,
  onGenerationFailure,
  onCandidateChange,
  debounceTime = 300,
  children,
}: WorkflowChatProviderProps) {
  const [hydrationMessages] = useState(initialMessages);
  // Seeded from a starter message or rehydrated history when either exists. A
  // workflow created from the editor has neither: the request is only typed
  // once the chat is already open, so it has to be captured from the first
  // live send or the pin stays empty for the life of the session.
  const [originalRequest, setOriginalRequest] = useState(
    () => initialUserMessage ?? getOriginalWorkflowRequest(initialMessages),
  );
  const captureOriginalRequest = useCallback((message: string) => {
    setOriginalRequest(current => current ?? message);
  }, []);
  const [candidateSnapshot, setCandidateSnapshot] = useState<WorkflowDraftCandidate>();
  const candidateRef = useRef<WorkflowDraftCandidate | undefined>(undefined);
  const authoringStateRef = useRef(authoringState);
  authoringStateRef.current = authoringState;
  const generationRef = useRef(0);
  const generationStateRef = useRef({
    accepted: false,
    finalized: false,
    stopped: false,
    submissionAttempted: false,
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
      accepted: hasAcceptedDraft(acceptedState),
      finalized: false,
      stopped: false,
      submissionAttempted: false,
    };
    onGenerationFailure?.(null);
    updateCandidate(candidate);

    const onResult = ({ toolId, result }: WorkflowDraftToolResult) => {
      if (generation !== generationRef.current || generationStateRef.current.stopped) return;
      if (toolId !== 'submit-workflow-draft') return;
      generationStateRef.current.submissionAttempted = true;
      // A rejection is not a failed turn: the model still has steps left and the
      // diagnostics tell it what to fix. The user can stop it if it never does.
      if (!result.success) return;
      generationStateRef.current.accepted = true;
      generationStateRef.current.finalized = result.finalizedRevision === result.revision;
      onGenerationFailure?.(null);
    };

    return createTools(
      () => !generationStateRef.current.stopped && !generationStateRef.current.finalized,
      onResult,
      candidate,
      updateCandidate,
    );
  }, [createTools, onGenerationFailure, updateCandidate]);

  const handleSendComplete = useCallback(() => {
    const state = generationStateRef.current;
    if (state.stopped || state.finalized) return;
    // Read the authoritative draft rather than the snapshot taken when the turn
    // started: a submission may have gone Ready during this turn.
    const accepted = state.accepted || hasAcceptedDraft(authoringStateRef.current);
    // Follow-up chat turns never call submit-workflow-draft. A turn that never
    // attempted a submission is a conversation, not a failed generation.
    if (!state.submissionAttempted) {
      if (accepted) return;
      failGeneration({
        code: 'no-accepted-draft',
        message:
          'Workflow generation ended without creating an accepted draft. Retry with more specific workflow steps.',
      });
      return;
    }
    // A submission was attempted and the turn ended without finalizing. Never
    // claim there is no accepted draft while a complete one is on the canvas.
    failGeneration({
      code: accepted ? 'generation-failed' : 'no-accepted-draft',
      message: accepted
        ? 'Workflow generation ended before applying the requested change. The accepted draft is unchanged.'
        : 'Workflow generation ended without creating an accepted draft. Retry with more specific workflow steps.',
    });
  }, [failGeneration]);

  const handleSendError = useCallback(
    (error: Error) => failGeneration({ code: 'generation-failed', message: error.message }),
    [failGeneration],
  );

  const handleSendCancel = useCallback(() => {
    // The user aborted deliberately, so this reports what happened rather than
    // diagnosing the draft. Whatever was accepted before the stop is untouched.
    failGeneration({
      code: 'stopped-by-user',
      message: 'You stopped this generation. Send another message to pick up where it left off.',
    });
  }, [failGeneration]);

  return (
    <StreamChatProvider
      agentId="workflow-builder"
      streamPath="/editor/workflow-builder/stream"
      threadId={threadId}
      initialMessages={hydrationMessages}
      initialUserMessage={initialUserMessage}
      createClientTools={createClientTools}
      extraInstructions={serializeWorkflowDraftInstructions(authoringState, candidateSnapshot, originalRequest)}
      // Per-turn authoring state, not a standalone prompt. Sending it as
      // `instructions` would replace the hidden agent's shared authoring
      // playbook and Studio surface instructions, leaving the model to compose
      // graphs with no canonical examples.
      extraInstructionsMode="append"
      enableThreadSignals={false}
      debounceTime={debounceTime}
      maxSteps={1000}
      onSendStart={captureOriginalRequest}
      onSendComplete={handleSendComplete}
      onSendError={handleSendError}
      onSendCancel={handleSendCancel}
    >
      {children}
    </StreamChatProvider>
  );
}
