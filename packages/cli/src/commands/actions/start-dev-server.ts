import { analytics, origin } from '../..';
import { logger } from '../../utils/logger';
import { dev } from '../dev/dev';

interface DevArgs {
  dir?: string;
  root?: string;
  tools?: string;
  env?: string;
  inspect?: boolean;
  inspectBrk?: boolean;
  customArgs?: string;
  https?: boolean;
  debug: boolean;
}

export const startDevServer = async (args: DevArgs) => {
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
    debug: args.debug,
  }).catch(err => {
    logger.error(err.message);
  });
};
