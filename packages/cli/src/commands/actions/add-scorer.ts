import { analytics } from '../..';
import type { CLI_ORIGIN } from '../../analytics';
import { addNewScorer } from '../scorers/add-new-scorer';

const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN;

export const addScorer = async (scorerName: string | undefined, args: any) => {
  await analytics.trackCommandExecution({
    command: 'scorers-add',
    args: { ...args, scorerName },
    execution: async () => {
      await addNewScorer(scorerName, args.dir);
    },
    origin,
  });
};
