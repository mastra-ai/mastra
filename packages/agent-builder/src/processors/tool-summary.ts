import { Agent } from '@mastra/core/agent';
import type { MastraLanguageModel } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import { MemoryProcessor } from '@mastra/core/memory';

/**
 * Summarizes tool calls and caches results to avoid re-summarizing identical calls
 */
export class ToolSummaryProcessor extends MemoryProcessor {
  private summaryAgent: Agent;
  private summaryCache: Map<string, string> = new Map();

  constructor({ summaryModel }: { summaryModel: MastraLanguageModel }) {
    super({ name: 'ToolSummaryProcessor' });
    this.summaryAgent = new Agent({
      name: 'ToolSummaryAgent',
      description: 'A summary agent that summarizes tool calls and results',
      instructions: 'You are a summary agent that summarizes tool calls and results',
      model: summaryModel,
    });
  }

  /**
   * Creates a cache key from tool call arguments
   */
  public createCacheKey(toolCall: any): string {
    if (!toolCall) return 'unknown';

    // Create a deterministic key from tool name and arguments
    const toolName = toolCall.toolName || 'unknown';
    const args = toolCall.args || {};

    // Sort keys for consistent hashing
    const sortedArgs = Object.keys(args)
      .sort()
      .reduce((result: Record<string, any>, key) => {
        result[key] = args[key];
        return result;
      }, {});

    return `${toolName}:${JSON.stringify(sortedArgs)}`;
  }

  /**
   * Clears the summary cache
   */
  public clearCache(): void {
    this.summaryCache.clear();
  }

  /**
   * Gets cache statistics
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.summaryCache.size,
      keys: Array.from(this.summaryCache.keys()),
    };
  }

  async process(messages: CoreMessage[]): Promise<CoreMessage[]> {
    // Collect all tool calls that need summarization
    const summaryTasks: Array<{
      content: any;
      promise: Promise<any>;
      cacheKey: string;
    }> = [];

    // First pass: collect all tool results that need summarization
    for (const message of messages) {
      if (
        message.role === 'tool' &&
        Array.isArray(message.content) &&
        message.content.length > 0 &&
        message.content?.some(content => content.type === 'tool-result')
      ) {
        for (const content of message.content) {
          if (content.type === 'tool-result') {
            const assistantMessageWithToolCall = messages.find(
              message =>
                message.role === 'assistant' &&
                Array.isArray(message.content) &&
                message.content.length > 0 &&
                message.content?.some(
                  assistantContent =>
                    assistantContent.type === 'tool-call' && assistantContent.toolCallId === content.toolCallId,
                ),
            );
            const toolCall = Array.isArray(assistantMessageWithToolCall?.content)
              ? assistantMessageWithToolCall?.content.find(
                  assistantContent =>
                    assistantContent.type === 'tool-call' && assistantContent.toolCallId === content.toolCallId,
                )
              : null;

            const cacheKey = this.createCacheKey(toolCall);
            const cachedSummary = this.summaryCache.get(cacheKey);

            if (cachedSummary) {
              // Use cached summary immediately
              content.result = `Tool call summary: ${cachedSummary}`;
            } else {
              // Create a promise for this summary (but don't await yet)
              const summaryPromise = this.summaryAgent.generate(
                `Summarize the following tool call: ${JSON.stringify(toolCall)} and result: ${JSON.stringify(content)}`,
              );

              summaryTasks.push({
                content,
                promise: summaryPromise,
                cacheKey,
              });
            }
          }
        }
      }
    }

    // Execute all non-cached summaries in parallel
    if (summaryTasks.length > 0) {
      const summaryResults = await Promise.allSettled(summaryTasks.map(task => task.promise));

      // Apply the results back to the content and cache them
      summaryTasks.forEach((task, index) => {
        const result = summaryResults[index];
        if (!result) return;

        if (result.status === 'fulfilled') {
          const summaryResult = result.value;
          const summaryText = summaryResult.text;

          // Cache the summary for future use
          this.summaryCache.set(task.cacheKey, summaryText);

          // Apply to content
          task.content.result = `Tool call summary: ${summaryText}`;
        } else if (result.status === 'rejected') {
          // Handle failed summary - use fallback or log error
          console.warn(`Failed to generate summary for tool call:`, result.reason);
          task.content.result = `Tool call summary: [Summary generation failed]`;
        }
      });
    }

    return messages;
  }
}
