import {Mastra} from '@mastra/core/mastra';
import {Observability} from '@mastra/observability';
import {OtelBridge} from '@mastra/otel-bridge';

import {PinoWrapperLogger} from '../logger';
import {consolidateApps} from './utils';
import {apps} from '../../apps';
import {createStorage} from '../storage';

const consolidated = consolidateApps(apps);

export const mastra = new Mastra({
  workflows: consolidated.workflows,
  agents: consolidated.agents,
  storage: createStorage('default_mastra_storage'),
  logger: new PinoWrapperLogger({
    name: 'Mastra',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'genstudio-agent-hub',
        bridge: new OtelBridge(),
      },
    },
  }),
});
