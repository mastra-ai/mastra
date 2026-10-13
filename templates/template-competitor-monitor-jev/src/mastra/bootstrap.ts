import { SimpleAuth } from '@mastra/core/server';
import { LibSQLStore } from '@mastra/libsql';

import { CHAT_DEFAULTS, loadConfig } from './config';
import { dailyMonitorSchedules, scheduledMonitorInputs } from './config/scheduled-monitors';
import { createCompetitorMonitorAgent } from './monitor-agent';
import { createLocalObservability } from './lib/observability';
import { createReportSummaryAgent } from './lib/reporting';
import { ensureDatabaseDirectory, MonitorStore } from './lib/store';
import { createNotificationProviders } from './notifications';
import { createCompetitorMonitorWorkflow } from './workflows/competitor-monitor-workflow';

/** Initialize one runtime's configuration and local dependencies without making provider calls. */
export function initializeRuntime(environment: Readonly<Record<string, string | undefined>> = process.env) {
  const config = loadConfig(environment);
  ensureDatabaseDirectory(config.storage.mastraUrl);
  const applicationStore = MonitorStore.open(config.storage.monitorUrl);
  const summaryAgent = config.credentials.openaiApiKey
    ? createReportSummaryAgent(config.credentials.openaiApiKey)
    : undefined;
  const workflow = createCompetitorMonitorWorkflow(
    {
      store: applicationStore,
      config,
      summaryAgent,
      notificationProviders: createNotificationProviders(config.storage.reportsDir),
    },
    dailyMonitorSchedules(scheduledMonitorInputs(config.schedule, config.sources.maxSources)),
  );
  const monitorAgent = config.credentials.openaiApiKey
    ? createCompetitorMonitorAgent(workflow, {
        id: CHAT_DEFAULTS.model,
        apiKey: config.credentials.openaiApiKey,
      })
    : undefined;
  const frameworkStore = new LibSQLStore({ id: 'competitor-monitor-framework', url: config.storage.mastraUrl });
  return {
    config,
    applicationStore,
    frameworkStore,
    workflow,
    summaryAgent,
    monitorAgent,
    observability: createLocalObservability(),
    server:
      config.executionMode === 'production'
        ? {
            host: config.server.host,
            auth: new SimpleAuth({ tokens: { [config.server.apiToken!]: { id: 'operator' } } }),
          }
        : { host: config.server.host },
  };
}

export const bootstrap = initializeRuntime();
