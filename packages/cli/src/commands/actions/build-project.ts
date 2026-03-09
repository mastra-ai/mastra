import { analytics, origin } from '../..';
import { build } from '../build/build';

export const buildProject = async (args: {
  dir?: string;
  root?: string;
  tools?: string;
  studio?: boolean;
  debug: boolean;
}) => {
  await analytics.trackCommandExecution({
    command: 'mastra build',
    args,
    execution: async () => {
      await build({
        dir: args?.dir,
        root: args?.root,
        tools: args?.tools ? args.tools.split(',') : [],
        studio: args?.studio,
        debug: args.debug,
      });
    },
    origin,
  });
};
