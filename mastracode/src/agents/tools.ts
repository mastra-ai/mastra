import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { HarnessRequestContext } from '@mastra/core/harness';
import type { RequestContext } from '@mastra/core/request-context';
import type { z } from 'zod';
import type { HookManager } from '../hooks';
import type { McpManager } from '../mcp';
import type { stateSchema } from '../schema';
import { createWebSearchTool, createWebExtractTool, hasTavilyKey, requestSandboxAccessTool } from '../tools';

type MastraCodeState = z.infer<typeof stateSchema>;

/** Minimal shape for tools passed to createDynamicTools. */
type ToolLike = {
  execute?: (...args: any[]) => Promise<unknown> | unknown;
} & Record<string, any>;

function wrapToolWithHooks(toolName: string, tool: ToolLike, hookManager?: HookManager): ToolLike {
  if (!hookManager || typeof tool?.execute !== 'function') {
    return tool;
  }

  return {
    ...tool,
    async execute(input: unknown, toolContext: unknown) {
      const preResult = await hookManager.runPreToolUse(toolName, input);
      if (!preResult.allowed) {
        return {
          error: preResult.blockReason ?? `Blocked by PreToolUse hook for tool "${toolName}"`,
        };
      }

      let output: unknown;
      let toolError = false;
      try {
        output = await tool.execute?.(input, toolContext);
        return output;
      } catch (error) {
        toolError = true;
        output = {
          error: error instanceof Error ? error.message : String(error),
        };
        throw error;
      } finally {
        await hookManager.runPostToolUse(toolName, input, output, toolError).catch(() => undefined);
      }
    },
  };
}

export function createDynamicTools(
  mcpManager?: McpManager,
  extraTools?: Record<string, ToolLike> | ((ctx: { requestContext: RequestContext }) => Record<string, ToolLike>),
  hookManager?: HookManager,
  disabledTools?: string[],
) {
  return function getDynamicTools({ requestContext }: { requestContext: RequestContext }) {
    const ctx = requestContext.get('harness') as HarnessRequestContext<MastraCodeState> | undefined;
    const state = ctx?.getState();

    const modelId = state?.currentModelId;
    const isAnthropicModel = modelId?.startsWith('anthropic/');
    const isOpenAIModel = modelId?.startsWith('openai/');

    // Filesystem, grep, glob, edit, write, execute_command, and process
    // management tools are now provided by the workspace (see workspace.ts).
    // Only tools without a workspace equivalent remain here.
    const tools: Record<string, ToolLike> = {
      request_access: requestSandboxAccessTool,
    };

    if (hasTavilyKey()) {
      tools.web_search = createWebSearchTool();
      tools.web_extract = createWebExtractTool();
    } else if (isAnthropicModel) {
      const anthropic = createAnthropic({});
      tools.web_search = anthropic.tools.webSearch_20250305();
    } else if (isOpenAIModel) {
      const openai = createOpenAI({});
      tools.web_search = openai.tools.webSearch();
    }

    if (mcpManager) {
      const mcpTools = mcpManager.getTools();
      Object.assign(tools, mcpTools);
    }

    if (extraTools) {
      const resolved = typeof extraTools === 'function' ? extraTools({ requestContext }) : extraTools;
      for (const [name, tool] of Object.entries(resolved)) {
        if (!(name in tools)) {
          tools[name] = tool;
        }
      }
    }

    // Remove tools explicitly disabled via config so the model never sees them.
    if (disabledTools?.length) {
      for (const toolName of disabledTools) {
        delete tools[toolName];
      }
    }

    // Remove tools that have a per-tool 'deny' policy so the model never sees them.
    const permissionRules = state?.permissionRules;
    if (permissionRules?.tools) {
      for (const [name, policy] of Object.entries(permissionRules.tools)) {
        if (policy === 'deny') {
          delete tools[name];
        }
      }
    }

    for (const [toolName, tool] of Object.entries(tools)) {
      tools[toolName] = wrapToolWithHooks(toolName, tool, hookManager);
    }

    return tools;
  };
}
