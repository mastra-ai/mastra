import type { Message as AIV4Message, UIMessage as UIMessageV4 } from '@internal/ai-sdk-v4';

import type { MastraDBMessage, MastraMessageV1 } from '../state/types';
import type { AIV5Type, CoreMessageV4 } from '../types';

/**
 * Type representing all possible message input formats
 */
export type MessageInput =
  | AIV5Type.UIMessage
  | AIV5Type.ModelMessage
  | (UIMessageV4 & { metadata?: Record<string, unknown> })
  | AIV4Message
  | CoreMessageV4
  | MastraMessageV1
  | MastraDBMessage;

/**
 * TypeDetector - Centralized type detection for different message formats
 *
 * This class provides consistent type detection across all message formats,
 * which is critical for:
 * - Determining which conversion path to use
 * - Validating incoming message formats
 * - Providing better TypeScript type narrowing
 *
 * The detection order is important because some formats share similar properties.
 */
export class TypeDetector {
  /**
   * Check if a message is a MastraDBMessage (format 2)
   */
  static isMastraDBMessage(msg: MessageInput): msg is MastraDBMessage {
    return Boolean(
      'content' in msg &&
      msg.content &&
      !Array.isArray(msg.content) &&
      typeof msg.content !== 'string' &&
      'format' in msg.content &&
      msg.content.format === 2,
    );
  }

  /**
   * Check if a message is a MastraMessageV1 (legacy format)
   */
  static isMastraMessageV1(msg: MessageInput): msg is MastraMessageV1 {
    return !TypeDetector.isMastraDBMessage(msg) && ('threadId' in msg || 'resourceId' in msg);
  }

  /**
   * Check if a message is either Mastra format (V1 or V2/DB)
   */
  static isMastraMessage(msg: MessageInput): msg is MastraDBMessage | MastraMessageV1 {
    return TypeDetector.isMastraDBMessage(msg) || TypeDetector.isMastraMessageV1(msg);
  }

  /**
   * Check if a message is an AIV4 UIMessage
   */
  static isAIV4UIMessage(msg: MessageInput): msg is UIMessageV4 {
    return (
      !TypeDetector.isMastraMessage(msg) &&
      !TypeDetector.isAIV4CoreMessage(msg) &&
      'parts' in msg &&
      !TypeDetector.hasAIV5UIMessageCharacteristics(msg)
    );
  }

  /**
   * Check if a message is an AIV5 UIMessage
   */
  static isAIV5UIMessage(msg: MessageInput): msg is AIV5Type.UIMessage {
    return (
      !TypeDetector.isMastraMessage(msg) &&
      !TypeDetector.isAIV5CoreMessage(msg) &&
      'parts' in msg &&
      TypeDetector.hasAIV5UIMessageCharacteristics(msg)
    );
  }

  /**
   * Check if a message is an AIV4 CoreMessage
   */
  static isAIV4CoreMessage(msg: MessageInput): msg is CoreMessageV4 {
    // V4 CoreMessage has role and content like V5, but content can be array of parts
    return (
      !TypeDetector.isMastraMessage(msg) &&
      !('parts' in msg) &&
      'content' in msg &&
      !TypeDetector.hasAIV5CoreMessageCharacteristics(msg)
    );
  }

  /**
   * Check if a message is an AIV5 ModelMessage (CoreMessage equivalent)
   */
  static isAIV5CoreMessage(msg: MessageInput): msg is AIV5Type.ModelMessage {
    return (
      !TypeDetector.isMastraMessage(msg) &&
      !('parts' in msg) &&
      'content' in msg &&
      TypeDetector.hasAIV5CoreMessageCharacteristics(msg)
    );
  }

  /**
   * Check if a message has AIV5 UIMessage characteristics
   *
   * V5 UIMessages have specific part types and field names that differ from V4
   */
  static hasAIV5UIMessageCharacteristics(
    msg: AIV5Type.UIMessage | UIMessageV4 | AIV4Message,
  ): msg is AIV5Type.UIMessage {
    // ai v4 has these separated arrays of parts that don't record overall order
    // so we can check for their presence as a faster/early check
    if (
      'toolInvocations' in msg ||
      'reasoning' in msg ||
      'experimental_attachments' in msg ||
      'data' in msg ||
      'annotations' in msg
      // don't check `content` in msg because it fully narrows the type to v5 and there's a chance someone might mess up and add content to a v5 message, that's more likely than the other keys
    )
      return false;

    if (!msg.parts) return false; // this is likely an AIV4Type.Message

    for (const part of msg.parts) {
      if ('metadata' in part) return true;

      // tools are annoying cause ai v5 has the type as
      // tool-${toolName}
      // in v4 we had tool-invocation
      // technically
      // v4 tool
      if ('toolInvocation' in part) return false;
      // v5 tool
      if ('toolCallId' in part) return true;

      if (part.type === 'source') return false;
      if (part.type === 'source-url') return true;

      if (part.type === 'reasoning') {
        if ('state' in part || 'text' in part) return true; // v5
        if ('reasoning' in part || 'details' in part) return false; // v4
      }

      if (part.type === 'file' && 'mediaType' in part) return true;
    }

    return false; // default to v4 for backwards compat
  }

  /**
   * Check if a message has AIV5 CoreMessage characteristics
   *
   * V5 ModelMessages use different field names (output vs result, input vs args, mediaType vs mimeType)
   */
  static hasAIV5CoreMessageCharacteristics(
    msg:
      | CoreMessageV4
      | AIV5Type.ModelMessage
      // This is here because AIV4 "Message" type can omit parts! 😱
      | AIV4Message,
  ): msg is AIV5Type.ModelMessage {
    if ('experimental_providerMetadata' in msg) return false; // is v4 cause v5 doesn't have this property

    // String content is identical in both v4 and v5, so we can safely treat it as v5-compatible
    // This doesn't misclassify v4 messages because the format is the same
    if (typeof msg.content === 'string') return true;

    for (const part of msg.content) {
      if (part.type === 'tool-result' && 'output' in part) return true; // v5 renamed result->output,
      if (part.type === 'tool-call' && 'input' in part) return true; // v5 renamed args->input
      if (part.type === 'tool-result' && 'result' in part) return false; // v5 renamed result->output,
      if (part.type === 'tool-call' && 'args' in part) return false; // v5 renamed args->input

      // for file and image
      if ('mediaType' in part) return true; // v5 renamed mimeType->mediaType
      if ('mimeType' in part) return false;

      // applies to multiple part types
      if ('experimental_providerMetadata' in part) return false; // was in v4 but deprecated for providerOptions, v4+5 have providerOptions though, can't check the other way

      if (part.type === 'reasoning' && 'signature' in part) return false; // v5 doesn't have signature, which is optional in v4

      if (part.type === 'redacted-reasoning') return false; // only in v4, seems like in v5 they add it to providerOptions or something?
    }

    // If no distinguishing features were found, the message format is identical in v4 and v5
    // We return true (v5-compatible) because the message can be used as-is with v5
    return true;
  }

  /**
   * Get the normalized role for a message
   * Maps 'tool' role to 'assistant' since tool messages are displayed as part of assistant conversation
   */
  static getRole(message: MessageInput): MastraDBMessage['role'] {
    if (message.role === 'assistant' || message.role === 'tool') return 'assistant';
    if (message.role === 'user') return 'user';
    if (message.role === 'system') return 'system';
    throw new Error(
      `BUG: add handling for message role ${message.role} in message ${JSON.stringify(message, null, 2)}`,
    );
  }
}
