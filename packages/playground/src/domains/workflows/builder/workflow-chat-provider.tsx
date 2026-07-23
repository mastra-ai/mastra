import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { ClientToolsInput } from '@mastra/react';
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { serializeWorkflowDraftInstructions } from './workflow-conversation';
import type { WorkflowDraftAuthoringState, WorkflowDraftValidationContext } from './workflow-draft';
import type { WorkflowDraftToolResult } from './workflow-draft-tools';
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
  ) => ClientToolsInput;
  onGenerationFailure?: (failure: WorkflowGenerationFailure | null) => void;
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
  debounceTime = 300,
  children,
}: WorkflowChatProviderProps) {
  const [hydrationMessages] = useState(initialMessages);
  const generationRef = useRef(0);
  const generationStateRef = useRef({ accepted: false, finalized: false, rejected: 0, stopped: false });

  const failGeneration = useCallback(
    (failure: WorkflowGenerationFailure) => {
      generationStateRef.current.stopped = true;
      onGenerationFailure?.(failure);
    },
    [onGenerationFailure],
  );

  const createClientTools = useCallback(() => {
    const generation = ++generationRef.current;
    generationStateRef.current = { accepted: false, finalized: false, rejected: 0, stopped: false };
    onGenerationFailure?.(null);

    const onResult = ({ toolId, result }: WorkflowDraftToolResult) => {
      if (generation !== generationRef.current || generationStateRef.current.stopped) return;
      if (result.success) {
        generationStateRef.current.accepted = true;
        if (toolId === 'finalize-workflow-draft') generationStateRef.current.finalized = true;
        return;
      }
      if (toolId !== 'checkpoint-workflow-draft' && toolId !== 'finalize-workflow-draft') return;
      generationStateRef.current.rejected += 1;
      if (generationStateRef.current.rejected >= 3) {
        failGeneration({
          code: 'repair-budget-exhausted',
          message:
            'Workflow generation stopped after three rejected draft repairs. Review the latest issues and retry.',
        });
      }
    };

    return createTools(
      () =>
        generation === generationRef.current &&
        !generationStateRef.current.stopped &&
        !generationStateRef.current.finalized,
      onResult,
    );
  }, [createTools, failGeneration, onGenerationFailure]);

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
      extraInstructions={serializeWorkflowDraftInstructions(authoringState, validationContext)}
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
