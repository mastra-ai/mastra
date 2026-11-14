import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { hasMorphApiKey, type Settings } from '../config/settings.js';
import { createInvestigationAgents } from './agents/investigation-agents.js';
import { createInvestigationPlanningWorkflow, createAdvisorySyncWorkflow } from './workflows/schedules.js';

/** Assemble the scanner's Mastra agents, tools, workflows and storage from validated services. */
export function createMastra(
  settings: Settings,
  processDue?: () => Promise<void>,
  processAdvisoryDue?: () => Promise<void>,
) {
  const storage = new LibSQLStore({ id: 'security-scanner', url: settings.mastraDatabaseUrl, disableInit: true });
  const agents = hasMorphApiKey() ? createInvestigationAgents(settings) : null;
  const mastra = new Mastra({
    storage,
    agents: agents ?? undefined,
    workflows: {
      ...(settings.SCANNER_INVESTIGATION_ENABLED && processDue
        ? { localInvestigationPlanning: createInvestigationPlanningWorkflow(processDue) }
        : {}),
      ...(settings.SCANNER_ADVISORY_SYNC_ENABLED && processAdvisoryDue
        ? { localAdvisorySync: createAdvisorySyncWorkflow(settings, processAdvisoryDue) }
        : {}),
    },
    logger: false,
  });
  return { mastra, storage, agents };
}
