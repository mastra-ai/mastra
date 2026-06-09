import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { MessageFactory } from '@mastra/react';
import type { MessageRenderers, MessageStatusRenderers, ToolInvocationPart, DynamicToolPart } from '@mastra/react';
import { Badge, Button, Icon, MarkdownRenderer, Notice, cn } from '@mastra/playground-ui';
import {
  AudioLinesIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronUpIcon,
  CopyIcon,
  StopCircleIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { Reasoning } from './reasoning';
import { SignalBadge } from './signal-badge';
import { isSignalData } from './signal-data';
import { SystemReminderBadge } from './system-reminder-badge';
import { TripwireNotice } from './tripwire-notice';
import { DatasetSaveAction } from './dataset-save-action';
import type { MessageMetadata } from './message-metadata';
import { ImageEntry, PdfEntry, TxtEntry } from '../attachments/attachment-preview-dialog';
import { ToolCard } from '../tools/tool-card';
import type { DataMessagePart } from '../tools/tool-card';

export interface MessageRowProps {
  message: MastraDBMessage;
  /** Whether the read-aloud voice is currently speaking this message. */
  isSpeaking?: boolean;
  /** Read the assistant message aloud. Receives the message text. */
  onReadAloud?: (text: string) => void;
  /** Stop the current read-aloud playback. */
  onStopSpeaking?: () => void;
}

type MessagePart = MastraDBMessage['content']['parts'][number];

/**
 * Normalize the stored message role for display. `signal`+`type:'user'` renders
 * as a user message; messages without a displayable role are dropped.
 */
const getMessageDisplayRole = (message: MastraDBMessage): MastraDBMessage['role'] | null => {
  if (message.role === 'assistant' || message.role === 'user' || message.role === 'system') return message.role;
  if (message.role === 'signal' && message.type === 'user') return 'user';
  return null;
};

const toDisplayMessage = (message: MastraDBMessage): MastraDBMessage | null => {
  const displayRole = getMessageDisplayRole(message);
  if (displayRole === null) return null;
  if (displayRole === message.role) return message;
  return { ...message, role: displayRole };
};

const getMessageMetadata = (message: MastraDBMessage): MessageMetadata | undefined => {
  const metadata = message.content.metadata as MessageMetadata | undefined;
  return metadata && typeof metadata === 'object' ? metadata : undefined;
};

/**
 * Collect `data-*` parts from the message so badges (file-tree, sandbox) can read
 * live streaming metadata without reaching into assistant-ui state.
 */
const getDataParts = (message: MastraDBMessage): DataMessagePart[] =>
  message.content.parts
    .filter((part): part is Extract<MessagePart, { type: string }> => typeof part.type === 'string' && part.type.startsWith('data-'))
    .map(part => ({
      type: part.type,
      name: 'name' in part && typeof part.name === 'string' ? part.name : undefined,
      data: 'data' in part ? (part as { data?: unknown }).data : undefined,
    }));

const getTextFromParts = (message: MastraDBMessage): string =>
  message.content.parts
    .filter((part): part is Extract<MessagePart, { type: 'text'; text: string }> => part.type === 'text' && typeof (part as { text?: unknown }).text === 'string')
    .map(part => part.text)
    .join('\n');

/**
 * Whether an assistant message has user-visible prose worth showing the action
 * bar for. Tool calls, reasoning, and completion-check text do not count.
 */
const hasVisibleAssistantText = (message: MastraDBMessage, metadata: MessageMetadata | undefined): boolean =>
  message.content.parts.some(part => {
    if (part.type !== 'text') return false;
    const text = (part as { text?: unknown }).text;
    if (typeof text !== 'string' || text.trim().length === 0) return false;
    if (metadata?.completionResult || metadata?.isTaskCompleteResult) return false;
    return true;
  });

/**
 * Read part-level optimistic `pending` status, stamped onto user text parts.
 */
const isPendingMessage = (message: MastraDBMessage): boolean =>
  message.content.parts.some(part => {
    const metadata = (part as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== 'object' || !('status' in metadata)) return false;
    return (metadata as { status?: unknown }).status === 'pending';
  });

const InMessageAttachment = ({
  type,
  contentType,
  src,
  data,
}: {
  type: 'image' | 'document';
  contentType?: string;
  src?: string;
  data?: string;
}) => (
  <div className="h-full w-full overflow-hidden rounded-lg">
    {type === 'image' ? (
      <ImageEntry src={src ?? ''} />
    ) : type === 'document' && contentType === 'application/pdf' ? (
      <PdfEntry data={data ?? ''} url={src} />
    ) : (
      <TxtEntry data={data ?? ''} />
    )}
  </div>
);

/**
 * Part-level text renderer. Markdown for normal text, plus the legacy
 * error/completion handling previously in `ErrorAwareText` (which read part
 * metadata). User text renders in a bubble, assistant/system as plain prose.
 */
const MessageText = ({ text, metadata }: { text: string; metadata: MessageMetadata | undefined }) => {
  const [collapsedCompletionCheck, setCollapsedCompletionCheck] = useState(false);

  if (metadata?.status === 'tripwire') {
    return <TripwireNotice reason={text} tripwire={metadata.tripwire} />;
  }
  if (metadata?.status === 'warning') {
    return (
      <Notice variant="warning" title="Warning">
        <Notice.Message>{text}</Notice.Message>
      </Notice>
    );
  }
  if (metadata?.status === 'error') {
    return (
      <Notice variant="destructive" title="Error">
        <Notice.Message>{text}</Notice.Message>
      </Notice>
    );
  }

  const taskCompleteResult = metadata?.completionResult;
  if (taskCompleteResult) {
    return (
      <div className="mb-2 space-y-2">
        <button onClick={() => setCollapsedCompletionCheck(s => !s)} className="flex items-center gap-2">
          <Icon>
            <ChevronUpIcon className={cn('transition-all', collapsedCompletionCheck ? 'rotate-90' : 'rotate-180')} />
          </Icon>
          <Badge variant="info" icon={<CheckCircleIcon />}>
            {collapsedCompletionCheck ? 'Show' : 'Hide'} completion check
          </Badge>
        </button>
        {!collapsedCompletionCheck && (
          <Notice variant="info" title={taskCompleteResult?.passed ? 'Complete' : 'Not Complete'}>
            <MarkdownRenderer>{text}</MarkdownRenderer>
          </Notice>
        )}
      </div>
    );
  }

  const trimmedText = text.trim();
  if (trimmedText.startsWith('__ERROR__:')) {
    return (
      <Notice variant="destructive" title="Error">
        <Notice.Message>{trimmedText.substring('__ERROR__:'.length)}</Notice.Message>
      </Notice>
    );
  }
  if (trimmedText.startsWith('Error:')) {
    return (
      <Notice variant="destructive" title="Error">
        <Notice.Message>{trimmedText.substring('Error:'.length).trim()}</Notice.Message>
      </Notice>
    );
  }

  return <MarkdownRenderer>{text}</MarkdownRenderer>;
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="icon-md"
      tooltip="Copy"
      aria-label="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
};

const AssistantActionBar = ({
  text,
  isSpeaking,
  onReadAloud,
  onStopSpeaking,
}: {
  text: string;
  isSpeaking?: boolean;
  onReadAloud?: (text: string) => void;
  onStopSpeaking?: () => void;
}) => (
  <div className="flex gap-1 items-center transition-all relative">
    {(onReadAloud || onStopSpeaking) &&
      (isSpeaking ? (
        <Button size="icon-md" tooltip="Stop" aria-label="Stop" onClick={() => onStopSpeaking?.()}>
          <StopCircleIcon />
        </Button>
      ) : (
        <Button size="icon-md" tooltip="Read aloud" aria-label="Read aloud" onClick={() => onReadAloud?.(text)}>
          <AudioLinesIcon />
        </Button>
      ))}
    <CopyButton text={text} />
  </div>
);

export const MessageRow = ({ message, isSpeaking, onReadAloud, onStopSpeaking }: MessageRowProps) => {
  const dbMessage = toDisplayMessage(message);
  if (dbMessage === null) return null;

  const displayRole = dbMessage.role;
  const metadata = getMessageMetadata(message);
  const dataParts = getDataParts(message);

  const renderToolCard = (
    toolName: string,
    input: unknown,
    output: unknown,
    toolCallId: string,
    state: string | undefined,
  ): ReactNode => (
    <ToolCard
      toolName={toolName}
      input={input}
      output={output}
      toolCallId={toolCallId}
      state={state}
      metadata={metadata}
      dataParts={dataParts}
    />
  );

  const sharedRenderers: MessageRenderers = {
    Reasoning: part => {
      const reasoningText =
        'text' in part && typeof part.text === 'string'
          ? part.text
          : 'reasoning' in part && typeof part.reasoning === 'string'
            ? part.reasoning
            : '';
      return <Reasoning text={reasoningText} />;
    },
    Data: part => (part.type === 'data-signal' && isSignalData(part.data) ? <SignalBadge signal={part.data} /> : null),
    ToolInvocation: (part: ToolInvocationPart) => {
      const inv = part.toolInvocation;
      const input = 'args' in inv ? inv.args : undefined;
      const output = 'result' in inv ? inv.result : undefined;
      return renderToolCard(inv.toolName, input, output, inv.toolCallId, inv.state);
    },
    DynamicTool: (part: DynamicToolPart) => {
      const toolName = part.toolName ?? part.type.replace(/^tool-/, '');
      return renderToolCard(toolName, part.input, part.output, part.toolCallId ?? '', part.state);
    },
  };

  const status: MessageStatusRenderers = {
    Error: ({ text }) => (
      <Notice variant="destructive" title="Error">
        <Notice.Message>{text}</Notice.Message>
      </Notice>
    ),
    Warning: ({ text }) => (
      <Notice variant="warning" title="Warning">
        <Notice.Message>{text}</Notice.Message>
      </Notice>
    ),
    Tripwire: ({ text, tripwire }) => <TripwireNotice reason={text} tripwire={tripwire} />,
  };

  if (displayRole === 'user') {
    const isPending = isPendingMessage(message);
    const userRenderers: MessageRenderers = {
      ...sharedRenderers,
      Text: part => {
        const text = part.text ?? '';
        if (text.trimStart().startsWith('<system-reminder')) {
          return <SystemReminderBadge text={text} />;
        }
        if (text.includes('<attachment name=')) {
          return <InMessageAttachment type="document" contentType="text/plain" data={text} />;
        }
        return <MessageText text={text} metadata={metadata} />;
      },
      File: part => {
        const data = part.data;
        const isUrl = typeof data === 'string' && data.startsWith('https://');
        const isImage = typeof part.mimeType === 'string' && part.mimeType.startsWith('image/');
        if (isImage) {
          return <InMessageAttachment type="image" src={typeof data === 'string' ? data : undefined} />;
        }
        return (
          <InMessageAttachment
            type="document"
            contentType={part.mimeType}
            src={isUrl ? data : undefined}
            data={typeof data === 'string' ? data : undefined}
          />
        );
      },
    };

    return (
      <div
        className="w-full flex items-end pb-4 pt-2 flex-col"
        data-message-id={message.id}
        data-message-pending={isPending ? 'true' : undefined}
      >
        <DatasetSaveAction messageText={getTextFromParts(message)} />
        <div
          className={cn(
            'max-w-[max(366px,70%)] break-words px-4 py-2 text-neutral6 text-ui-lg leading-ui-lg rounded-xl bg-surface3',
            isPending && 'opacity-60 animate-pulse',
          )}
        >
          <MessageFactory message={dbMessage} {...userRenderers} status={status} />
        </div>
      </div>
    );
  }

  const showActionBar = hasVisibleAssistantText(message, metadata);
  const assistantRenderers: MessageRenderers = {
    ...sharedRenderers,
    Text: part => <MessageText text={part.text ?? ''} metadata={metadata} />,
  };

  return (
    <div className="max-w-full" data-message-id={message.id}>
      <div className="text-neutral6 text-ui-lg leading-ui-lg pt-2">
        <MessageFactory message={dbMessage} {...assistantRenderers} status={status} />
      </div>
      {showActionBar && (
        <div className="h-6 pt-4 flex gap-2 items-center">
          <AssistantActionBar
            text={getTextFromParts(message)}
            isSpeaking={isSpeaking}
            onReadAloud={onReadAloud}
            onStopSpeaking={onStopSpeaking}
          />
        </div>
      )}
    </div>
  );
};
