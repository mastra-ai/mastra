import { Txt } from '@mastra/playground-ui';
import type { MastraUIMessage } from '@mastra/react';
import { useChat } from '@mastra/react';
import { Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';

import {
  SKILL_BUILDER_INSTRUCTIONS,
  SKILL_BUILDER_TOOL_NAME,
  SKILL_READER_TOOL_NAME,
  useSkillBuilderTools,
} from '../../hooks/use-skill-builder-tool';
import type { SkillBuilderCallbacks, SkillFormState } from '../../hooks/use-skill-builder-tool';
import { ChatComposer } from '@/domains/agent-builder/components/chat-primitives/chat-composer';

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
}

export function SkillChatComposer({
  sessionKey,
  hasFields,
  onFieldsPopulated,
  formState,
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

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Empty state — only when no messages yet */}
      {!hasMessages && (
        <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-8">
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
      )}

      {/* Messages */}
      {hasMessages && <SkillMessages messages={messages} isRunning={isRunning} />}

      {/* Composer */}
      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        disabled={isRunning}
        canSubmit={!!trimmed && !isRunning}
        isRunning={isRunning}
        placeholder={hasFields ? 'Ask the agent to refine…' : 'Describe your skill…'}
        tone="info"
      />
    </div>
  );
}

/** Compact message list — renders inline, no flex-1 stretching */
function SkillMessages({ messages, isRunning }: { messages: MastraUIMessage[]; isRunning: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isRunning]);

  // Check if the assistant has any visible text content yet
  const lastMessage = messages[messages.length - 1];
  const hasAssistantText =
    lastMessage?.role === 'assistant' && lastMessage.parts.some(p => p.type === 'text' && p.text?.trim());

  return (
    <div className="flex flex-col gap-3">
      {messages.map(msg => (
        <SkillMessageRow key={msg.id} message={msg} />
      ))}
      {isRunning && !hasAssistantText && <ThinkingIndicator />}
      <div ref={endRef} />
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-neutral3 px-1">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <Txt variant="ui-sm" className="text-neutral3">
        Building your skill…
      </Txt>
    </div>
  );
}

function SkillMessageRow({ message }: { message: MastraUIMessage }) {
  const textParts = message.parts.filter(p => p.type === 'text' && p.text?.trim());

  if (textParts.length === 0) return null;

  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser ? 'bg-accent5/15 text-neutral5' : 'bg-surface3 text-neutral4'
        }`}
      >
        {textParts.map((part, i) => {
          const text = 'text' in part ? (part.text as string) : '';
          return isUser ? (
            <span key={i}>{text}</span>
          ) : (
            <Markdown key={i} components={{ p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p> }}>
              {text}
            </Markdown>
          );
        })}
      </div>
    </div>
  );
}
