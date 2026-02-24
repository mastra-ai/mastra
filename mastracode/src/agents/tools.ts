import { createAnthropic } from '@ai-sdk/anthropic';
import type { HarnessRequestContext } from '@mastra/core/harness';
import type { RequestContext } from '@mastra/core/request-context';
import type { McpManager } from '../mcp';
import type { stateSchema } from '../schema';
import {
  createWebSearchTool,
  createWebExtractTool,
  hasTavilyKey,
  requestSandboxAccessTool,
} from '../tools';

export function createDynamicTools(mcpManager?: McpManager) {
  return function getDynamicTools({ requestContext }: { requestContext: RequestContext }) {
    const ctx = requestContext.get('harness') as HarnessRequestContext<typeof stateSchema> | undefined;
    const state = ctx?.getState?.();

    const modelId = state?.currentModelId;
    const isAnthropicModel = modelId?.startsWith('anthropic/');

    // Filesystem, grep, glob, edit, write, execute_command, and process
    // management tools are now provided by the workspace (see workspace.ts).
    // Only tools without a workspace equivalent remain here.
    const tools: Record<string, any> = {
      request_sandbox_access: requestSandboxAccessTool,
    };

    if (hasTavilyKey()) {
      tools.web_search = createWebSearchTool();
      tools.web_extract = createWebExtractTool();
    } else if (isAnthropicModel) {
      const anthropic = createAnthropic({});
      tools.web_search = anthropic.tools.webSearch_20250305();
    }

    if (mcpManager) {
      const mcpTools = mcpManager.getTools();
      Object.assign(tools, mcpTools);
    }

    return tools;
  };
}
