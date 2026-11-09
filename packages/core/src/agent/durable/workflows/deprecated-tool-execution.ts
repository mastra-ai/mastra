/**
 * Deprecated durable tool-execution helpers.
 *
 * This is the frozen pre-unification implementation of the shared durable
 * tool-call executor, preserved verbatim so the public
 * `@mastra/core/agent/durable` entry point keeps its released surface at
 * patch level. The durable engines no longer call it — tool execution now
 * flows through the shared loop cores (`loop/shared/steps`), which handle
 * background dispatch, processors, approval, and abort. New code should not
 * import from this module.
 *
 * @deprecated Superseded by the shared loop cores; will be removed in v2.
 */

import type { RequestContext } from '../../../request-context';
import type { Workspace } from '../../../workspace';
import type { DurableToolCallInput, DurableToolCallOutput } from '../types';

/**
 * Context for tool execution
 *
 * @deprecated Superseded by the shared loop cores; will be removed in v2.
 */
export interface ToolExecutionContext {
  /** Tool calls from the LLM output */
  toolCalls: DurableToolCallInput[];
  /** Resolved tools with execute functions */
  tools: Record<string, any>;
  /** Run identifier */
  runId: string;
  /** Agent identifier */
  agentId: string;
  /** Message identifier */
  messageId: string;
  /** Serializable state */
  state: any;
  /** Workspace for file/sandbox operations */
  workspace?: Workspace;
  /** Request context for auth data, feature flags, etc. */
  requestContext?: RequestContext;

  /**
   * Optional hooks for observability/streaming.
   * All hooks can be sync or async.
   */

  /** Called before starting tool execution (for span creation) */
  onToolStart?: (toolCall: DurableToolCallInput) => void | Promise<void>;
  /** Called after successful tool execution (for span close, pubsub emit) */
  onToolResult?: (toolCall: DurableToolCallInput, result: unknown) => void | Promise<void>;
  /** Called on tool execution error (for span error, pubsub emit) */
  onToolError?: (toolCall: DurableToolCallInput, error: ToolExecutionError) => void | Promise<void>;
}

/**
 * Error structure for tool execution failures
 *
 * @deprecated Superseded by the shared loop cores; will be removed in v2.
 */
export interface ToolExecutionError {
  name: string;
  message: string;
  stack?: string;
}

/**
 * Execute tool calls durably with optional hooks for observability and streaming.
 *
 * @deprecated Superseded by the shared loop cores; will be removed in v2.
 * The durable agent workflows no longer call this helper.
 *
 * @param ctx - Tool execution context with tool calls, resolved tools, and optional hooks
 * @returns Array of tool call outputs with results or errors
 */
export async function executeDurableToolCalls(ctx: ToolExecutionContext): Promise<DurableToolCallOutput[]> {
  const toolResults: DurableToolCallOutput[] = [];

  for (const toolCall of ctx.toolCalls) {
    // Handle provider-executed tools (e.g., OpenAI function calling with parallel_tool_calls)
    if (toolCall.providerExecuted && toolCall.output !== undefined) {
      toolResults.push({
        ...toolCall,
        result: toolCall.output,
      });
      continue;
    }

    // Resolve the tool from the tools record
    const tool = ctx.tools[toolCall.toolName];

    if (!tool) {
      const error: ToolExecutionError = {
        name: 'ToolNotFoundError',
        message: `Tool ${toolCall.toolName} not found`,
      };
      await ctx.onToolError?.(toolCall, error);
      toolResults.push({
        ...toolCall,
        error,
      });
      continue;
    }

    // Notify start of tool execution (for observability)
    await ctx.onToolStart?.(toolCall);

    // Execute the tool
    try {
      if (tool.execute) {
        const result = await tool.execute(toolCall.args, {
          toolCallId: toolCall.toolCallId,
          messages: [],
          workspace: ctx.workspace,
          requestContext: ctx.requestContext,
        });
        await ctx.onToolResult?.(toolCall, result);
        toolResults.push({
          ...toolCall,
          result,
        });
      } else {
        // Tool has no execute function - return undefined result
        await ctx.onToolResult?.(toolCall, undefined);
        toolResults.push({
          ...toolCall,
          result: undefined,
        });
      }
    } catch (error) {
      const toolError: ToolExecutionError = {
        name: 'ToolExecutionError',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
      await ctx.onToolError?.(toolCall, toolError);
      toolResults.push({
        ...toolCall,
        error: toolError,
      });
    }
  }

  return toolResults;
}
