import type { Tool, ToolAction, ToolExecutionContext } from '@mastra/core/tools';

export { createTool } from '@mastra/core/tools';
export type { Tool, ToolAction, ToolExecutionContext } from '@mastra/core/tools';
export { z } from 'zod';

export type MastraCodeToolRenderConfig = {
  type: 'subagent';
  agentType?: string;
  modelId?: string;
  forked?: boolean;
  label?: string;
  maxActivityLines?: number;
  collapsedLines?: number;
  colors?: {
    border?: string;
    label?: string;
    agentType?: string;
    icon?: string;
  };
  icons?: {
    running?: string;
    success?: string;
    error?: string;
  };
};

export type MastraCodeSubagentProgress =
  | {
      event: 'text';
      text: string;
    }
  | {
      event: 'tool_start';
      toolName: string;
      args?: unknown;
    }
  | {
      event: 'tool_end';
      toolName: string;
      result?: unknown;
      isError?: boolean;
    }
  | {
      event: 'finish';
      isError?: boolean;
      durationMs?: number;
      result?: string;
    };

export type MastraCodeToolProgress = string | { status?: string; detail?: string } | MastraCodeSubagentProgress;

export async function writeToolProgress(
  context: Pick<ToolExecutionContext, 'writer' | 'agent'> | undefined,
  progress: MastraCodeToolProgress,
): Promise<void> {
  const toolCallId = context?.agent?.toolCallId;
  if (!toolCallId) return;

  const chunk = {
    type: 'data-mastracode-tool-progress',
    data: {
      toolCallId,
      progress,
    },
    transient: true,
  } as const;

  const outputWriter = (context.agent as { outputWriter?: (chunk: unknown) => Promise<void> } | undefined)
    ?.outputWriter;
  if (outputWriter) {
    await outputWriter(chunk);
    return;
  }

  await context.writer?.custom(chunk);
}

export type MastraCodePluginConfigValue = string | boolean | undefined;

/**
 * Request-context key under which the host exposes plugin init state at tool
 * execution time: `requestContext.get(PLUGIN_STATE_KEY)` → `{ [pluginId]: initState }`.
 */
export const PLUGIN_STATE_KEY = 'mastracode_plugins';

export type MastraCodePluginInitContext = {
  config: Readonly<Record<string, MastraCodePluginConfigValue>>;
};

export type MastraCodePluginCallbackContext = {
  config: Readonly<Record<string, MastraCodePluginConfigValue>>;
};

export type MastraCodePluginEnabledContext = {
  config: Readonly<Record<string, MastraCodePluginConfigValue>>;
};

export type MastraCodePluginCallbackResult = {
  message?: string;
  config?: Record<string, MastraCodePluginConfigValue>;
};

export type MastraCodePluginValueConfigOption = {
  type: 'model' | 'boolean' | 'string';
  label?: string;
  description?: string;
  default?: string | boolean;
  isEnabled?: (context: MastraCodePluginEnabledContext) => boolean;
};

export type MastraCodePluginCallbackConfigOption = {
  type: 'callback';
  label?: string;
  description?: string;
  isEnabled?: (context: MastraCodePluginEnabledContext) => boolean;
  run: (context: MastraCodePluginCallbackContext) => Promise<MastraCodePluginCallbackResult | void>;
};

export type MastraCodePluginConfigOption = MastraCodePluginValueConfigOption | MastraCodePluginCallbackConfigOption;

export type MastraCodePluginConfigSchema = Record<string, MastraCodePluginConfigOption>;
export type MastraCodePluginConfigValues = Record<string, MastraCodePluginConfigValue>;

export type MastraCodePluginContext = {
  cwd: string;
  scope: 'global' | 'project';
  pluginDir: string;
  config: MastraCodePluginConfigValues;
};

export type MastraCodePluginTool = Tool | ToolAction<any, any, any, any, any, any, any>;

export type MastraCodePluginToolEntry = {
  tool: MastraCodePluginTool;
  render?: MastraCodeToolRenderConfig;
  isEnabled?: (context: MastraCodePluginEnabledContext) => boolean;
};

export type MastraCodePluginTools = Record<string, MastraCodePluginTool>;
export type MastraCodePluginToolEntries = Record<string, MastraCodePluginToolEntry>;
export type MastraCodePluginInstructions = string | ((context: MastraCodePluginContext) => string | Promise<string>);

export type MastraCodePlugin = {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  config?: MastraCodePluginConfigSchema;
  instructions?: MastraCodePluginInstructions;
  /**
   * Runs once per plugin load (and re-runs on every reload, e.g. after a config
   * change). The returned value is plugin-controlled state (e.g. stateful client
   * instances), kept in memory on the loaded plugin and exposed to tool executes
   * via `requestContext.get(PLUGIN_STATE_KEY)[pluginId]`. A throw fails the
   * plugin load.
   */
  init?: (context: MastraCodePluginInitContext) => Promise<unknown> | unknown;
  tools?:
    | MastraCodePluginToolEntries
    | ((context: MastraCodePluginContext) => MastraCodePluginToolEntries | Promise<MastraCodePluginToolEntries>);
};

export function defineMastraCodePlugin<TPlugin extends MastraCodePlugin>(plugin: TPlugin): TPlugin {
  return plugin;
}
