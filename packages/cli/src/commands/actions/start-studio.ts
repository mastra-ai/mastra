import { analytics, origin } from '../..';
import { studio } from '../studio';

interface StudioArgs {
  port?: string | number;
  env?: string;
  serverHost?: string;
  serverPort?: string | number;
  serverProtocol?: string;
  serverApiPrefix?: string;
  requestContextPresets?: string;
}

export const startStudio = async (args: StudioArgs) => {
  analytics.trackCommand({
    command: 'studio',
    origin,
  });

  await studio(args);
};
