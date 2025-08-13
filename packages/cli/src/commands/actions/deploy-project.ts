import { config } from 'dotenv';
import { analytics, origin } from '../..';
import { logger } from '../../utils/logger';
import { deploy } from '../deploy';

export const deployProject = async (args: any) => {
  config({ path: ['.env', '.env.production'] });
  await analytics.trackCommandExecution({
    command: 'mastra deploy',
    args,
    execution: async () => {
      logger.warn(`DEPRECATED: The deploy command is deprecated.
          Please use the mastra build command instead.
          Then deploy .mastra/output to your target platform.
          `);
      await deploy({ dir: args.dir });
    },
    origin,
  });
};
