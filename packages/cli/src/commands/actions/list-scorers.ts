import { analytics } from '../..';
import type { CLI_ORIGIN } from '../../analytics';
import { listAllScorers } from '../scorers/list-all-scorers';

const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN;

export const listScorers = async (args: any) => {
  await analytics.trackCommandExecution({
    command: 'scorers-list',
    args,
    execution: async () => {
      await listAllScorers();
    },
    origin,
  });
};
