import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { createNotificationInboxTool, NotificationsStorage } from '@mastra/core/notifications';
import type {
  CreateNotificationInput,
  ListDueNotificationsInput,
  ListNotificationsInput,
  UpdateNotificationInput,
} from '@mastra/core/notifications';
import type { RequestContext } from '@mastra/core/request-context';
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { ToolHooks } from '@mastra/core/tools';
import type { HookManager } from '../hooks';
import type { McpManager } from '../mcp';
import type { MastraCodeComposedState } from '../schema';
import { MC_TOOLS } from '../tool-names.js';
import { createWebSearchTool, createWebExtractTool, hasTavilyKey, requestSandboxAccessTool } from '../tools';

/** Minimal shape for tools passed to createDynamicTools. */
export type ToolLike = {
  execute?: (...args: any[]) => Promise<unknown> | unknown;
} & Record<string, any>;

class LazyNotificationsStorage extends NotificationsStorage {
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

  async dangerouslyClearAll() {
    return (await this.getNotificationsStorage()).dangerouslyClearAll();
  }
}

export function createToolHooks(hookManager?: HookManager): ToolHooks | undefined {
  if (!hookManager) return undefined;

  return {
    beforeToolCall: async ({ toolName, input }) => {
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
    afterToolCall: async ({ toolName, input, output, error }) => {
      await hookManager
        .runPostToolUse(
          toolName,
          input,
          error ? { error: error instanceof Error ? error.message : String(error) } : output,
          Boolean(error),
        )
        .catch(() => undefined);
    },
  };
}

type DynamicToolProvider =
  | Record<string, ToolLike | undefined>
  | ((ctx: { requestContext: RequestContext }) => Record<string, ToolLike | undefined>);

export function createDynamicTools(
  mcpManager?: McpManager,
  extraTools?: DynamicToolProvider,
  disabledTools?: string[],
  storage?: MastraCompositeStore,
  pluginTools?: Record<string, ToolLike>,
) {
  return function getDynamicTools({ requestContext }: { requestContext: RequestContext }) {
    const ctx = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeComposedState> | undefined;
    const state = ctx?.getState();

    const modelId = ctx?.session?.modelId;
    const isAnthropicModel = modelId?.startsWith('anthropic/');
    const isOpenAIModel = modelId?.startsWith('openai/');

    // Filesystem, grep, glob, edit, write, execute_command, and process
    // management tools are now provided by the workspace (see workspace.ts).
    // Only tools without a workspace equivalent remain here.
    const tools: Record<string, ToolLike> = {
      request_access: requestSandboxAccessTool,
    };

    if (storage) {
      tools[MC_TOOLS.NOTIFICATION_INBOX] = createNotificationInboxTool({
        storage: new LazyNotificationsStorage(storage),
      });
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
      const resolved = typeof extraTools === 'function' ? extraTools({ requestContext }) : extraTools;
      for (const [name, tool] of Object.entries(resolved)) {
        if (tool && !(name in tools)) {
          tools[name] = tool;
        }
      }
    }

    if (pluginTools) {
      for (const [name, tool] of Object.entries(pluginTools)) {
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

    return tools;
  };
}
