import { createStep } from '@mastra/core/workflows';

import type { MonitorInput } from '../../schemas';
import { workflowOutputSchema, type MonitorRunResult, type StepContext } from './workflow-context';

/** Final step: drain durable scheduled deliveries, then persist the result and release the monitor lock. */
export function createNotifyStep(context: StepContext) {
  const { dependencies } = context;
  return createStep({
    id: 'notify-competitor-changes',
    description: 'Invokes enabled notification providers for pending decisions during scheduled runs.',
    inputSchema: workflowOutputSchema,
    outputSchema: workflowOutputSchema,
    execute: async ({ inputData, getInitData }) => {
      const input = getInitData<MonitorInput>();
      const failures: string[] = [];

      if (input.runMode === 'scheduled') {
        for (const provider of dependencies.notificationProviders ?? []) {
          const events = await dependencies.store.pendingNotifications(input.monitorId, provider.id);
          for (const event of events) {
            try {
              await provider.notify(event);
              await dependencies.store.acknowledgeNotification(event.eventId, provider.id);
            } catch {
              if (!failures.includes(provider.id)) failures.push(provider.id);
            }
          }
        }
      }

      const result: MonitorRunResult = failures.length
        ? { ...inputData, status: inputData.status === 'failed' ? 'failed' : 'partial', notificationFailures: failures }
        : inputData;

      await dependencies.store.finishRun(
        { id: result.runId, monitorId: result.monitorId, status: 'running', startedAt: '' },
        result.status === 'no_change' ? 'success' : result.status,
        result,
      );
      return result;
    },
  });
}
