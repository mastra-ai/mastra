import type { SpanInputMessage } from '@mastra/core/observability';
import { SpanPayloadAttachment } from './span-payload-attachment';
import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadMarkdown, SpanPayloadLabel } from './span-payload-primitives';
import { SpanPayloadTool } from './span-payload-tool';
import { Reasoning } from '@/domains/chat/messages/reasoning';
import { Message } from '@/ds/components/Message';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function MessageText({ text, plain }: { text: string; plain: boolean }) {
  return plain ? (
    <p className="text-ui-sm break-words whitespace-pre-wrap">{text.trim()}</p>
  ) : (
    <SpanPayloadMarkdown>{text}</SpanPayloadMarkdown>
  );
}

function MessagePart({ part, plain = false }: { part: unknown; plain?: boolean }) {
  if (typeof part === 'string') return <MessageText text={part} plain={plain} />;
  if (!isRecord(part)) return <SpanPayloadJson value={part} />;

  switch (part.type) {
    case 'text':
      return typeof part.text === 'string' ? (
        <MessageText text={part.text} plain={plain} />
      ) : (
        <SpanPayloadJson value={part} />
      );
    case 'reasoning':
      return typeof part.text === 'string' ? <Reasoning text={part.text} /> : <SpanPayloadJson value={part} />;
    case 'tool-call':
    case 'tool-invocation':
    case 'dynamic-tool':
    case 'tool-result':
      return <SpanPayloadTool value={part} />;
    case 'file':
    case 'image':
      return <SpanPayloadAttachment value={part} />;
    default:
      return <SpanPayloadJson value={part} />;
  }
}

function messageParts(message: Record<string, unknown>): unknown[] {
  if (Array.isArray(message.parts)) return message.parts;
  if (Array.isArray(message.content)) return message.content;
  if (typeof message.content === 'string') return [message.content];
  if (isRecord(message.content)) {
    // MastraDBMessage: content is { format, parts, content? }
    if (Array.isArray(message.content.parts)) return message.content.parts;
    if (typeof message.content.content === 'string') return [message.content.content];
  }
  return [];
}

function MessageBody({ parts, plain }: { parts: unknown[]; plain: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {parts.map((part, index) => (
        <MessagePart key={index} part={part} plain={plain} />
      ))}
    </div>
  );
}

// `unknown` on purpose: SpanInputMessage is a wide union of SDK message shapes, and the
// renderer only needs `isRecord` narrowing to read `role` / `content` / `parts` defensively.
function SpanMessage({ message }: { message: unknown }) {
  if (typeof message === 'string') {
    return (
      <Message from="user" data-role="user">
        <div className="flex flex-col gap-2">
          <SpanPayloadLabel>user</SpanPayloadLabel>
          <SpanPayloadMarkdown>{message}</SpanPayloadMarkdown>
        </div>
      </Message>
    );
  }
  if (!isRecord(message)) return <SpanPayloadJson value={message} />;

  const role = typeof message.role === 'string' ? message.role : 'unknown';
  const parts = messageParts(message);
  const body =
    parts.length > 0 ? <MessageBody parts={parts} plain={role === 'system'} /> : <SpanPayloadJson value={message} />;

  if (role === 'user' || role === 'assistant') {
    return (
      <Message from={role} data-role={role}>
        <div className="flex flex-col gap-2">
          <SpanPayloadLabel>{role}</SpanPayloadLabel>
          {body}
        </div>
      </Message>
    );
  }
  const hasToolResultLabels =
    role === 'tool' &&
    parts.length > 0 &&
    parts.every(
      part => isRecord(part) && part.type === 'tool-result' && typeof part.toolName === 'string' && part.toolName,
    );

  return (
    <div data-role={role} className="flex min-w-0 flex-col gap-2">
      {!hasToolResultLabels && <SpanPayloadLabel>{role}</SpanPayloadLabel>}
      {body}
    </div>
  );
}

export interface SpanPayloadMessagesProps {
  value: SpanInputMessage[];
}

/** Renders a span's message list; rich (parts/content arrays) and shallow (`{ role, content: string }`) alike. */
export function SpanPayloadMessages({ value }: SpanPayloadMessagesProps) {
  return (
    <div data-slot="span-payload-messages" className="flex flex-col gap-3">
      {value.map((message, index) => (
        <SpanMessage key={index} message={message} />
      ))}
    </div>
  );
}
