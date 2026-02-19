import { createAnthropic } from '@ai-sdk/anthropic';
import type { RequestContext } from '@mastra/core/request-context';
import type { HarnessRuntimeContext } from '../harness/types';
import type { MCPManager } from '../mcp';
import type { stateSchema } from '../schema';
import {
  createViewTool,
  createGrepTool,
  createGlobTool,
  createExecuteCommandTool,
  createWriteFileTool,
  createWebSearchTool,
  createWebExtractTool,
  hasTavilyKey,
  stringReplaceLspTool,
  astSmartEditTool,
  submitPlanTool,
  todoWriteTool,
  todoCheckTool,
  askUserTool,
  requestSandboxAccessTool,
} from '../tools';
import { getSubagentTools } from './subagents/index.js';

export function createDynamicTools(mcpManager?: MCPManager) {
  return function getDynamicTools({ requestContext }: { requestContext: RequestContext }) {
    const ctx = requestContext.get('harness') as HarnessRuntimeContext<typeof stateSchema> | undefined;
    const state = ctx?.getState?.();
    const modeId = ctx?.modeId ?? 'build';

    const modelId = state?.currentModelId;
    const isAnthropicModel = modelId?.startsWith('anthropic/');

    const projectPath = state?.projectPath ?? '';
    const { tool: subagentTool, toolReadOnly: subagentToolReadOnly } = getSubagentTools(projectPath);

    // Instantiate project-scoped tools
    const viewTool = createViewTool(projectPath);
    const grepTool = createGrepTool(projectPath);
    const globTool = createGlobTool(projectPath);
    const executeCommandTool = createExecuteCommandTool(projectPath);
    const writeFileTool = createWriteFileTool(projectPath);

    // Build tool set based on mode
    // NOTE: Tool names "grep" and "glob" are reserved by Anthropic's OAuth
    // validation (they match Claude Code's internal tools). We use
    // "search_content" and "find_files" to avoid the collision.
    const tools: Record<string, any> = {
      // Read-only tools — always available
      view: viewTool,
      search_content: grepTool,
      find_files: globTool,
      execute_command: executeCommandTool,
      // Subagent delegation — read-only in plan mode
      subagent: modeId === 'plan' ? subagentToolReadOnly : subagentTool,
      // Todo tracking — always available (planning tool, not a write tool)
      todo_write: todoWriteTool,
      todo_check: todoCheckTool,
      // User interaction — always available
      ask_user: askUserTool,
      request_sandbox_access: requestSandboxAccessTool,
    };

    // Write tools — NOT available in plan mode
    if (modeId !== 'plan') {
      tools.string_replace_lsp = stringReplaceLspTool;
      tools.ast_smart_edit = astSmartEditTool;
      tools.write_file = writeFileTool;
    }

    // Plan submission — only available in plan mode
    if (modeId === 'plan') {
      tools.submit_plan = submitPlanTool;
    }
    // Web tools — prefer Tavily when available (avoids Anthropic native
    // web_search provider tool which can cause stream freezes). Fall back
    // to Anthropic's native web search via getToolsets() for Anthropic models.
    // Note: hasTavilyKey() is checked at request time, not module load time,
    // so the key can be set after startup and still be picked up.
    if (hasTavilyKey()) {
      tools.web_search = createWebSearchTool();
      tools.web_extract = createWebExtractTool();
    } else if (isAnthropicModel) {
      const anthropic = createAnthropic({});
      tools.web_search = anthropic.tools.webSearch_20250305();
    }

    // MCP server tools — injected from connected servers
    if (mcpManager) {
      const mcpTools = mcpManager.getTools();
      Object.assign(tools, mcpTools);
    }

    return tools;
  };
}
