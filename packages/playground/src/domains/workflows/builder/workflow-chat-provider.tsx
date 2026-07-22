import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { ClientToolsInput } from '@mastra/react';
import { useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

import { serializeWorkflowDraftInstructions } from './workflow-conversation';
import type { WorkflowDraftAuthoringState, WorkflowDraftValidationContext } from './workflow-draft';
import { StreamChatProvider } from '@/domains/agent-builder/contexts/stream-chat-provider';

export interface WorkflowChatProviderProps {
  threadId: string;
  authoringState: WorkflowDraftAuthoringState;
  validationContext?: WorkflowDraftValidationContext;
  initialMessages: MastraDBMessage[];
  initialUserMessage?: string;
  createTools: (isCurrentGeneration: () => boolean) => ClientToolsInput;
  debounceTime?: number;
  children: ReactNode;
}

export function WorkflowChatProvider({
  threadId,
  authoringState,
  validationContext,
  initialMessages,
  initialUserMessage,
  createTools,
  debounceTime = 300,
  children,
}: WorkflowChatProviderProps) {
  const generationRef = useRef(0);
  const createClientTools = useCallback(() => {
    const generation = ++generationRef.current;
    return createTools(() => generation === generationRef.current);
  }, [createTools]);

  return (
    <StreamChatProvider
      agentId="workflow-builder"
      streamPath="/editor/workflow-builder/stream"
      threadId={threadId}
      initialMessages={initialMessages}
      initialUserMessage={initialUserMessage}
      createClientTools={createClientTools}
      extraInstructions={serializeWorkflowDraftInstructions(authoringState, validationContext)}
      enableThreadSignals={false}
      debounceTime={debounceTime}
    >
      {children}
    </StreamChatProvider>
  );
}
