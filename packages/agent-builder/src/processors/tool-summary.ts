import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import type { Processor } from '@mastra/core/processors';

/**
 * Summarizes tool calls and caches results to avoid re-summarizing identical calls
 */
export class ToolSummaryProcessor implements Processor {
  readonly id = 'tool-summary-processor';
  readonly name = 'ToolSummaryProcessor';

  private summaryAgent: Agent;
  private summaryCache: Map<string, string> = new Map();

  constructor({ summaryModel }: { summaryModel: MastraModelConfig }) {
    this.summaryAgent = new Agent({
      id: 'tool-summary-agent',
      name: 'Tool Summary Agent',
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

  async processInput({
    messages,
    messageList: _messageList,
  }: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
  }): Promise<MastraDBMessage[]> {
    // Collect all tool calls that need summarization
    const summaryTasks: Array<{
      message: MastraDBMessage;
      partIndex: number;
      promise: Promise<any>;
      cacheKey: string;
    }> = [];

    // First pass: collect all tool results that need summarization
    for (const message of messages) {
      if (message.content.format === 2 && message.content.parts) {
        for (let partIndex = 0; partIndex < message.content.parts.length; partIndex++) {
          const part = message.content.parts[partIndex];

          // Check if this is a tool invocation with a result
          if (part && part.type === 'tool-invocation' && part.toolInvocation?.state === 'result') {
            const cacheKey = this.createCacheKey(part.toolInvocation);
            const cachedSummary = this.summaryCache.get(cacheKey);

            if (cachedSummary) {
              // Use cached summary - update the tool invocation result
              message.content.parts[partIndex] = {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  step: part.toolInvocation.step,
                  toolCallId: part.toolInvocation.toolCallId,
                  toolName: part.toolInvocation.toolName,
                  args: part.toolInvocation.args,
                  result: `Tool call summary: ${cachedSummary}`,
                },
              };
            } else {
              // Create a promise for this summary (but don't await yet)
              const summaryPromise = this.summaryAgent.generate(
                `Summarize the following tool call: ${JSON.stringify(part.toolInvocation)}`,
              );

              summaryTasks.push({
                message,
                partIndex,
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

          // Apply to message content
          if (task.message.content.format === 2 && task.message.content.parts) {
            const part = task.message.content.parts[task.partIndex];
            if (part && part.type === 'tool-invocation' && part.toolInvocation?.state === 'result') {
              task.message.content.parts[task.partIndex] = {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  step: part.toolInvocation.step,
                  toolCallId: part.toolInvocation.toolCallId,
                  toolName: part.toolInvocation.toolName,
                  args: part.toolInvocation.args,
                  result: `Tool call summary: ${summaryText}`,
                },
              };
            }
          }
        } else if (result.status === 'rejected') {
          // Handle failed summary - use fallback or log error
          console.warn(`Failed to generate summary for tool call:`, result.reason);
        }
      });
    }

    return messages;
  }
}
