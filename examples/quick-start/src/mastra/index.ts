import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { DefaultConsoleExporter } from '@mastra/core/telemetry_vnext';
import { catOne } from './agents/agent';
import { logCatWorkflow as legacy_catWorkflow } from './legacy-workflows';
import { logCatWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: { catOne },
  legacy_workflows: {
    legacy_catWorkflow,
  },
  workflows: {
    logCatWorkflow,
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'debug',
  }),
  telemetryVNext: {
    enabled: true,
    serviceName: 'quickstart-example',
    exporters: [new DefaultConsoleExporter()],
  },
});
