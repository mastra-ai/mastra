import type { CoreMessage as CoreMessageV4, UIMessage as UIMessageV4 } from '@internal/ai-sdk-v4';

import { AIV4Adapter, AIV5Adapter } from '../adapters';
import { TypeDetector } from '../detection/TypeDetector';
import type {
  MastraDBMessage,
  MastraMessageV1,
  MessageSource,
  MemoryInfo,
  UIMessageWithMetadata,
} from '../state/types';
import type { MessageInput } from '../types';

/**
 * Context required for input conversion functions.
 * This is passed from MessageList to provide access to instance-specific utilities.
 */
export interface InputConversionContext {
  memoryInfo: MemoryInfo | null;
  newMessageId: () => string;
  generateCreatedAt: (messageSource: MessageSource, start?: unknown) => Date;
  /** Messages array for looking up tool call args */
  dbMessages: MastraDBMessage[];
}

/**
 * Convert any supported message input format to MastraDBMessage.
 * Routes to the appropriate converter based on message type detection.
 */
export function inputToMastraDBMessage(
  message: MessageInput,
  messageSource: MessageSource,
  context: InputConversionContext,
): MastraDBMessage {
  // Validate threadId matches (except for memory messages which can come from other threads)
  if (
    messageSource !== `memory` &&
    `threadId` in message &&
    message.threadId &&
    context.memoryInfo &&
    message.threadId !== context.memoryInfo.threadId
  ) {
    throw new Error(
      `Received input message with wrong threadId. Input ${message.threadId}, expected ${context.memoryInfo.threadId}`,
    );
  }

  // Validate resourceId matches
  if (
    `resourceId` in message &&
    message.resourceId &&
    context.memoryInfo?.resourceId &&
    message.resourceId !== context.memoryInfo.resourceId
  ) {
    throw new Error(
      `Received input message with wrong resourceId. Input ${message.resourceId}, expected ${context.memoryInfo.resourceId}`,
    );
  }

  if (TypeDetector.isMastraMessageV1(message)) {
    return mastraMessageV1ToMastraDBMessage(message, messageSource, context);
  }
  if (TypeDetector.isMastraDBMessage(message)) {
    return hydrateMastraDBMessageFields(message, context);
  }
  if (TypeDetector.isAIV4CoreMessage(message)) {
    return AIV4Adapter.fromCoreMessage(message, context, messageSource);
  }
  if (TypeDetector.isAIV4UIMessage(message)) {
    return AIV4Adapter.fromUIMessage(message as UIMessageV4 | UIMessageWithMetadata, context, messageSource);
  }

  if (TypeDetector.isAIV5CoreMessage(message)) {
    const dbMsg = AIV5Adapter.fromModelMessage(message, messageSource);
    // Only use the original createdAt from input message metadata, not the generated one from the static method
    // This fixes issue #10683 where messages without createdAt would get shuffled
    const rawCreatedAt =
      'metadata' in message &&
      message.metadata &&
      typeof message.metadata === 'object' &&
      'createdAt' in message.metadata
        ? message.metadata.createdAt
        : undefined;
    return {
      ...dbMsg,
      createdAt: context.generateCreatedAt(messageSource, rawCreatedAt),
      threadId: context.memoryInfo?.threadId,
      resourceId: context.memoryInfo?.resourceId,
    };
  }
  if (TypeDetector.isAIV5UIMessage(message)) {
    const dbMsg = AIV5Adapter.fromUIMessage(message);
    // Only use the original createdAt from input message, not the generated one from the static method
    // This fixes issue #10683 where messages without createdAt would get shuffled
    const rawCreatedAt = 'createdAt' in message ? message.createdAt : undefined;
    return {
      ...dbMsg,
      createdAt: context.generateCreatedAt(messageSource, rawCreatedAt),
      threadId: context.memoryInfo?.threadId,
      resourceId: context.memoryInfo?.resourceId,
    };
  }

  throw new Error(`Found unhandled message ${JSON.stringify(message)}`);
}

/**
 * Convert MastraMessageV1 format to MastraDBMessage.
 */
export function mastraMessageV1ToMastraDBMessage(
  message: MastraMessageV1,
  messageSource: MessageSource,
  context: InputConversionContext,
): MastraDBMessage {
  const coreV2 = AIV4Adapter.fromCoreMessage(
    {
      content: message.content,
      role: message.role,
    } as CoreMessageV4,
    context,
    messageSource,
  );

  return {
    id: message.id,
    role: coreV2.role,
    createdAt: context.generateCreatedAt(messageSource, message.createdAt),
    threadId: message.threadId,
    resourceId: message.resourceId,
    content: coreV2.content,
  };
}

/**
 * Hydrate a MastraDBMessage with missing fields (id, createdAt, threadId, resourceId).
 * Also fixes toolInvocations with empty args by looking in the parts array.
 */
export function hydrateMastraDBMessageFields(
  message: MastraDBMessage,
  context: InputConversionContext,
): MastraDBMessage {
  // Generate ID if missing
  if (!message.id) {
    message.id = context.newMessageId();
  }

  if (!(message.createdAt instanceof Date)) {
    message.createdAt = new Date(message.createdAt);
  }

  // Fix toolInvocations with empty args by looking in the parts array
  // This handles messages restored from database where toolInvocations might have lost their args
  if (message.content.toolInvocations && message.content.parts) {
    message.content.toolInvocations = message.content.toolInvocations.map(ti => {
      if (!ti.args || Object.keys(ti.args).length === 0) {
        // Find the corresponding tool-invocation part with args
        const partWithArgs = message.content.parts.find(
          part =>
            part.type === 'tool-invocation' &&
            part.toolInvocation &&
            part.toolInvocation.toolCallId === ti.toolCallId &&
            part.toolInvocation.args &&
            Object.keys(part.toolInvocation.args).length > 0,
        );
        if (partWithArgs && partWithArgs.type === 'tool-invocation') {
          return { ...ti, args: partWithArgs.toolInvocation.args };
        }
      }
      return ti;
    });
  }

  if (!message.threadId && context.memoryInfo?.threadId) {
    message.threadId = context.memoryInfo.threadId;

    if (!message.resourceId && context.memoryInfo?.resourceId) {
      message.resourceId = context.memoryInfo.resourceId;
    }
  }

  return message;
}
