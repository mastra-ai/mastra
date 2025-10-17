import { analytics, origin } from '../..';
import { start } from '../start';

export const startProject = async (args: { dir?: string; telemetry?: boolean; env?: string }) => {
  await analytics.trackCommandExecution({
    command: 'start',
    args,
    execution: async () => {
      await start({
        dir: args.dir,
        telemetry: args.telemetry,
        env: args.env,
      });
    },
    origin,
  });
};
