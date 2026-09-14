import type { AgentController, Session } from '@mastra/core/agent-controller';
import type { InputProcessor, OutputProcessor } from '@mastra/core/processors';
import type { SignalProvider } from '@mastra/core/signals';
import type { Tool, ToolAction, ToolExecutionContext } from '@mastra/core/tools';

import type { MastraCodeState } from './schema.js';

export { createTool } from '@mastra/core/tools';
export { RequestContext } from '@mastra/core/di';
export type { InputProcessor, OutputProcessor } from '@mastra/core/processors';
export { SignalProvider } from '@mastra/core/signals';
export type { SignalProviderTarget, SignalSubscription } from '@mastra/core/signals';
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

/** The running Mastra Code controller, as seen by a plugin. */
export type MastraCodePluginController = AgentController<MastraCodeState>;

/** The session a plugin's contributions are running alongside. */
export type MastraCodePluginSession = Session<MastraCodeState>;

/**
 * Lazy accessors for Mastra Code's runtime, handed to every plugin field resolver.
 *
 * Plugins are loaded before the controller and the session exist, so these are
 * accessors rather than instances: call them at the moment you need the value,
 * never during plugin load. Both return `undefined` until Mastra Code has
 * constructed the corresponding object.
 *
 * @experimental This is an evolving runtime API. It currently exposes the whole
 * controller so real plugins can be built against it; once we know what plugin
 * authors actually reach for, it may narrow to a smaller facade in a future
 * release.
 */
export type MastraCodePluginRuntime = {
  /**
   * The running controller, or `undefined` when it does not exist yet.
   * @experimental see {@link MastraCodePluginRuntime}
   */
  getController?: () => MastraCodePluginController | undefined;
  /**
   * The active session, or `undefined` before one has been created.
   * @experimental see {@link MastraCodePluginRuntime}
   */
  getActiveSession?: () => MastraCodePluginSession | undefined;
};

export type MastraCodePluginContext = MastraCodePluginRuntime & {
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

/**
 * Processors a plugin contributes, split by lane.
 *
 * A bare array is shorthand for `{ input: [...] }`, since input processors are
 * the common case. Plugin processors run last in Mastra Code's own configured
 * processors — after the layers they customize, before the channel and memory
 * layers the agent appends. That slot is fixed and not configurable.
 */
export type MastraCodePluginProcessorEntries =
  | InputProcessor[]
  | {
      input?: InputProcessor[];
      output?: OutputProcessor[];
    };

/**
 * Signal providers a plugin contributes.
 *
 * Mastra Code owns their lifecycle: it registers Mastra on them, connects them
 * to the coding agent, starts them polling, and stops them when the plugin is
 * updated, disabled or removed. Their `getInputProcessors()` /
 * `getOutputProcessors()` feed the same lanes as {@link MastraCodePluginProcessorEntries}.
 *
 * Note that `getTools()` is **ignored** for plugin-provided providers — inject
 * tools from inside a processor instead.
 */
export type MastraCodePluginSignalProviderEntries = SignalProvider<string>[];

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
  processors?:
    | MastraCodePluginProcessorEntries
    | ((
        context: MastraCodePluginContext,
      ) => MastraCodePluginProcessorEntries | Promise<MastraCodePluginProcessorEntries>);
  signalProviders?:
    | MastraCodePluginSignalProviderEntries
    | ((
        context: MastraCodePluginContext,
      ) => MastraCodePluginSignalProviderEntries | Promise<MastraCodePluginSignalProviderEntries>);
};

export function defineMastraCodePlugin<TPlugin extends MastraCodePlugin>(plugin: TPlugin): TPlugin {
  return plugin;
}
