import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { hasMorphApiKey, type Settings } from '../config/settings.js';
import { createInvestigationAgents, createInvestigationPlanningWorkflow } from '../investigation/agents.js';

export function createMastra(settings: Settings, processDue?: () => Promise<void>) {
  const storage = new LibSQLStore({ id: 'security-scanner', url: settings.mastraDatabaseUrl, disableInit: true });
  const investigation = hasMorphApiKey() ? createInvestigationAgents(settings) : null;
  const mastra = new Mastra({
    storage,
    agents: investigation?.agents,
    workflows: {
      ...(investigation?.workflows ?? {}),
      ...(settings.SCANNER_INVESTIGATION_ENABLED && processDue
        ? { localInvestigationPlanning: createInvestigationPlanningWorkflow(processDue) }
        : {}),
    },
    logger: false,
  });
  return { mastra, storage, agents: investigation?.agents ?? null };
}
