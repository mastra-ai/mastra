import { analytics } from '../..';
import type { CLI_ORIGIN } from '../../analytics';
import { create } from '../create/create';

const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN;

export const createProject = async (projectNameArg: any, args: any) => {
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
        components: args.components ? args.components.split(',') : [],
        llmProvider: args.llm,
        addExample: args.example,
        llmApiKey: args['llm-api-key'],
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
