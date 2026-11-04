import { Mastra } from '@mastra/core/mastra';

import { bootstrap } from './bootstrap';
import { competitorChangeClassifier } from './classifier';

export const mastra = new Mastra({
  agents: bootstrap.monitorAgent ? { competitorMonitor: bootstrap.monitorAgent } : undefined,
  storage: bootstrap.frameworkStore,
  workflows: { competitorMonitor: bootstrap.workflow },
  classifiers: { competitorChange: competitorChangeClassifier },
  observability: bootstrap.observability,
  server: bootstrap.server,
});
