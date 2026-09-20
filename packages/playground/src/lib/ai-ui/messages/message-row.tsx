import type { MastraDBMessage, MastraErrorPart } from '@mastra/core/agent/message-list';
import { useRevealedParts } from '@mastra/playground-ui/components/ai/message-reveal';
import { ToolCallGroup } from '@mastra/playground-ui/components/ai/tool-call';
import { Arriving } from '@mastra/playground-ui/components/Arrival';
import { Message, MessageActions, MessageCopyButton } from '@mastra/playground-ui/components/Message';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChatRunningContext, useChatRunning } from '@mastra/playground-ui/domains/chat/context/chat-context';
import { AssistantTextPartRenderer } from '@mastra/playground-ui/domains/chat/messages/renderers/assistant-text-part-renderer';
import { DataPartRenderer } from '@mastra/playground-ui/domains/chat/messages/renderers/data-part-renderer';
import { messageTextKind } from '@mastra/playground-ui/domains/chat/messages/renderers/message-text-kind';
import { ReasoningPartRenderer } from '@mastra/playground-ui/domains/chat/messages/renderers/reasoning-part-renderer';
import { messageStatusRenderers } from '@mastra/playground-ui/domains/chat/messages/renderers/status-renderers';
import { readToolPart } from '@mastra/playground-ui/domains/chat/messages/renderers/tool-part';
import type { ToolPart } from '@mastra/playground-ui/domains/chat/messages/renderers/tool-part';
import { UserFilePartRenderer } from '@mastra/playground-ui/domains/chat/messages/renderers/user-file-part-renderer';
import { UserTextPartRenderer } from '@mastra/playground-ui/domains/chat/messages/renderers/user-text-part-renderer';
import {
  getSignalType,
  isRecord,
  isSignalData,
  isUserSignalType,
  toReactiveSignalData,
} from '@mastra/playground-ui/domains/chat/messages/signal-data';
import { badgeStatus, isSettledState } from '@mastra/playground-ui/domains/chat/tools/tool-card-kind';
import type { ToolCardContext } from '@mastra/playground-ui/domains/chat/tools/tool-card-kind';
import { collectToolGroups } from '@mastra/playground-ui/domains/chat/tools/tool-groups';
import { MessageFactory } from '@mastra/react/ui';
import type { MessageRenderers } from '@mastra/react/ui';
import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ToolCallEffects } from '../tools/tool-call-effects';
import { ToolCard } from '../tools/tool-card';
import type { DataMessagePart } from '../tools/tool-card';
import { AssistantMessageActions } from './assistant-message-actions';
import { DatasetSaveAction } from './dataset-save-action';
import { useMcpAppTools } from '@/domains/mcps/hooks';

export interface MessageRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  message: MastraDBMessage;
  hasModelList?: boolean;
  isSpeaking?: boolean;
  onReadAloud?: (text: string) => void;
  onStopSpeaking?: () => void;
  readOnly?: boolean;
  footer?: ReactNode;
}

type MessagePart = MastraDBMessage['content']['parts'][number];

const readField = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

const getMessageDisplayRole = (message: MastraDBMessage): MastraDBMessage['role'] | null => {
  if (message.role === 'assistant' || message.role === 'user' || message.role === 'system') return message.role;
  if (message.role === 'signal') return isUserSignalType(getSignalType(message)) ? 'user' : 'assistant';
  return null;
};

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

const NO_PARTS: MessagePart[] = [];

const isStreaming = (parts: MessagePart[]): boolean => parts.some(part => readField(part, 'state') === 'streaming');

const isProse = (parts: MessagePart[], metadata: Record<string, unknown> | undefined): boolean =>
  parts.every(part => {
    if (part.type !== 'text') return true;
    const text = readField(part, 'text');
    return typeof text !== 'string' || messageTextKind(text, metadata) === 'prose';
  });

const getMessageMetadata = (message: MastraDBMessage): Record<string, unknown> | undefined =>
  isRecord(message.content.metadata) ? message.content.metadata : undefined;

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

const isPendingMessage = (message: MastraDBMessage): boolean => {
  if (message.content.metadata?.status === 'pending') return true;
  return message.content.parts.some(part => readField(readField(part, 'metadata'), 'status') === 'pending');
};
export const MessageRow = memo(function MessageRow({
  message,
  hasModelList,
  isSpeaking,
  onReadAloud,
  onStopSpeaking,
  readOnly,
  footer,
  className,
  ...rootProps
}: MessageRowProps) {
  const dbMessage = toDisplayMessage(message);
  const metadata = getMessageMetadata(message);
  const modelMetadata = hasModelList ? getModelMetadata(metadata) : undefined;
  const dataParts = useMemo(() => getDataParts(message), [message]);
  const running = useChatRunning();
  const isRunning = running.isRunning && running.activeRunId !== undefined && metadata?.runId === running.activeRunId;
  const { data: mcpAppTools } = useMcpAppTools();
  const parts = dbMessage?.content.parts ?? NO_PARTS;
  const revealed = useRevealedParts(parts, isStreaming(parts));
  const shownParts = isProse(parts, metadata) ? revealed : parts;
  const revealing = shownParts !== parts;

  const toolContext = useMemo<ToolCardContext>(() => ({ metadata, mcpAppTools }), [metadata, mcpAppTools]);
  const toolGroups = useMemo(() => collectToolGroups(shownParts, toolContext), [shownParts, toolContext]);

  const sharedRenderers = useMemo<MessageRenderers>(() => {
    const renderTool = (part: ToolPart) => {
      const fields = readToolPart(part);
      const group = toolGroups.byFirstKey.get(fields.toolCallId);
      if (group) {
        const members = group.map(readToolPart);
        return (
          <>
            {members.map(member => (
              <ToolCallEffects key={member.toolCallId} {...member} readOnly={readOnly} />
            ))}
            <Arriving>
              <ToolCallGroup
                steps={members.map(member => ({
                  toolName: member.toolName,
                  args: member.input,
                  status: badgeStatus(member.state, isRunning),
                  hasResult: isSettledState(member.state),
                }))}
              >
                {members.map(member => {
                  const incomplete = !isRunning && !isSettledState(member.state) && member.state !== 'output-error';
                  return (
                    <div
                      key={member.toolCallId}
                      role="group"
                      aria-label={member.toolName}
                      className="flex items-start gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <ToolCard {...member} metadata={metadata} dataParts={dataParts} readOnly={readOnly} />
                      </div>
                      {incomplete && (
                        <Txt as="span" variant="ui-xs" className="mt-1 shrink-0">
                          Incomplete
                        </Txt>
                      )}
                    </div>
                  );
                })}
              </ToolCallGroup>
            </Arriving>
          </>
        );
      }
      if (toolGroups.memberKeys.has(fields.toolCallId)) return null;
      return (
        <>
          <ToolCallEffects {...fields} readOnly={readOnly} />
          <Arriving>
            <ToolCard {...fields} metadata={metadata} dataParts={dataParts} readOnly={readOnly} />
          </Arriving>
        </>
      );
    };
    return {
      Reasoning: part => <ReasoningPartRenderer part={part} />,
      Data: part => (
        <Arriving>
          <DataPartRenderer part={part} />
        </Arriving>
      ),
      ToolInvocation: renderTool,
      DynamicTool: renderTool,
      Error: (part: MastraErrorPart) => (
        <Notice variant="destructive" title={part.error.name ?? 'Error'}>
          <Notice.Message>{part.error.message}</Notice.Message>
        </Notice>
      ),
    };
  }, [metadata, dataParts, readOnly, toolGroups, isRunning]);

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
      Text: part => <AssistantTextPartRenderer part={part} metadata={metadata} revealing={revealing} />,
    }),
    [sharedRenderers, metadata, revealing],
  );

  if (dbMessage === null) return null;
  const shownMessage = revealing ? { ...dbMessage, content: { ...dbMessage.content, parts: shownParts } } : dbMessage;
  const displayRole = dbMessage.role;

  if (displayRole === 'user') {
    const isPending = isPendingMessage(message);
    const text = getTextFromParts(message);
    const canCopy = text.trim().length > 0;

    return (
      <Message
        {...rootProps}
        from="user"
        className={className}
        data-message-id={message.id}
        pending={isPending}
        footer={
          <MessageActions>
            {canCopy && <MessageCopyButton text={text} />}
            <DatasetSaveAction messageText={text} />
            {footer}
          </MessageActions>
        }
      >
        <MessageFactory message={shownMessage} {...userRenderers} status={messageStatusRenderers} />
      </Message>
    );
  }

  const showActionBar = hasVisibleAssistantText(message, metadata);

  return (
    <Message
      {...rootProps}
      from="assistant"
      className={className}
      data-message-id={message.id}
      footer={
        (showActionBar || footer) && (
          <MessageActions visibility={readOnly ? 'hover' : 'always'}>
            {showActionBar && (
              <AssistantMessageActions
                text={getTextFromParts(message)}
                modelMetadata={modelMetadata}
                isSpeaking={isSpeaking}
                onReadAloud={onReadAloud}
                onStopSpeaking={onStopSpeaking}
              />
            )}
            {footer && <MessageActions>{footer}</MessageActions>}
          </MessageActions>
        )
      }
    >
      <ChatRunningContext.Provider value={{ ...running, isRunning }}>
        <MessageFactory message={shownMessage} {...assistantRenderers} status={messageStatusRenderers} />
      </ChatRunningContext.Provider>
    </Message>
  );
});
