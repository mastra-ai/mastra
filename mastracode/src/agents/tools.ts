import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { HarnessRequestContext } from '@mastra/core/harness';
import type { RequestContext } from '@mastra/core/request-context';
import type { McpManager } from '../mcp';
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
  createStringReplaceLspTool,
  createAstSmartEditTool,
  requestSandboxAccessTool,
} from '../tools';

export function createDynamicTools(mcpManager?: McpManager, extraTools?: Record<string, any>) {
  return function getDynamicTools({ requestContext }: { requestContext: RequestContext }) {
    const ctx = requestContext.get('harness') as HarnessRequestContext<typeof stateSchema> | undefined;
    const state = ctx?.getState?.();
    const modeId = ctx?.modeId ?? 'build';

    const modelId = state?.currentModelId;
    const isAnthropicModel = modelId?.startsWith('anthropic/');
    const isOpenAIModel = modelId?.startsWith('openai/');

    const projectPath = state?.projectPath ?? '';

    const viewTool = createViewTool(projectPath);
    const grepTool = createGrepTool(projectPath);
    const globTool = createGlobTool(projectPath);
    const executeCommandTool = createExecuteCommandTool(projectPath);
    const writeFileTool = createWriteFileTool(projectPath);
    const stringReplaceLspTool = createStringReplaceLspTool(projectPath);
    const astSmartEditTool = createAstSmartEditTool(projectPath);

    // NOTE: Tool names "grep" and "glob" are reserved by Anthropic's OAuth
    // validation (they match Claude Code's internal tools). We use
    // "search_content" and "find_files" to avoid the collision.
    const tools: Record<string, any> = {
      view: viewTool,
      search_content: grepTool,
      find_files: globTool,
      execute_command: executeCommandTool,
      request_sandbox_access: requestSandboxAccessTool,
    };

    if (modeId !== 'plan') {
      tools.string_replace_lsp = stringReplaceLspTool;
      tools.ast_smart_edit = astSmartEditTool;
      tools.write_file = writeFileTool;
    }

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
      for (const [name, tool] of Object.entries(extraTools)) {
        if (!(name in tools)) {
          tools[name] = tool;
        }
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

    return tools;
  };
}
