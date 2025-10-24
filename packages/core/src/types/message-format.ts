import type { CoreMessage } from 'ai';
import type { UIMessage as AIV5UIMessage, ModelMessage as AIV5ModelMessage } from 'ai-v5';

import type { MastraDBMessage, UIMessageWithMetadata } from '../agent/message-list';

/**
 * Public-facing message format keys for the `format` parameter in memory queries.
 * 
 * @remarks
 * These lowercase, hyphenated keys are used for the new `format` parameter API.
 * They differ from the `OutputFormat` keys used in `convertMessages().to()` for backward compatibility.
 * 
 * - `mastra-db` - Mastra database storage format (MastraDBMessage) - **default**
 * - `aiv4-ui` - AI SDK v4 UIMessage format (for frontend components)
 * - `aiv4-core` - AI SDK v4 CoreMessage format (for LLM API calls)
 * - `aiv5-ui` - AI SDK v5 UIMessage format (for frontend components)
 * - `aiv5-model` - AI SDK v5 ModelMessage format (for LLM API calls)
 * 
 * @example
 * ```typescript
 * // Default - no conversion overhead
 * const { messages } = await memory.query({ threadId: 'thread-123' });
 * // messages is MastraDBMessage[]
 * 
 * // Explicit format for frontend
 * const { messages } = await memory.query({ 
 *   threadId: 'thread-123', 
 *   format: 'aiv5-ui' 
 * });
 * // messages is AIV5.UIMessage[]
 * ```
 */
export type MessageFormat = 
  | 'mastra-db'      // Default - internal storage format V2 (no conversion)
  | 'aiv4-ui'        // AI SDK v4 UIMessage (frontend)
  | 'aiv4-core'      // AI SDK v4 CoreMessage (LLM calls)
  | 'aiv5-ui'        // AI SDK v5 UIMessage (frontend)
  | 'aiv5-model';    // AI SDK v5 ModelMessage (LLM calls)

/**
 * Valid message format keys as a constant array for validation.
 */
export const VALID_MESSAGE_FORMATS: readonly MessageFormat[] = [
  'mastra-db',
  'aiv4-ui',
  'aiv4-core',
  'aiv5-ui',
  'aiv5-model',
] as const;

/**
 * Type guard to check if a string is a valid MessageFormat.
 */
export function isValidMessageFormat(format: unknown): format is MessageFormat {
  return typeof format === 'string' && VALID_MESSAGE_FORMATS.includes(format as MessageFormat);
}

/**
 * Validates a format parameter and throws a descriptive error if invalid.
 * 
 * @param format - The format to validate
 * @throws {Error} If the format is not a valid MessageFormat
 */
export function validateMessageFormat(format: unknown): asserts format is MessageFormat {
  if (!isValidMessageFormat(format)) {
    throw new Error(
      `Invalid format: "${format}". Valid formats: ${VALID_MESSAGE_FORMATS.join(', ')}`
    );
  }
}

/**
 * Maps a MessageFormat to its corresponding message array type.
 * 
 * @remarks
 * This generic type eliminates the need to repeat conditional types everywhere.
 * Use this for return types in methods that accept a `format` parameter.
 * 
 * @example
 * ```typescript
 * function getMessages<F extends MessageFormat = 'mastra-db'>(
 *   format?: F
 * ): Promise<MessageFormatResult<F>> {
 *   // ...
 * }
 * ```
 */
export type MessageFormatResult<F extends MessageFormat> = F extends 'mastra-db'
  ? MastraDBMessage[]
  : F extends 'aiv4-ui'
    ? UIMessageWithMetadata[]
    : F extends 'aiv4-core'
      ? CoreMessage[]
      : F extends 'aiv5-ui'
        ? AIV5UIMessage[]
        : F extends 'aiv5-model'
          ? AIV5ModelMessage[]
          : never;
