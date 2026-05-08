import type { Message as AIV4Message, UIMessage as UIMessageV4 } from '@internal/ai-sdk-v4';

import type { MastraDBMessage, MastraMessageV1 } from '../state/types';
import type { AIV5Type, AIV6Type, CoreMessageV4 } from '../types';

/**
 * Type representing all possible message input formats
 */
export type MessageInput =
  | AIV6Type.UIMessage
  | AIV6Type.ModelMessage
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
   * Check if a message is an AIV6 UIMessage.
   *
   * At runtime, the v5 and v6 UI shapes overlap heavily. We only treat a
   * message as distinctly v6 if it uses v6-only parts or tool states.
   */
  static isAIV6UIMessage(msg: MessageInput): msg is AIV6Type.UIMessage {
    return (
      !TypeDetector.isMastraMessage(msg) &&
      !TypeDetector.isAIV4CoreMessage(msg) &&
      'parts' in msg &&
      TypeDetector.hasAIV6UIMessageCharacteristics(
        msg as AIV6Type.UIMessage | AIV5Type.UIMessage | UIMessageV4 | AIV4Message,
      )
    );
  }

  /**
   * Check if a message is an AIV5 UIMessage
   */
  static isAIV5UIMessage(msg: MessageInput): msg is AIV5Type.UIMessage {
    return (
      !TypeDetector.isMastraMessage(msg) &&
      !TypeDetector.isAIV6UIMessage(msg) &&
      !TypeDetector.isAIV5CoreMessage(msg) &&
      'parts' in msg &&
      TypeDetector.hasAIV5UIMessageCharacteristics(msg)
    );
  }

  /**
   * Check if a message is an AIV4 CoreMessage
   */
  static isAIV4CoreMessage(msg: MessageInput): msg is CoreMessageV4 {
    // V4 CoreMessage has role and content like V5/V6, but content can be an
    // array of parts with v4-specific field names.
    return (
      !TypeDetector.isMastraMessage(msg) &&
      !('parts' in msg) &&
      'content' in msg &&
      !TypeDetector.hasAIV5CoreMessageCharacteristics(msg)
    );
  }

  /**
   * Check if a message is an AIV6 ModelMessage (CoreMessage equivalent).
   */
  static isAIV6CoreMessage(msg: MessageInput): msg is AIV6Type.ModelMessage {
    return (
      !TypeDetector.isMastraMessage(msg) &&
      !('parts' in msg) &&
      'content' in msg &&
      TypeDetector.hasAIV6CoreMessageCharacteristics(
        msg as CoreMessageV4 | AIV5Type.ModelMessage | AIV6Type.ModelMessage | AIV4Message,
      )
    );
  }

  /**
   * Check if a message is an AIV5 ModelMessage (CoreMessage equivalent)
   */
  static isAIV5CoreMessage(msg: MessageInput): msg is AIV5Type.ModelMessage {
    return (
      !TypeDetector.isMastraMessage(msg) &&
      !TypeDetector.isAIV6CoreMessage(msg) &&
      !('parts' in msg) &&
      'content' in msg &&
      TypeDetector.hasAIV5CoreMessageCharacteristics(msg)
    );
  }

  /**
   * Check if a message has AIV6-only UI characteristics.
   */
  static hasAIV6UIMessageCharacteristics(
    msg: AIV6Type.UIMessage | AIV5Type.UIMessage | UIMessageV4 | AIV4Message,
  ): msg is AIV6Type.UIMessage {
    if (!('parts' in msg) || !msg.parts) return false;

    for (const part of msg.parts) {
      if (part.type === 'source-document') return true;

      if (
        'toolCallId' in part &&
        'state' in part &&
        (part.state === 'approval-requested' || part.state === 'approval-responded' || part.state === 'output-denied')
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a message has AIV5 UIMessage characteristics
   *
   * V5 UIMessages have specific part types and field names that differ from V4.
   */
  static hasAIV5UIMessageCharacteristics(
    msg: AIV6Type.UIMessage | AIV5Type.UIMessage | UIMessageV4 | AIV4Message,
  ): msg is AIV5Type.UIMessage {
    // AI SDK v4 has separate arrays of tool invocations, reasoning, and
    // attachments that do not preserve overall part ordering, so their
    // presence is a quick early signal that this is not a v5/v6 UI message.
    if (
      'toolInvocations' in msg ||
      'reasoning' in msg ||
      'experimental_attachments' in msg ||
      'data' in msg ||
      'annotations' in msg
      // Don't check `content` here. That would fully narrow to v5 and is more
      // likely to misclassify a loosely constructed v5/v6 UI message.
    )
      return false;

    if (!msg.parts) return false; // likely an AIV4 Message

    for (const part of msg.parts) {
      if ('metadata' in part) return true;

      // Tool parts are the cleanest discriminator:
      // - v4 uses `tool-invocation`
      // - v5/v6 use `tool-${toolName}` / `dynamic-tool`
      if ('toolInvocation' in part) return false;
      if ('toolCallId' in part) return true;
      if (part.type === 'source') return false;
      if (part.type === 'source-url') return true;

      if (part.type === 'reasoning') {
        if ('state' in part || 'text' in part) return true; // v5/v6
        if ('reasoning' in part || 'details' in part) return false; // v4
      }

      if (part.type === 'file' && 'mediaType' in part) return true;
    }

    return false; // default to v4 for backwards compatibility
  }

  /**
   * Check if a message has AIV6-only core characteristics.
   */
  static hasAIV6CoreMessageCharacteristics(
    msg: CoreMessageV4 | AIV5Type.ModelMessage | AIV6Type.ModelMessage | AIV4Message,
  ): msg is AIV6Type.ModelMessage {
    if ('parts' in msg || typeof msg.content === 'string') return false;

    return msg.content.some(part => part.type === 'tool-approval-request' || part.type === 'tool-approval-response');
  }

  /**
   * Check if a message has AIV5 CoreMessage characteristics
   *
   * V5 ModelMessages use different field names from v4
   * (for example `output` vs `result`, `input` vs `args`,
   * `mediaType` vs `mimeType`).
   */
  static hasAIV5CoreMessageCharacteristics(
    msg:
      | CoreMessageV4
      | AIV6Type.ModelMessage
      | AIV5Type.ModelMessage
      // This is here because the AIV4 Message type can omit parts entirely.
      | AIV4Message,
  ): msg is AIV5Type.ModelMessage {
    if ('experimental_providerMetadata' in msg) return false;
    // String content is identical in v4/v5/v6, so treat it as v5-compatible.
    if (typeof msg.content === 'string') return true;

    for (const part of msg.content) {
      if (part.type === 'tool-result' && 'output' in part) return true;
      if (part.type === 'tool-call' && 'input' in part) return true;
      if (part.type === 'tool-result' && 'result' in part) return false;
      if (part.type === 'tool-call' && 'args' in part) return false;
      if ('mediaType' in part) return true;
      if ('mimeType' in part) return false;
      if ('experimental_providerMetadata' in part) return false;
      if (part.type === 'reasoning' && 'signature' in part) return false;
      if (part.type === 'redacted-reasoning') return false;
    }

    // If no distinguishing features are found, the message shape is still
    // compatible with the v5 model format.
    return true;
  }

  /**
   * Get the normalized role for a message
   * Maps `tool` to `assistant` because tool messages are displayed as part of
   * the assistant conversation.
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
