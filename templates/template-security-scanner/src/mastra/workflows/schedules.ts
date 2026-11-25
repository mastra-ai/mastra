import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import type { Settings } from '../../config/settings.js';

export function createInvestigationPlanningWorkflow(processDue: () => Promise<void>) {
  const empty = z.object({}).strict();
  const step = createStep({
    id: 'process-due-local-investigations',
    inputSchema: empty,
    outputSchema: empty,
    execute: async () => {
      await processDue();
      return {};
    },
  });
  return createWorkflow({
    id: 'local-investigation-planning',
    inputSchema: empty,
    outputSchema: empty,
    schedule: { id: 'local-planning-wake', cron: '* * * * *', timezone: 'UTC', inputData: {} },
  })
    .then(step)
    .commit();
}

export function createAdvisorySyncWorkflow(settings: Settings, processDue: () => Promise<void>) {
  const empty = z.object({}).strict();
  const step = createStep({
    id: 'process-due-advisory-sync',
    inputSchema: empty,
    outputSchema: empty,
    execute: async () => {
      await processDue();
      return {};
    },
  });
  return createWorkflow({
    id: 'local-advisory-sync',
    inputSchema: empty,
    outputSchema: empty,
    schedule: {
      id: 'local-advisory-sync-wake',
      cron: settings.SCANNER_ADVISORY_SYNC_CRON!,
      timezone: settings.SCANNER_ADVISORY_SYNC_TIMEZONE!,
      inputData: {},
    },
  })
    .then(step)
    .commit();
}
