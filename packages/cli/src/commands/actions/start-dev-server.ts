import { analytics, origin } from '../..';
import { logger } from '../../utils/logger';
import { dev } from '../dev/dev';

export const startDevServer = async (args: any) => {
  analytics.trackCommand({
    command: 'dev',
    origin,
  });

  if (args?.port) {
    logger.warn('The --port option is deprecated. Use the server key in the Mastra instance instead.');
  }
  dev({
    port: args?.port ? parseInt(args.port) : null,
    dir: args?.dir,
    root: args?.root,
    tools: args?.tools ? args.tools.split(',') : [],
    env: args?.env,
    inspect: args?.inspect && !args?.inspectBrk,
    inspectBrk: args?.inspectBrk,
    customArgs: args?.customArgs ? args.customArgs.split(',') : [],
  }).catch(err => {
    logger.error(err.message);
  });
};
