import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { SpanInputMessage } from '@mastra/core/observability';
import type { ReactNode } from 'react';
import { parseAvailableSkills } from './available-skills';
import type { AvailableSkill } from './available-skills';
import { SpanPayloadAttachment } from './span-payload-attachment';
import { SpanPayloadJson } from './span-payload-json';
import {
  SpanPayloadField,
  SpanPayloadLabel,
  SpanPayloadList,
  SpanPayloadListName,
  SpanPayloadMarkdown,
} from './span-payload-primitives';
import { SpanPayloadTool } from './span-payload-tool';
import { SignalDetails } from './span-signal-details';
import { SignalBadge } from '@/domains/chat/messages/signal-badge';
import { isUserSignalType, toReactiveSignalData } from '@/domains/chat/messages/signal-data';
import type { SignalData } from '@/domains/chat/messages/signal-data';
import { parseSkillMarkup } from '@/domains/chat/messages/skill-activation';
import { SkillMessage } from '@/domains/chat/messages/skill-message';
import { ReasoningActivity } from '@/ds/components/ai/activity';
import { Message } from '@/ds/components/Message';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Strips the indentation shared by every line so indented prompts are not rendered as code blocks. */
function dedent(text: string): string {
  const lines = text.split('\n');
  const indent = Math.min(...lines.filter(line => line.trim()).map(line => line.length - line.trimStart().length));
  return (Number.isFinite(indent) ? lines.map(line => line.slice(indent)).join('\n') : text).trim();
}

function SkillList({ skills }: { skills: AvailableSkill[] }) {
  return (
    <SpanPayloadList
      slot="span-skills"
      items={skills.map(skill => ({
        key: skill.name,
        description: skill.description,
        name: <SpanPayloadListName>{skill.name}</SpanPayloadListName>,
      }))}
    />
  );
}

/** The skills catalog when it is all a message says, so the message label can name it. */
function catalogOnly(parts: unknown[]): AvailableSkill[] | undefined {
  if (parts.length !== 1) return undefined;
  const [part] = parts;
  const text = typeof part === 'string' ? part : isRecord(part) && part.type === 'text' ? part.text : undefined;
  const catalog = typeof text === 'string' ? parseAvailableSkills(text) : undefined;
  return catalog && !catalog.before.trim() && !catalog.after.trim() ? catalog.skills : undefined;
}

function MessageText({ text }: { text: string }) {
  const catalog = parseAvailableSkills(text);
  if (!catalog) return <SpanPayloadMarkdown>{dedent(text)}</SpanPayloadMarkdown>;

  const before = dedent(catalog.before);
  const after = dedent(catalog.after);
  return (
    <div className="flex flex-col gap-3">
      {before && <SpanPayloadMarkdown>{before}</SpanPayloadMarkdown>}
      <SpanPayloadField label={`Skills (${catalog.skills.length})`}>
        <SkillList skills={catalog.skills} />
      </SpanPayloadField>
      {after && <SpanPayloadMarkdown>{after}</SpanPayloadMarkdown>}
    </div>
  );
}

/**
 * Reasoning as the model sends it (`text`) or as memory stores it (`reasoning`, with `details`
 * that can be redacted by the provider). An empty one (e.g. only encrypted content) shows nothing.
 */
function MessageReasoning({ part }: { part: Record<string, unknown> }) {
  const details = Array.isArray(part.details) ? part.details.filter(isRecord) : [];
  const text =
    typeof part.text === 'string'
      ? part.text
      : typeof part.reasoning === 'string' && part.reasoning
        ? part.reasoning
        : details
            .map(detail => (detail.type === 'text' && typeof detail.text === 'string' ? detail.text : ''))
            .join('');
  const redacted = !text.trim() && details.some(detail => detail.type === 'redacted');
  return <ReasoningActivity text={text} redacted={redacted} />;
}

function MessagePart({ part }: { part: unknown }) {
  if (typeof part === 'string') return <MessageText text={part} />;
  if (!isRecord(part)) return <SpanPayloadJson value={part} />;

  switch (part.type) {
    case 'text':
      return typeof part.text === 'string' ? <MessageText text={part.text} /> : <SpanPayloadJson value={part} />;
    case 'reasoning':
      return <MessageReasoning part={part} />;
    // Marks where a new model step starts in a stored message; it carries nothing to read.
    case 'step-start':
      return null;
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

function MessageBody({ parts }: { parts: unknown[] }) {
  return (
    <div className="flex flex-col gap-3">
      {parts.map((part, index) => (
        <MessagePart key={index} part={part} />
      ))}
    </div>
  );
}

function skillOf(parts: unknown[]) {
  if (parts.length !== 1) return undefined;
  const [part] = parts;
  const text = typeof part === 'string' ? part : isRecord(part) && part.type === 'text' ? part.text : undefined;
  return typeof text === 'string' ? parseSkillMarkup(text) : undefined;
}

/** A `role: 'signal'` message as memory stores it, which processor and memory spans record as is. */
function isSignalMessage(message: Record<string, unknown>): message is Record<string, unknown> & MastraDBMessage {
  return message.role === 'signal' && isRecord(message.content) && Array.isArray(message.content.parts);
}

/**
 * A signal, drawn the same wherever a span recorded it: a user signal reads as the user message
 * it is, any other signal (a skill, a system reminder, a notification…) as the signal row the
 * chat draws for it. Its metadata follows.
 */
export function SpanSignal({ signal }: { signal: SignalData }) {
  const isUser = isUserSignalType(signal.type);
  const details = <SignalDetails signal={signal} isUser={isUser} />;
  return (
    <div data-slot="span-signal" data-signal-type={signal.type} className="flex min-w-0 flex-col gap-1">
      {isUser ? (
        <SpanMessage message={{ role: 'user', content: signal.contents }} footer={details} />
      ) : (
        <>
          <SignalBadge signal={signal} defaultOpen />
          {details}
        </>
      )}
    </div>
  );
}

// `unknown` on purpose: SpanInputMessage is a wide union of SDK message shapes, and the
// renderer only needs `isRecord` narrowing to read `role` / `content` / `parts` defensively.
/** One message of a span; `footer` sits right under it (e.g. the metadata of the signal it came from). */
function SpanMessage({ message, footer }: { message: unknown; footer?: ReactNode }) {
  if (typeof message === 'string') {
    return (
      <Message from="user" data-role="user" footer={footer}>
        <div className="flex flex-col gap-2">
          <SpanPayloadLabel>user</SpanPayloadLabel>
          <MessageText text={message} />
        </div>
      </Message>
    );
  }
  if (!isRecord(message)) return <SpanPayloadJson value={message} />;
  if (isSignalMessage(message)) return <SpanSignal signal={toReactiveSignalData(message)} />;

  const role = typeof message.role === 'string' ? message.role : 'unknown';
  const parts = messageParts(message);
  const body = parts.length > 0 ? <MessageBody parts={parts} /> : <SpanPayloadJson value={message} />;

  // A skill reaches the model as `<skill name="…">` markup in a user message: show it as the skill.
  const skill = role === 'user' ? skillOf(parts) : undefined;
  if (skill) {
    return (
      <div data-role="skill" className="flex flex-col gap-1">
        <SkillMessage activation={skill} defaultOpen />
        {footer}
      </div>
    );
  }

  if (role === 'user' || role === 'assistant') {
    return (
      <Message from={role} data-role={role} footer={footer}>
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
  const skills = catalogOnly(parts);

  return (
    <div data-role={role} className="flex min-w-0 flex-col gap-2">
      <SpanPayloadLabel>
        {hasToolResultLabels ? 'Tool result' : skills ? `${role} · Skills (${skills.length})` : role}
      </SpanPayloadLabel>
      {skills ? <SkillList skills={skills} /> : body}
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
