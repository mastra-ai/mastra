import { RequestContext } from '@mastra/core/request-context';
import type { IntakeConfig } from './config/intake';
import type { IntakeStore, RunRecord } from './persistence/intake';
import type { Telemetry } from './telemetry';
import type { IntakeWorkflow } from './workflows/intake';

/** Single-process, bounded dispatcher. The persistent association owns recovery. */
export function createDispatcher(
  store: IntakeStore,
  intake: IntakeWorkflow,
  config: IntakeConfig,
  telemetry: Telemetry,
) {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let polling: Promise<void> | undefined;
  const active = new Map<string, Promise<void>>();

  async function dispatch(record: RunRecord) {
    try {
      await store.markDispatching(record.runId);
      const snapshot = await intake.workflow.getWorkflowRunById(record.runId);
      if (snapshot?.status === 'success') {
        await store.complete(record.runId);
        return;
      }
      if (snapshot?.status === 'failed' || snapshot?.status === 'canceled') {
        await store.fail(record.runId, 'workflow_failed');
        return;
      }
      const requestContext = intake.bind(new RequestContext());
      const tracingOptions = { metadata: { runId: record.runId } };
      const run = await intake.workflow.createRun({ runId: record.runId, resourceId: 'lead-qualification' });
      const result =
        snapshot?.status === 'running'
          ? await run.restart({ requestContext, tracingOptions })
          : await run.start({ inputData: { runId: record.runId }, requestContext, tracingOptions });
      if (result.status === 'success') {
        await store.complete(record.runId);
        await telemetry.diagnostic({ code: 'intake.dispatched', runId: record.runId });
      } else if (result.status === 'failed') {
        await store.fail(record.runId, 'workflow_failed');
      }
    } catch {
      // Persistence may be temporarily unavailable. Leave the durable association pending.
      await telemetry.diagnostic({ code: 'intake.retry', runId: record.runId });
    }
  }

  async function tick() {
    if (stopped) return;
    try {
      const pending = await store.pending(config.limits.activeRuns);
      for (const record of pending) {
        if (stopped || active.has(record.runId) || active.size >= config.limits.activeRuns) continue;
        const job = dispatch(record).finally(() => active.delete(record.runId));
        active.set(record.runId, job);
      }
    } catch {
      await telemetry.diagnostic({ code: 'intake.retry' });
    }
  }
  function poll() {
    if (!polling)
      polling = tick().finally(() => {
        polling = undefined;
      });
  }
  function start() {
    if (timer || stopped) return;
    poll();
    timer = setInterval(poll, config.limits.dispatchIntervalMs);
    timer.unref();
  }
  async function stop() {
    stopped = true;
    clearInterval(timer);
    await polling;
    await Promise.all(active.values());
  }
  return { start, stop };
}
