import type * as AIV5 from '@internal/ai-v7';

import type { MastraDBMessage, MessageListInput } from '../index';

import { MessageList } from '../index';

/**
 * Available output formats for message conversion.
 *
 * @remarks
 * - `Mastra.V2` - Current database storage format
 * - `AIV5.UI` - AI SDK v5 UIMessage format (for frontend components)
 * - `AIV5.Model` - AI SDK v5 ModelMessage format (for LLM API calls)
 * - `AIV5.UI` - AI SDK v6 UIMessage format (for frontend components)
 */
export type OutputFormat = 'Mastra.V2' | 'AIV5.UI' | 'AIV5.Model' | 'AIV5.UI';

class MessageConverter {
  private messageList: MessageList;

  constructor(messages: MessageListInput) {
    this.messageList = new MessageList();
    // Use 'memory' source to preserve messages exactly as provided
    // without any transformations or combinations
    this.messageList.add(messages, 'memory');
  }

  /**
   * Convert messages to Mastra V2 format (current database format).
   * @param format - The format 'Mastra.V2'
   * @returns Array of messages in Mastra V2 format, used for database storage
   */
  to(format: 'Mastra.V2'): MastraDBMessage[];
  /**
   * Convert messages to AI SDK v5 UIMessage format.
   * @param format - The format 'AIV5.UI'
   * @returns Array of UIMessages for use with AI SDK v5 frontend components
   */
  to(format: 'AIV5.UI'): AIV5.UIMessage[];
  /**
   * Convert messages to AI SDK v5 ModelMessage format.
   * @param format - The format 'AIV5.Model'
   * @returns Array of ModelMessages for AI SDK v5 LLM API calls
   */
  to(format: 'AIV5.Model'): AIV5.ModelMessage[];
  /**
   * Convert messages to AI SDK v6 UIMessage format.
   * @param format - The format 'AIV5.UI'
   * @returns Array of UIMessages for use with AI SDK v6 frontend components
   */
  to(format: 'AIV5.UI'): AIV5.UIMessage[];
  to(format: OutputFormat): unknown[] {
    switch (format) {
      // Old format keys (backward compatibility)
      case 'Mastra.V2':
        return this.messageList.get.all.db();
      case 'AIV5.UI':
        return this.messageList.get.all.aiSdk.ui();
      case 'AIV5.Model':
        return this.messageList.get.all.aiSdk.model();
      case 'AIV5.UI':
        return this.messageList.get.all.aiSdk.ui();
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }
}

/**
 * Convert messages from any supported format to another format.
 *
 * @param messages - Input messages in any supported format. Accepts:
 *   - AI SDK v5 formats: UIMessage, ModelMessage
 *   - Mastra formats: MastraMessageV1 (input only), MastraDBMessage
 *   - Simple strings (will be converted to user messages)
 *   - Arrays of any of the above
 *
 * @returns A converter object with a `.to()` method to specify the output format
 *
 * @example
 * ```typescript
 * import { convertMessages } from '@mastra/core/agent';
 *
 * // Convert database messages (Mastra V2) to AI SDK v5 UI messages for frontend
 * const v5UIMessages = convertMessages(dbMessages).to('AIV5.UI');
 *
 * // Convert any format to Mastra's V2 format for database storage
 * const mastraV2Messages = convertMessages(anyMessages).to('Mastra.V2');
 *
 * // Convert simple strings to formatted messages
 * const messages = convertMessages(['Hello', 'How are you?']).to('AIV5.UI');
 *
 * // Convert v5 UI messages to v5 Model messages for LLM calls
 * const modelMessages = convertMessages(v5UIMessages).to('AIV5.Model');
 * ```
 *
 * @remarks
 * This utility handles all message format conversions internally, including:
 * - Tool invocations and results
 * - File attachments
 * - Multi-part messages
 * - System messages
 * - Metadata preservation where possible
 */
export function convertMessages(messages: MessageListInput): MessageConverter {
  return new MessageConverter(messages);
}
