import { createStep } from '@mastra/core/workflows';

import { TIMING } from '../../config';
import type { ChangeNotification, NotificationProvider } from '../../notifications';
import type { MonitorInput } from '../../schemas';
import { workflowOutputSchema, type MonitorRunResult, type StepContext } from './workflow-context';

async function notifyWithDeadline(provider: NotificationProvider, event: ChangeNotification, abortSignal: AbortSignal) {
  const deadline = new AbortController();
  const signal = AbortSignal.any([abortSignal, deadline.signal]);
  const timer = setTimeout(() => deadline.abort(new Error('NOTIFICATION_TIMEOUT')), TIMING.notificationCallMs);
  let onAbort: (() => void) | undefined;
  try {
    signal.throwIfAborted();
    await Promise.race([
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return provider.notify(event, { abortSignal: signal });
      }),
      new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
    signal.throwIfAborted();
  } finally {
    clearTimeout(timer);
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}

/** Final step: drain durable scheduled deliveries, then persist the result and release the monitor lock. */
export function createNotifyStep(context: StepContext) {
  const { dependencies } = context;
  return createStep({
    id: 'notify-competitor-changes',
    description: 'Invokes enabled notification providers for pending decisions during scheduled runs.',
    inputSchema: workflowOutputSchema,
    outputSchema: workflowOutputSchema,
    execute: async ({ inputData, getInitData, abortSignal }) => {
      const input = getInitData<MonitorInput>();
      const failures: string[] = [];

      if (input.runMode === 'scheduled') {
        for (const provider of dependencies.notificationProviders ?? []) {
          if (abortSignal.aborted) {
            failures.push(provider.id);
            break;
          }
          const events = await dependencies.store.pendingNotifications(input.monitorId, provider.id);
          for (const event of events) {
            try {
              await notifyWithDeadline(provider, event, abortSignal);
              await dependencies.store.acknowledgeNotification(event.eventId, provider.id);
            } catch {
              if (!failures.includes(provider.id)) failures.push(provider.id);
              if (abortSignal.aborted) break;
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
