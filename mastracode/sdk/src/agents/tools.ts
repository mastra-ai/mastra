import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { ToolsInput } from '@mastra/core/agent';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { createNotificationInboxTool, NotificationsStorage } from '@mastra/core/notifications';
import type {
  CreateNotificationInput,
  ListDueNotificationsInput,
  ListNotificationsInput,
  UpdateNotificationInput,
  UpdateNotificationsStatusInput,
} from '@mastra/core/notifications';
import type { RequestContext } from '@mastra/core/request-context';
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { ToolAfterHookContext, ToolHooks } from '@mastra/core/tools';
import { jsonSchema } from 'ai';
import type { HookManager } from '../hooks/index.js';
import type { McpManager } from '../mcp/index.js';
import type { MastraCodeComposedState } from '../schema.js';
import { MC_TOOLS } from '../tool-names.js';
import { createConfiguredWebTools, requestSandboxAccessTool } from '../tools/index.js';
import { createWorkflowTool } from '../tools/workflows/create-workflow.js';
import { deleteWorkflowTool } from '../tools/workflows/delete-workflow.js';
import { getWorkflowTool } from '../tools/workflows/get-workflow.js';
import { listWorkflowsTool } from '../tools/workflows/list-workflows.js';
import { runWorkflowTool } from '../tools/workflows/run-workflow.js';
import { WORKFLOW_MANAGEMENT_TOOL_IDS } from '../tools/workflows/tool-ids.js';
import { prepareProviderWebSearchRoute, resolveProviderWebSearchRoute } from './model.js';
import type { ProviderWebSearchRoute } from './model.js';

/** Minimal shape for tools passed to createDynamicTools. */
export type ToolLike = {
  execute?: (...args: any[]) => Promise<unknown> | unknown;
} & Record<string, any>;

function configurePluginTool(tool: ToolLike, backgroundToolsEnabled: boolean): ToolLike {
  if (backgroundToolsEnabled || !tool.background) return tool;
  return { ...tool, background: { ...tool.background, enabled: false } };
}

export class LazyNotificationsStorage extends NotificationsStorage {
  constructor(private readonly storage: MastraCompositeStore) {
    super();
  }

  private async getNotificationsStorage(): Promise<NotificationsStorage> {
    const notifications = await this.storage.getStore('notifications');
    if (!notifications) {
      throw new Error('notification_inbox requires a notifications storage domain');
    }
    return notifications;
  }

  async createNotification(input: CreateNotificationInput) {
    return (await this.getNotificationsStorage()).createNotification(input);
  }

  async listNotifications(input: ListNotificationsInput) {
    return (await this.getNotificationsStorage()).listNotifications(input);
  }

  async listDueNotifications(input: ListDueNotificationsInput) {
    return (await this.getNotificationsStorage()).listDueNotifications(input);
  }

  async getNotification(input: { threadId: string; id: string }) {
    return (await this.getNotificationsStorage()).getNotification(input);
  }

  async updateNotification(input: UpdateNotificationInput) {
    return (await this.getNotificationsStorage()).updateNotification(input);
  }

  override async updateNotificationsStatus(input: UpdateNotificationsStatusInput) {
    return (await this.getNotificationsStorage()).updateNotificationsStatus(input);
  }

  async dangerouslyClearAll() {
    return (await this.getNotificationsStorage()).dangerouslyClearAll();
  }
}

export type PostToolObserver = (context: ToolAfterHookContext) => void | Promise<void>;

export function createToolHooks(hookManager?: HookManager, postToolObserver?: PostToolObserver): ToolHooks | undefined {
  if (!hookManager && !postToolObserver) return undefined;

  return {
    beforeToolCall: async ({ toolName, input }) => {
      if (!hookManager) return;
      const preResult = await hookManager.runPreToolUse(toolName, input);
      if (!preResult.allowed) {
        return {
          proceed: false as const,
          output: {
            error: preResult.blockReason ?? `Blocked by PreToolUse hook for tool "${toolName}"`,
          },
        };
      }
    },
    afterToolCall: async context => {
      const { toolName, input, output, error } = context;
      if (hookManager) {
        const failed = error !== undefined;
        await hookManager
          .runPostToolUse(
            toolName,
            input,
            failed ? { error: error instanceof Error ? error.message : String(error) } : output,
            failed,
          )
          .catch(() => undefined);
      }
      await Promise.resolve()
        .then(() => postToolObserver?.(context))
        .catch(error => {
          console.warn(`[MastraCode] Post-tool observer failed for ${toolName}.`, error);
        });
    },
  };
}

type DynamicToolProvider =
  | Record<string, ToolLike | undefined>
  | ((ctx: {
      requestContext: RequestContext;
    }) => Record<string, ToolLike | undefined> | Promise<Record<string, ToolLike | undefined>>);

/**
 * The provider-executed search tool for a route. The Mastra gateway's OpenRouter
 * chat endpoint takes `openrouter:web_search` (the OpenRouter provider sends a
 * provider tool `openrouter.web_search` with that type), as Mastra's own
 * templates use against the gateway.
 */
function createProviderWebSearchTool(route: ProviderWebSearchRoute): ToolLike {
  switch (route) {
    case 'anthropic':
      return createAnthropic({}).tools.webSearch_20250305();
    case 'openai':
      return createOpenAI({}).tools.webSearch();
    case 'mastra-gateway':
      return {
        type: 'provider',
        id: 'openrouter.web_search',
        args: {},
        inputSchema: jsonSchema({ type: 'object', properties: {} }),
      } as unknown as ToolLike;
  }
}

export function createDynamicTools(
  mcpManager?: McpManager,
  extraTools?: DynamicToolProvider,
  disabledTools?: string[],
  storage?: MastraCompositeStore,
  pluginTools?: Record<string, ToolLike>,
  backgroundToolsEnabled = false,
  builtinTools?: Record<string, ToolLike>,
) {
  return function getDynamicTools({
    requestContext,
  }: {
    requestContext: RequestContext;
  }): ToolsInput | Promise<ToolsInput> {
    const ctx = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeComposedState> | undefined;
    const state = ctx?.getState();

    // In deployed Factory, the search route reads tenant credentials; prepare them first if needed.
    const preparing = prepareProviderWebSearchRoute(ctx?.session?.modelId, { requestContext });
    if (preparing) return preparing.then(() => getDynamicTools({ requestContext }));
    const webSearchRoute = resolveProviderWebSearchRoute(ctx?.session?.modelId, { requestContext });

    // Filesystem, grep, glob, edit, write, execute_command, and process
    // management tools are now provided by the workspace (see workspace.ts).
    // Only tools without a workspace equivalent remain here.
    const tools: Record<string, ToolLike> = {
      request_access: requestSandboxAccessTool,
      // Workflow surface. `create-workflow` delegates to the workflow-builder
      // sub-agent; the other four are Dynamic Workflow management operations.
      // Permission categories live in permissions.ts (TOOL_CATEGORY_MAP).
      [WORKFLOW_MANAGEMENT_TOOL_IDS.createWorkflow]: createWorkflowTool,
      [WORKFLOW_MANAGEMENT_TOOL_IDS.listWorkflows]: listWorkflowsTool,
      [WORKFLOW_MANAGEMENT_TOOL_IDS.getWorkflow]: getWorkflowTool,
      [WORKFLOW_MANAGEMENT_TOOL_IDS.runWorkflow]: runWorkflowTool,
      [WORKFLOW_MANAGEMENT_TOOL_IDS.deleteWorkflow]: deleteWorkflowTool,
    };

    // Opt-in built-ins (e.g. the experimental schedule tools).
    if (builtinTools) Object.assign(tools, builtinTools);

    if (storage) {
      tools[MC_TOOLS.NOTIFICATION_INBOX] = createNotificationInboxTool({
        storage: new LazyNotificationsStorage(storage),
      });
    }

    // Async only when a Tavily/Parallel key is set; otherwise the tool list stays synchronous.
    const configuredWebTools = createConfiguredWebTools();
    if (!configuredWebTools && webSearchRoute) {
      tools.web_search = createProviderWebSearchTool(webSearchRoute);
    }

    const mcpTools = mcpManager?.getTools();
    if (mcpTools) Object.assign(tools, mcpTools);

    const finish = (resolvedExtra: Record<string, ToolLike | undefined> | undefined) => {
      if (resolvedExtra) {
        for (const [name, tool] of Object.entries(resolvedExtra)) {
          if (tool && !(name in tools)) {
            tools[name] = tool;
          }
        }
      }

      if (pluginTools) {
        for (const [name, tool] of Object.entries(pluginTools)) {
          if (!(name in tools)) {
            tools[name] = configurePluginTool(tool, backgroundToolsEnabled);
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

      return tools as ToolsInput;
    };

    const resolveExtra = (): ToolsInput | Promise<ToolsInput> => {
      if (typeof extraTools === 'function') {
        const resolved = extraTools({ requestContext });
        // Stay synchronous for sync providers; only go async when the provider does.
        if (resolved && typeof (resolved as PromiseLike<unknown>).then === 'function') {
          return Promise.resolve(resolved).then(finish);
        }
        return finish(resolved as Record<string, ToolLike | undefined>);
      }
      return finish(extraTools);
    };

    if (configuredWebTools) {
      return configuredWebTools.then(webTools => {
        // MCP tools keep precedence over the web tools, as when both were assigned in order.
        Object.assign(tools, webTools, mcpTools);
        return resolveExtra();
      });
    }

    return resolveExtra();
  };
}
