import { Txt } from '@mastra/playground-ui/components/Txt';
import { useChat } from '@mastra/react';
import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  SKILL_BUILDER_INSTRUCTIONS,
  SKILL_BUILDER_TOOL_NAME,
  SKILL_READER_TOOL_NAME,
  useSkillBuilderTools,
} from '../../hooks/use-skill-builder-tool';
import type { SkillBuilderCallbacks, SkillFormState } from '../../hooks/use-skill-builder-tool';
import { ChatComposer } from '@/domains/agent-builder/components/chat-primitives/chat-composer';
import { MessageList } from '@/domains/agent-builder/components/chat-primitives/message-list';

const BUILDER_AGENT_ID = 'builder-agent';

export interface SkillChatComposerProps extends SkillBuilderCallbacks {
  /** Reset key — when this changes the chat resets (e.g. dialog open/close) */
  sessionKey: string;
  /** Whether the form fields have been populated at least once */
  hasFields: boolean;
  /** Callback when the agent populates fields for the first time */
  onFieldsPopulated?: () => void;
  /** Current form state — exposed to the agent via a read tool */
  formState: SkillFormState;
  /** Optional one-shot user message to send as soon as the chat mounts (starter prompt). */
  initialUserMessage?: string;
  /** Notifies parent whenever the agent's run state changes (streaming start/stop). */
  onRunningChange?: (isRunning: boolean) => void;
}

export function SkillChatComposer({
  sessionKey,
  hasFields,
  onFieldsPopulated,
  formState,
  initialUserMessage,
  onRunningChange,
  ...callbacks
}: SkillChatComposerProps) {
  const populatedRef = useRef(false);

  // Keep form state in a ref so the reader tool always gets the latest values
  const formStateRef = useRef(formState);
  formStateRef.current = formState;

  // Wrap callbacks to detect first population
  const wrappedCallbacks = useMemo<SkillBuilderCallbacks>(
    () => ({
      onNameChange: (name: string) => {
        callbacks.onNameChange(name);
        if (!populatedRef.current) {
          populatedRef.current = true;
          onFieldsPopulated?.();
        }
      },
      onDescriptionChange: callbacks.onDescriptionChange,
      onInstructionsChange: callbacks.onInstructionsChange,
    }),
    [callbacks, onFieldsPopulated],
  );

  const { writerTool, readerTool } = useSkillBuilderTools(wrappedCallbacks, formStateRef);
  const clientTools = useMemo(
    () => ({
      [SKILL_BUILDER_TOOL_NAME]: writerTool,
      [SKILL_READER_TOOL_NAME]: readerTool,
    }),
    [writerTool, readerTool],
  );
  const threadId = useMemo(() => `skill-builder-${sessionKey}`, [sessionKey]);

  const { messages, sendMessage, isRunning, setMessages } = useChat({ agentId: BUILDER_AGENT_ID });

  // Bubble run state up so parents can gate UI (e.g. revealing the form only
  // after the agent's first turn completes with a title set).
  useEffect(() => {
    onRunningChange?.(isRunning);
  }, [isRunning, onRunningChange]);

  // Reset messages when session changes (dialog open/close)
  const prevSessionRef = useRef(sessionKey);
  useEffect(() => {
    if (prevSessionRef.current !== sessionKey) {
      prevSessionRef.current = sessionKey;
      populatedRef.current = false;
      setMessages([]);
    }
  }, [sessionKey, setMessages]);

  // Draft state for the input
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim();

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!trimmed || isRunning) return;
      void sendMessage({
        message: trimmed,
        threadId,
        clientTools,
        modelSettings: { instructions: SKILL_BUILDER_INSTRUCTIONS },
      });
      setDraft('');
    },
    [trimmed, isRunning, sendMessage, threadId, clientTools],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }, []);

  // Auto-send the starter prompt once on mount when provided.
  const sentStarterRef = useRef(false);
  useEffect(() => {
    if (sentStarterRef.current) return;
    const starter = initialUserMessage?.trim();
    if (!starter) return;
    sentStarterRef.current = true;
    void sendMessage({
      message: starter,
      threadId,
      clientTools,
      modelSettings: { instructions: SKILL_BUILDER_INSTRUCTIONS },
    });
  }, [initialUserMessage, sendMessage, threadId, clientTools]);

  const emptyState = (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6 py-8">
      <div className="rounded-full bg-accent5/10 p-3">
        <Sparkles className="h-6 w-6 text-accent5" />
      </div>
      <div className="flex flex-col gap-1">
        <Txt variant="ui-md" className="text-neutral5 font-medium" as="p">
          {hasFields ? 'Refine your skill' : 'Describe your skill'}
        </Txt>
        <Txt variant="ui-sm" className="text-neutral3" as="p">
          {hasFields
            ? 'Ask the agent to adjust the name, description, or instructions.'
            : 'Tell the agent what this skill should do and it will fill in the details for you.'}
        </Txt>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageList
        messages={messages}
        isRunning={isRunning}
        emptyState={emptyState}
        skeletonTestId="skill-builder-conversation-messages-skeleton"
      />
      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        disabled={isRunning}
        canSubmit={!!trimmed && !isRunning}
        isRunning={isRunning}
        placeholder={hasFields ? 'Ask the agent to refine…' : 'Describe your skill…'}
        inputTestId="skill-builder-conversation-input"
        submitTestId="skill-builder-conversation-submit"
        containerTestId="skill-builder-conversation-composer"
      />
    </div>
  );
}
