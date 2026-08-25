import { analytics, origin } from '../..';
import { mcpTypegen as runMcpTypegen } from '../mcp/typegen';

export const mcpTypegen = async (args: {
  dir?: string;
  root?: string;
  env?: string;
  output?: string;
  client?: string;
  debug?: boolean;
}) => {
  await analytics.trackCommandExecution({
    command: 'mastra mcp typegen',
    args: { ...args },
    execution: async () => {
      await runMcpTypegen({
        dir: args?.dir,
        root: args?.root,
        env: args?.env,
        output: args?.output,
        client: args?.client,
        debug: args?.debug ?? false,
      });
    },
    origin,
  });
};
