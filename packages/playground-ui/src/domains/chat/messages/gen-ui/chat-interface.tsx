import type { DataPart } from '@json-render/react';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { JSON_RENDER_STATE } from '@mastra/json-render/studio';
import { GenUiInterface, SPEC_PART_TYPE } from './gen-ui-interface';
import { useChatMessages, useChatSend } from '@/domains/chat/context/chat-context';

export interface ChatInterfaceProps {
  /** The message the interface belongs to. */
  messageId: string;
  parts: DataPart[];
  /** Whether the chat is replying, anywhere in the thread. */
  chatRunning: boolean;
  /** A reply read back (e.g. in a trace) has no chat to answer. */
  readOnly?: boolean;
}

const hasInterface = (message: MastraDBMessage) =>
  message.content.parts?.some(part => part.type === SPEC_PART_TYPE) ?? false;

/**
 * A reply's interface, answering the chat it sits in. Only the thread's latest interface can answer,
 * because the agent applies the state it receives to that one. It waits while the chat is replying.
 */
export function ChatInterface({ messageId, parts, chatRunning, readOnly = false }: ChatInterfaceProps) {
  const send = useChatSend();
  const messages = useChatMessages();
  const isLatest = messages.findLast(hasInterface)?.id === messageId;

  if (readOnly || !isLatest) return <GenUiInterface parts={parts} />;

  return (
    <GenUiInterface
      parts={parts}
      disabled={chatRunning}
      onSend={(message, state) => void send({ message, requestContext: { [JSON_RENDER_STATE]: state } })}
    />
  );
}
