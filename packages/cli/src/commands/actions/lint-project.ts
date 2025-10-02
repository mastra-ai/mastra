import { analytics, origin } from '../..';
import { lint } from '../lint';

export const lintProject = async (args: any) => {
  await analytics.trackCommandExecution({
    command: 'lint',
    args,
    execution: async () => {
      await lint({ dir: args.dir, root: args.root, tools: args.tools ? args.tools.split(',') : [] });
    },
    origin,
  });
};
