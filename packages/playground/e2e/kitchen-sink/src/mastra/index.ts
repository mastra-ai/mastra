import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { computeNextFireAt } from '@mastra/core/workflows';
import { MastraEditor } from '@mastra/editor';
import { PinoLogger } from '@mastra/loggers';

import { weatherAgent, omAgent, omAdaptiveAgent } from './agents';
import { simpleMcpServer } from './mcps';
import { loggingProcessor, contentFilterProcessor } from './processors';
import { responseQualityScorer, responseTimeScorer } from './scorers';
import { storage } from './storage';
import { complexWorkflow, lessComplexWorkflow } from './workflows/complex-workflow';
import { scheduledWorkflow, multiScheduledWorkflow } from './workflows/scheduled-workflow';

export const mastra = new Mastra({
  workflows: { complexWorkflow, lessComplexWorkflow, scheduledWorkflow, multiScheduledWorkflow },
  agents: { weatherAgent, omAgent, omAdaptiveAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'error',
  }),
  storage,
  editor: new MastraEditor(),
  mcpServers: {
    simpleMcpServer,
  },
  scorers: {
    responseQualityScorer,
    responseTimeScorer,
  },
  processors: {
    loggingProcessor,
    contentFilterProcessor,
  },
  server: {
    apiRoutes: [
      registerApiRoute('/e2e/reset-storage', {
        method: 'POST',
        handler: async c => {
          const clearTasks: Promise<void>[] = [];

          const workflowStore = await storage.getStore('workflows');
          if (workflowStore) {
            clearTasks.push(workflowStore.dangerouslyClearAll());
          }

          const memoryStore = await storage.getStore('memory');
          if (memoryStore) {
            clearTasks.push(memoryStore.dangerouslyClearAll());
          }

          const scoresStore = await storage.getStore('scores');
          if (scoresStore) {
            clearTasks.push(scoresStore.dangerouslyClearAll());
          }

          const observabilityStore = await storage.getStore('observability');
          if (observabilityStore) {
            clearTasks.push(observabilityStore.dangerouslyClearAll());
          }

          const agentsStore = await storage.getStore('agents');
          if (agentsStore) {
            clearTasks.push(agentsStore.dangerouslyClearAll());
          }

          const scorerDefinitionsStore = await storage.getStore('scorerDefinitions');
          if (scorerDefinitionsStore) {
            clearTasks.push(scorerDefinitionsStore.dangerouslyClearAll());
          }

          const datasetsStore = await storage.getStore('datasets');
          if (datasetsStore) {
            clearTasks.push(datasetsStore.dangerouslyClearAll());
          }

          const mcpClientsStore = await storage.getStore('mcpClients');
          if (mcpClientsStore) {
            clearTasks.push(mcpClientsStore.dangerouslyClearAll());
          }

          // Reset schedule pause state + drop trigger history between tests.
          // Schedules are declarative config registered at boot, so we
          // snapshot the current rows, clear, then re-create them with a
          // fresh `nextFireAt` (computed from each schedule's own cron +
          // timezone, exactly as boot registration would) and
          // `status: 'active'`. Hardcoding `now + 60_000` here would make
          // the reset handler fire schedules at cadences they never
          // declare, which can leak surprise runs into unrelated tests.
          const schedulesStore = await storage.getStore('schedules');
          if (schedulesStore) {
            const existingSchedules = await schedulesStore.listSchedules();
            clearTasks.push(
              (async () => {
                await schedulesStore.dangerouslyClearAll();
                const now = Date.now();
                for (const schedule of existingSchedules) {
                  let nextFireAt: number;
                  try {
                    nextFireAt = computeNextFireAt(schedule.cron, {
                      timezone: schedule.timezone,
                      after: now,
                    });
                  } catch {
                    // Fall back to the previously-recorded fire time so a
                    // malformed cron does not break the reset handler.
                    nextFireAt = schedule.nextFireAt;
                  }
                  await schedulesStore.createSchedule({
                    ...schedule,
                    status: 'active',
                    nextFireAt,
                    lastFireAt: null,
                    lastRunId: null,
                    createdAt: now,
                    updatedAt: now,
                  });
                }
              })(),
            );
          }

          await Promise.all(clearTasks);

          return c.json({ message: 'Custom route' }, 201);
        },
      }),
    ],
  },
});
