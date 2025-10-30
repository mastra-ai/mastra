import { analytics } from '../..';
import type { CLI_ORIGIN } from '../../analytics';
import { create } from '../create/create';
import type { Editor } from '../init/mcp-docs-server-install';
import type { Component, LLMProvider } from '../init/utils';

const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN;

interface CreateProjectArgs {
  default?: boolean;
  components?: Component[];
  llm?: LLMProvider;
  llmApiKey?: string;
  example?: boolean;
  timeout?: string | boolean;
  dir?: string;
  projectName?: string;
  mcp?: Editor;
  template?: string | boolean;
}

export const createProject = async (projectNameArg: string | undefined, args: CreateProjectArgs) => {
  const projectName = projectNameArg || args.projectName;
  await analytics.trackCommandExecution({
    command: 'create',
    args: { ...args, projectName },
    execution: async () => {
      const timeout = args?.timeout ? (args?.timeout === true ? 60000 : parseInt(args?.timeout, 10)) : undefined;
      if (args.default) {
        await create({
          components: ['agents', 'tools', 'workflows'],
          llmProvider: 'openai',
          addExample: true,
          timeout,
          mcpServer: args.mcp,
          template: args.template,
        });
        return;
      }
      await create({
        components: args.components ? args.components : [],
        llmProvider: args.llm,
        addExample: args.example,
        llmApiKey: args.llmApiKey,
        timeout,
        projectName,
        directory: args.dir,
        mcpServer: args.mcp,
        template: args.template,
      });
    },
    origin,
  });
};
