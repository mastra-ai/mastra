import {Mastra} from '@mastra/core/mastra';
import {Observability} from '@mastra/observability';
import {OtelBridge} from '@mastra/otel-bridge';

import {PinoWrapperLogger} from '../logger';
import {createStorage} from '../storage';
import {scienceChatAgent} from '../../apps/demo/agents/test-agent';

export const mastra = new Mastra({
  agents: {scienceChatAgent},
  workflows: {},
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
