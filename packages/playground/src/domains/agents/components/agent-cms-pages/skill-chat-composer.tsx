import { Txt } from '@mastra/playground-ui';
import type { MastraUIMessage } from '@mastra/react';
import { useChat } from '@mastra/react';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';

import {
  SKILL_BUILDER_INSTRUCTIONS,
  SKILL_BUILDER_TOOL_NAME,
  useSkillBuilderTool,
} from '../../hooks/use-skill-builder-tool';
import type { SkillBuilderCallbacks } from '../../hooks/use-skill-builder-tool';
import { ChatComposer } from '@/domains/agent-builder/components/chat-primitives/chat-composer';

const BUILDER_AGENT_ID = 'builder-agent';

interface SkillChatComposerProps extends SkillBuilderCallbacks {
  /** Reset key — when this changes the chat resets (e.g. dialog open/close) */
  sessionKey: string;
}

export function SkillChatComposer({ sessionKey, ...callbacks }: SkillChatComposerProps) {
  const skillBuilderTool = useSkillBuilderTool(callbacks);

  const clientTools = useMemo(() => ({ [SKILL_BUILDER_TOOL_NAME]: skillBuilderTool }), [skillBuilderTool]);

  const threadId = useMemo(() => `skill-builder-${sessionKey}`, [sessionKey]);

  const { messages, sendMessage, isRunning, setMessages } = useChat({ agentId: BUILDER_AGENT_ID });

  // Reset messages when session changes (dialog open/close)
  const prevSessionRef = useRef(sessionKey);
  useEffect(() => {
    if (prevSessionRef.current !== sessionKey) {
      prevSessionRef.current = sessionKey;
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

  return (
    <div className="flex flex-col gap-3">
      {/* Minimal message display */}
      {messages.length > 0 && <SkillMessages messages={messages} isRunning={isRunning} />}

      {/* Composer */}
      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        disabled={isRunning}
        canSubmit={!!trimmed && !isRunning}
        isRunning={isRunning}
        placeholder="Describe your skill…"
        tone="info"
      />
    </div>
  );
}

/** Compact message list — shows only user prompts + assistant text responses */
function SkillMessages({ messages, isRunning }: { messages: MastraUIMessage[]; isRunning: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const lastMessage = messages[messages.length - 1];
  const isStreaming =
    lastMessage?.role === 'assistant' &&
    lastMessage.parts.some(p => (p.type === 'text' || p.type === 'reasoning') && (p as any).state === 'streaming');
  const showPending = isRunning && !isStreaming && lastMessage?.role !== 'assistant';

  return (
    <div ref={scrollRef} className="max-h-[200px] overflow-y-auto flex flex-col gap-3">
      {messages.map(msg => (
        <SkillMessageRow key={msg.id} message={msg} />
      ))}
      {showPending && (
        <Txt variant="ui-sm" className="text-neutral3 flex items-center gap-1.5" as="div">
          <Loader2 className="animate-spin size-3" />
          Thinking…
        </Txt>
      )}
    </div>
  );
}

function SkillMessageRow({ message }: { message: MastraUIMessage }) {
  return (
    <>
      {message.parts.map((part, i) => {
        const key = `${message.id}-${i}`;
        if (part.type === 'text' && part.text) {
          if (message.role === 'user') {
            return (
              <div key={key} className="flex justify-end">
                <Txt
                  variant="ui-sm"
                  className="whitespace-pre-wrap bg-white text-black rounded-xl px-3 py-1.5 max-w-[85%]"
                  as="div"
                >
                  {part.text}
                </Txt>
              </div>
            );
          }
          return (
            <Txt key={key} variant="ui-sm" className="whitespace-pre-wrap text-neutral4 max-w-[85%]" as="div">
              <Markdown>{part.text}</Markdown>
            </Txt>
          );
        }
        // Hide tool call/result parts — they're just the form updates
        return null;
      })}
    </>
  );
}
