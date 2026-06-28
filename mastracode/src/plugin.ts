import type { Tool, ToolAction } from '@mastra/core/tools';

export { createTool } from '@mastra/core/tools';
export type { Tool, ToolAction, ToolExecutionContext } from '@mastra/core/tools';
export { z } from 'zod';

export type MastraCodePluginContext = {
  cwd: string;
  scope: 'global' | 'project';
  pluginDir: string;
};

export type MastraCodePluginTools = Record<string, Tool | ToolAction<any, any, any, any, any, any, any>>;

export type MastraCodePlugin = {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  tools?:
    | MastraCodePluginTools
    | ((context: MastraCodePluginContext) => MastraCodePluginTools | Promise<MastraCodePluginTools>);
};

export function defineMastraCodePlugin<TPlugin extends MastraCodePlugin>(plugin: TPlugin): TPlugin {
  return plugin;
}
