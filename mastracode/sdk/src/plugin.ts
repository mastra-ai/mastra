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

export type MastraCodePluginConfigOption = {
  type: 'model' | 'boolean' | 'string';
  label?: string;
  description?: string;
  default?: string | boolean;
};

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
  tools?:
    | MastraCodePluginToolEntries
    | ((context: MastraCodePluginContext) => MastraCodePluginToolEntries | Promise<MastraCodePluginToolEntries>);
};

export function defineMastraCodePlugin<TPlugin extends MastraCodePlugin>(plugin: TPlugin): TPlugin {
  return plugin;
}
