import { analytics, origin } from '../..';
import { start } from '../start';

export const startProject = async (args: any) => {
  await analytics.trackCommandExecution({
    command: 'start',
    args,
    execution: async () => {
      await start({
        dir: args.dir,
        telemetry: !args.noTelemetry,
        env: args.env,
      });
    },
    origin,
  });
};
