import type { DataPart } from '@json-render/react';
import { JSON_RENDER_STATE } from '@mastra/json-render/studio';
import { GenUiInterface } from './gen-ui-interface';
import { useChatRunning, useChatSend } from '@/domains/chat/context/chat-context';

export interface ChatInterfaceProps {
  parts: DataPart[];
  /** A reply read back (e.g. in a trace) has no chat to answer. */
  readOnly?: boolean;
}

/** A reply's interface, answering the chat it sits in. It waits while the chat is replying. */
export function ChatInterface({ parts, readOnly = false }: ChatInterfaceProps) {
  const send = useChatSend();
  const { isRunning } = useChatRunning();

  if (readOnly) return <GenUiInterface parts={parts} />;

  return (
    <GenUiInterface
      parts={parts}
      disabled={isRunning}
      onSend={(message, state) => void send({ message, requestContext: { [JSON_RENDER_STATE]: state } })}
    />
  );
}
