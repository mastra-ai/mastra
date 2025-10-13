import { analytics, origin } from '../..';
import { logger } from '../../utils/logger';
import { dev } from '../dev/dev';

export const startDevServer = async (args: any) => {
  analytics.trackCommand({
    command: 'dev',
    origin,
  });

  dev({
    dir: args?.dir,
    root: args?.root,
    tools: args?.tools ? args.tools.split(',') : [],
    env: args?.env,
    inspect: args?.inspect && !args?.inspectBrk,
    inspectBrk: args?.inspectBrk,
    customArgs: args?.customArgs ? args.customArgs.split(',') : [],
    https: args?.https,
  }).catch(err => {
    logger.error(err.message);
  });
};
