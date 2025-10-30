import type * as AIV4 from 'ai';
import type * as AIV5 from 'ai-v5';
import { MessageList } from '../index';
import type { MastraMessageV2, UIMessageWithMetadata, MessageListInput } from '../index';

/**
 * Available output formats for message conversion.
 *
 * @remarks
 * - `Mastra.V2` - Current database storage format, compatible with AI SDK v4
 * - `AIV4.UI` - AI SDK v4 UIMessage format (for frontend components)
 * - `AIV4.Core` - AI SDK v4 CoreMessage format (for LLM API calls)
 * - `AIV5.UI` - AI SDK v5 UIMessage format (for frontend components)
 * - `AIV5.Model` - AI SDK v5 ModelMessage format (for LLM API calls)
 */
export type OutputFormat = 'Mastra.V2' | 'AIV4.UI' | 'AIV4.Core' | 'AIV5.UI' | 'AIV5.Model';

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
  to(format: 'Mastra.V2'): MastraMessageV2[];
  /**
   * Convert messages to AI SDK v4 UIMessage format.
   * @param format - The format 'AIV4.UI'
   * @returns Array of UIMessages for use with AI SDK v4 frontend components
   */
  to(format: 'AIV4.UI'): UIMessageWithMetadata[] | AIV4.UIMessage[];
  /**
   * Convert messages to AI SDK v4 CoreMessage format.
   * @param format - The format 'AIV4.Core'
   * @returns Array of CoreMessages for AI SDK v4 LLM API calls
   */
  to(format: 'AIV4.Core'): AIV4.CoreMessage[];
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
  to(format: OutputFormat): unknown[] {
    switch (format) {
      case 'Mastra.V2':
        return this.messageList.get.all.v2();
      case 'AIV4.UI':
        return this.messageList.get.all.aiV4.ui();
      case 'AIV4.Core':
        return this.messageList.get.all.aiV4.core();
      case 'AIV5.UI':
        return this.messageList.get.all.aiV5.ui();
      case 'AIV5.Model':
        return this.messageList.get.all.aiV5.model();
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }
}

/**
 * Convert messages from any supported format to another format.
 *
 * @param messages - Input messages in any supported format. Accepts:
 *   - AI SDK v4 formats: UIMessage, CoreMessage, Message
 *   - AI SDK v5 formats: UIMessage, ModelMessage
 *   - Mastra formats: MastraMessageV1 (input only), MastraMessageV2
 *   - Simple strings (will be converted to user messages)
 *   - Arrays of any of the above
 *
 * @returns A converter object with a `.to()` method to specify the output format
 *
 * @example
 * ```typescript
 * import { convertMessages } from '@mastra/core/agent';
 *
 * // Convert AI SDK v5 UI messages to v4 Core messages
 * const v4CoreMessages = convertMessages(v5UIMessages).to('AIV4.Core');
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
 * // Convert v4 UI messages to v5 Model messages for LLM calls
 * const modelMessages = convertMessages(v4UIMessages).to('AIV5.Model');
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
