import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { Button } from '@mastra/playground-ui/components/Button';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MessageFactory } from '@mastra/react';
import type { MessageRenderers } from '@mastra/react';
import { AudioLinesIcon, CheckIcon, CopyIcon, StopCircleIcon } from 'lucide-react';
import { forwardRef, useMemo } from 'react';

import type { DataMessagePart } from '../tools/tool-card';
import { DatasetSaveAction } from './dataset-save-action';
import { AssistantTextPartRenderer } from './renderers/assistant-text-part-renderer';
import { DataPartRenderer } from './renderers/data-part-renderer';
import { DynamicToolPartRenderer } from './renderers/dynamic-tool-part-renderer';
import { ReasoningPartRenderer } from './renderers/reasoning-part-renderer';
import { messageStatusRenderers } from './renderers/status-renderers';
import { ToolInvocationPartRenderer } from './renderers/tool-invocation-part-renderer';
import { UserFilePartRenderer } from './renderers/user-file-part-renderer';
import { UserTextPartRenderer } from './renderers/user-text-part-renderer';
import { getSignalType, isSignalData, isUserSignalType, toReactiveSignalData } from './signal-data';
import { ProviderLogo } from '@/domains/llm/components/provider-logo';

export interface MessageRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  message: MastraDBMessage;
  hasModelList?: boolean;
  /** Whether the read-aloud voice is currently speaking this message. */
  isSpeaking?: boolean;
  /** Read the assistant message aloud. Receives the message text. */
  onReadAloud?: (text: string) => void;
  /** Stop the current read-aloud playback. */
  onStopSpeaking?: () => void;
}

type MessagePart = MastraDBMessage['content']['parts'][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Read an optional field off a loosely-typed message part or nested value. */
const readField = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

/**
 * Normalize the stored message role for display. A `signal`+`type:'user'` row
 * renders as a user message; a non-user (reactive) `signal` row is folded onto
 * an assistant message as a `data-signal` badge (see `toReactiveSignalMessage`);
 * messages without a displayable role are dropped.
 */
const getMessageDisplayRole = (message: MastraDBMessage): MastraDBMessage['role'] | null => {
  if (message.role === 'assistant' || message.role === 'user' || message.role === 'system') return message.role;
  if (message.role === 'signal') return isUserSignalType(getSignalType(message)) ? 'user' : 'assistant';
  return null;
};

/**
 * Convert a persisted reactive (non-user) `signal` row into an assistant message
 * carrying a single `data-signal` part, so the existing `SignalBadge` renderer
 * shows it on read-back. Restores 1.41.0 behavior lost in the chat renderer
 * rewrite (PR #17774). Returns `null` when the signal payload is not a shape the
 * `SignalBadge` can render, so the row is dropped instead of leaving an empty
 * assistant bubble.
 */
const toReactiveSignalMessage = (message: MastraDBMessage): MastraDBMessage | null => {
  const data = toReactiveSignalData(message);
  if (!isSignalData(data)) return null;
  const parts: MastraDBMessage['content']['parts'] = [{ type: 'data-signal', data }];
  return {
    ...message,
    role: 'assistant',
    content: { ...message.content, parts },
  };
};

const toDisplayMessage = (message: MastraDBMessage): MastraDBMessage | null => {
  const displayRole = getMessageDisplayRole(message);
  if (displayRole === null) return null;
  if (message.role === 'signal' && displayRole === 'assistant') return toReactiveSignalMessage(message);
  if (displayRole === message.role) return message;
  return { ...message, role: displayRole };
};

const getMessageMetadata = (message: MastraDBMessage): Record<string, unknown> | undefined =>
  isRecord(message.content.metadata) ? message.content.metadata : undefined;

/**
 * Collect `data-*` parts from the message so badges (file-tree, sandbox) can read
 * live streaming metadata without reaching into assistant-ui state.
 */
const getDataParts = (message: MastraDBMessage): DataMessagePart[] =>
  message.content.parts
    .filter(
      (part): part is Extract<MessagePart, { type: string }> =>
        typeof part.type === 'string' && part.type.startsWith('data-'),
    )
    .map(part => ({
      type: part.type,
      name: 'name' in part && typeof part.name === 'string' ? part.name : undefined,
      data: readField(part, 'data'),
    }));

const getTextFromParts = (message: MastraDBMessage): string =>
  message.content.parts
    .filter(
      (part): part is Extract<MessagePart, { type: 'text'; text: string }> =>
        part.type === 'text' && typeof readField(part, 'text') === 'string',
    )
    .map(part => part.text)
    .join('\n');

/**
 * Whether an assistant message has user-visible prose worth showing the action
 * bar for. Tool calls, reasoning, and completion-check text do not count.
 */
const hasVisibleAssistantText = (message: MastraDBMessage, metadata: Record<string, unknown> | undefined): boolean =>
  message.content.parts.some(part => {
    if (part.type !== 'text') return false;
    const text = readField(part, 'text');
    if (typeof text !== 'string' || text.trim().length === 0) return false;
    if (readField(metadata, 'completionResult') || readField(metadata, 'isTaskCompleteResult')) return false;
    return true;
  });

const getModelMetadata = (metadata: Record<string, unknown> | undefined) => {
  const custom = readField(metadata, 'custom');
  const modelMetadata = readField(custom, 'modelMetadata');
  const modelId = readField(modelMetadata, 'modelId');
  const modelProvider = readField(modelMetadata, 'modelProvider');
  if (typeof modelId !== 'string' || typeof modelProvider !== 'string') return undefined;
  return { modelId, modelProvider };
};

/**
 * Read part-level optimistic `pending` status, stamped onto user text parts.
 */
const isPendingMessage = (message: MastraDBMessage): boolean => {
  if (message.content.metadata?.status === 'pending') return true;
  return message.content.parts.some(part => readField(readField(part, 'metadata'), 'status') === 'pending');
};

const CopyButton = ({ text }: { text: string }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 1500, showToast: false });

  return (
    <Button variant="ghost" size="icon-xs" tooltip="Copy" aria-label="Copy" onClick={() => copyToClipboard(text)}>
      {isCopied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
};

const AssistantActionBar = ({
  text,
  modelMetadata,
  isSpeaking,
  onReadAloud,
  onStopSpeaking,
}: {
  text: string;
  modelMetadata?: { modelId: string; modelProvider: string };
  isSpeaking?: boolean;
  onReadAloud?: (text: string) => void;
  onStopSpeaking?: () => void;
}) => (
  <div className="flex gap-1 items-center transition-all relative">
    {modelMetadata && (
      <div className="flex items-center gap-1 pr-2 text-icon5 text-ui-xs leading-ui-xs">
        <ProviderLogo providerId={modelMetadata.modelProvider} size={14} />
        <span>
          {modelMetadata.modelProvider}/{modelMetadata.modelId}
        </span>
      </div>
    )}
    {(onReadAloud || onStopSpeaking) &&
      (isSpeaking ? (
        <Button variant="ghost" size="icon-xs" tooltip="Stop" aria-label="Stop" onClick={() => onStopSpeaking?.()}>
          <StopCircleIcon />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-xs"
          tooltip="Read aloud"
          aria-label="Read aloud"
          onClick={() => onReadAloud?.(text)}
        >
          <AudioLinesIcon />
        </Button>
      ))}
    <CopyButton text={text} />
  </div>
);

export const MessageRow = forwardRef<HTMLDivElement, MessageRowProps>(
  ({ message, hasModelList, isSpeaking, onReadAloud, onStopSpeaking, className, ...rootProps }, ref) => {
    const dbMessage = toDisplayMessage(message);
    const metadata = getMessageMetadata(message);
    const modelMetadata = hasModelList ? getModelMetadata(metadata) : undefined;
    const dataParts = useMemo(() => getDataParts(message), [message]);

    const sharedRenderers = useMemo<MessageRenderers>(
      () => ({
        Reasoning: part => <ReasoningPartRenderer part={part} />,
        Data: part => <DataPartRenderer part={part} />,
        ToolInvocation: part => <ToolInvocationPartRenderer part={part} metadata={metadata} dataParts={dataParts} />,
        DynamicTool: part => <DynamicToolPartRenderer part={part} metadata={metadata} dataParts={dataParts} />,
      }),
      [metadata, dataParts],
    );

    const userRenderers = useMemo<MessageRenderers>(
      () => ({
        ...sharedRenderers,
        Text: part => <UserTextPartRenderer part={part} metadata={metadata} />,
        File: part => <UserFilePartRenderer part={part} />,
      }),
      [sharedRenderers, metadata],
    );

    const assistantRenderers = useMemo<MessageRenderers>(
      () => ({
        ...sharedRenderers,
        Text: part => <AssistantTextPartRenderer part={part} metadata={metadata} />,
      }),
      [sharedRenderers, metadata],
    );

    if (dbMessage === null) return null;

    const displayRole = dbMessage.role;

    if (displayRole === 'user') {
      const isPending = isPendingMessage(message);

      return (
        <div
          ref={ref}
          className={cn('w-full flex items-end pb-4 pt-2 flex-col', className)}
          {...rootProps}
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
            <MessageFactory message={dbMessage} {...userRenderers} status={messageStatusRenderers} />
          </div>
        </div>
      );
    }

    const showActionBar = hasVisibleAssistantText(message, metadata);

    return (
      <div ref={ref} className={cn('max-w-full', className)} {...rootProps} data-message-id={message.id}>
        <div className="text-neutral6 text-ui-lg leading-ui-lg pt-2">
          <MessageFactory message={dbMessage} {...assistantRenderers} status={messageStatusRenderers} />
        </div>
        {showActionBar && (
          <div className="h-6 pt-4 flex gap-2 items-center">
            <AssistantActionBar
              text={getTextFromParts(message)}
              modelMetadata={modelMetadata}
              isSpeaking={isSpeaking}
              onReadAloud={onReadAloud}
              onStopSpeaking={onStopSpeaking}
            />
          </div>
        )}
      </div>
    );
  },
);
MessageRow.displayName = 'MessageRow';
