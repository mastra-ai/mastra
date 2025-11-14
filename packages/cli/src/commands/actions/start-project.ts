import { analytics, origin } from '../..';
import { start } from '../start';

export const startProject = async (args: { dir?: string; env?: string }) => {
  await analytics.trackCommandExecution({
    command: 'start',
    args,
    execution: async () => {
      await start({
        dir: args.dir,
        env: args.env,
      });
    },
    origin,
  });
};
