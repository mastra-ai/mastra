import { MastraStorageLibSql, createLogger, Mastra, OTLPStorageExporter } from '@mastra/core';

import { catOne, agentTwo } from './agents/agent';
import { logCatWorkflow } from './workflow/index';

const logger = createLogger({
  level: 'debug',
});

const storage = new MastraStorageLibSql({
  config: {
    url: 'http://127.0.0.1:8080',
  },
});

storage.init();

export const mastra = new Mastra({
  agents: { catOne, agentTwo },
  workflows: { logCatWorkflow },
  logger,
  storage,
  telemetry: {
    export: {
      type: 'custom',
      exporter: new OTLPStorageExporter({
        logger,
        storage,
      }),
    },
  },
});
