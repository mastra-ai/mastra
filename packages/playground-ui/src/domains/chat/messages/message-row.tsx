import type { MastraDBMessage, MastraErrorPart } from '@mastra/core/agent/message-list';
import { useMcpAppTools } from '@mastra/react/hooks/mcps';
import { MessageFactory } from '@mastra/react/ui';
import type { MessageRenderers } from '@mastra/react/ui';
import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import { MessageAttachments } from '../attachments/message-attachments';
import { splitMessageAttachments } from '../attachments/split-message-attachments';
import { AssistantMessageActions, DatasetSaveAction } from '@/domains/chat';
import { ChatRunningContext, useChatRunning } from '@/domains/chat/context/chat-context';
import { AssistantTextPartRenderer } from '@/domains/chat/messages/renderers/assistant-text-part-renderer';
import { DataPartRenderer } from '@/domains/chat/messages/renderers/data-part-renderer';
import { messageTextKind } from '@/domains/chat/messages/renderers/message-text-kind';
import { ReasoningPartRenderer } from '@/domains/chat/messages/renderers/reasoning-part-renderer';
import { messageStatusRenderers } from '@/domains/chat/messages/renderers/status-renderers';
import { readToolPart } from '@/domains/chat/messages/renderers/tool-part';
import type { ToolPart } from '@/domains/chat/messages/renderers/tool-part';
import { UserFilePartRenderer } from '@/domains/chat/messages/renderers/user-file-part-renderer';
import { UserTextPartRenderer } from '@/domains/chat/messages/renderers/user-text-part-renderer';
import {
  getSignalType,
  isRecord,
  isSignalData,
  isUserSignalType,
  toReactiveSignalData,
} from '@/domains/chat/messages/signal-data';
import { parseSkillActivation } from '@/domains/chat/messages/skill-activation';
import { SkillMessage } from '@/domains/chat/messages/skill-message';
import { ToolCallEffects } from '@/domains/chat/tools/tool-call-effects';
import { ToolCard } from '@/domains/chat/tools/tool-card';
import type { DataMessagePart } from '@/domains/chat/tools/tool-card';
import { badgeStatus, isSettledState } from '@/domains/chat/tools/tool-card-kind';
import type { ToolCardContext } from '@/domains/chat/tools/tool-card-kind';
import { collectToolGroups } from '@/domains/chat/tools/tool-groups';
import { useRevealedParts } from '@/ds/components/ai/message-reveal';
import { ToolCallGroup } from '@/ds/components/ai/tool-call';
import { Arriving } from '@/ds/components/Arrival';
import { Message, MessageActions, MessageCopyButton } from '@/ds/components/Message';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';

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
                        <Txt as="span" variant="meta" className="mt-1 shrink-0">
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
      Reasoning: part => <ReasoningPartRenderer part={isRunning ? part : { ...part, state: 'done' }} />,
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
    const soleText = parts.length === 1 && parts[0]?.type === 'text' ? readField(parts[0], 'text') : undefined;
    const skillActivation = typeof soleText === 'string' ? parseSkillActivation(soleText) : undefined;
    if (skillActivation) {
      return (
        <Message
          {...rootProps}
          from="assistant"
          className={className}
          data-message-id={message.id}
          footer={footer && <MessageActions visibility={readOnly ? 'hover' : 'always'}>{footer}</MessageActions>}
        >
          <SkillMessage activation={skillActivation} />
        </Message>
      );
    }

    const { attachments, content } = splitMessageAttachments(shownMessage.content.parts ?? []);
    const contentMessage = { ...shownMessage, content: { ...shownMessage.content, parts: content } };
    const isPending = isPendingMessage(message);
    const text = getTextFromParts(contentMessage);
    const canCopy = text.trim().length > 0;

    return (
      <Message
        {...rootProps}
        from="user"
        className={className}
        data-message-id={message.id}
        pending={isPending}
        attachments={attachments.length > 0 && <MessageAttachments parts={attachments} />}
        footer={
          <MessageActions>
            {canCopy && <MessageCopyButton text={text} />}
            <DatasetSaveAction messageText={text} />
            {footer}
          </MessageActions>
        }
      >
        {(attachments.length === 0 || content.length > 0) && (
          <MessageFactory message={contentMessage} {...userRenderers} status={messageStatusRenderers} />
        )}
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
