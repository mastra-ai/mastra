import type { Processor, ProcessInputStepArgs } from '@mastra/core/processors';
import type { MastraDBMessage } from '@mastra/core/agent';

export interface DateInjectorConfig {
  /**
   * The date string to inject (in official LongMemEval format: "2023/05/30 (Tue) 23:40")
   */
  date: string;
}

/**
 * Input processor that injects the current date into the user's message.
 *
 * This matches the official LongMemEval benchmark format where the date
 * is part of the user prompt: "Current Date: {date}\nQuestion: {question}"
 *
 * By default, this processor runs AFTER RAG filtering, so the date
 * becomes part of the RAG query. This is more authentic to the benchmark
 * and may help RAG pick up on temporal relevance.
 */
export class DateInjector implements Processor<'date-injector'> {
  readonly id = 'date-injector' as const;
  private date: string;

  constructor(config: DateInjectorConfig) {
    this.date = config.date;
  }

  processInputStep(args: ProcessInputStepArgs) {
    const { messages, messageList } = args;

    // Find the most recent user message
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) {
      return messageList;
    }

    const lastUserMessage = messages[lastUserIndex];
    const originalContent = this.extractContent(lastUserMessage);

    // Format: "Current Date: {date}\nQuestion: {question}"
    // This matches the official LongMemEval prompt template
    const newContent = `Current Date: ${this.date}\nQuestion: ${originalContent}`;

    // Mutate the message content in place, preserving the original structure
    const content = lastUserMessage.content;
    if (content && typeof content === 'object' && 'format' in content && content.format === 2) {
      // MastraMessageContentV2 format - update the nested content string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (content as any).content = newContent;
      // Also update parts if they exist
      if (Array.isArray((content as { parts?: unknown[] }).parts)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (content as any).parts = [{ type: 'text', text: newContent }];
      }
    } else {
      // Simple string content or other format - replace directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (lastUserMessage as any).content = newContent;
    }

    return messageList;
  }

  private extractContent(msg: MastraDBMessage): string {
    const content = msg.content;

    // Handle string content
    if (typeof content === 'string') {
      return content;
    }

    // Handle MastraMessageContentV2 format
    if (content && typeof content === 'object' && 'format' in content && content.format === 2) {
      if (typeof content.content === 'string' && content.content) {
        return content.content;
      }
      if (Array.isArray(content.parts)) {
        const textParts = content.parts
          .filter(
            (p): p is { type: 'text'; text: string } =>
              p && typeof p === 'object' && p.type === 'text' && typeof p.text === 'string',
          )
          .map(p => p.text);
        if (textParts.length > 0) {
          return textParts.join(' ');
        }
      }
    }

    // Handle plain array content
    if (Array.isArray(content)) {
      const textParts = content
        .filter(
          (p): p is { type: 'text'; text: string } =>
            p && typeof p === 'object' && p.type === 'text' && typeof p.text === 'string',
        )
        .map(p => p.text);
      return textParts.join(' ') || '';
    }

    return '';
  }
}
