import { analytics, origin } from '../..';
import { migrate as runMigrate } from '../migrate/migrate';

export const migrate = async (args: { dir?: string; root?: string; env?: string; debug?: boolean }) => {
  await analytics.trackCommandExecution({
    command: 'mastra migrate',
    args: { ...args },
    execution: async () => {
      await runMigrate({
        dir: args?.dir,
        root: args?.root,
        env: args?.env,
        debug: args?.debug ?? false,
      });
    },
    origin,
  });
};
