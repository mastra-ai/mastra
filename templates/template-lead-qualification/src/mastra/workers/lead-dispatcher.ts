import { RequestContext } from '@mastra/core/request-context';
import { MastraWorker } from '@mastra/core/worker';
import type { IntakeConfig } from '../config/lead-ingestion';
import type { LeadEventStore, RunRecord } from '../persistence/lead-event-store';
import type { Telemetry } from '../telemetry';
import type { ReceiveLeadWorkflow } from '../workflows/receive-lead';

/** Starts with the native server and drains before Mastra closes storage. */
export class LeadDispatcher extends MastraWorker {
  readonly name = 'lead-dispatcher';
  private timer?: ReturnType<typeof setInterval>;
  private polling?: Promise<void>;
  private readonly active = new Map<string, Promise<void>>();

  constructor(
    private readonly store: LeadEventStore,
    private readonly intake: ReceiveLeadWorkflow,
    private readonly config: IntakeConfig,
    private readonly telemetry: Telemetry,
  ) {
    super();
  }

  get isRunning() {
    return this.timer !== undefined;
  }

  async start() {
    if (this.isRunning) return;
    this.timer = setInterval(() => this.poll(), this.config.limits.dispatchIntervalMs);
    this.timer.unref();
    this.poll();
  }

  async stop() {
    clearInterval(this.timer);
    this.timer = undefined;
    await this.polling;
    await Promise.all(this.active.values());
  }

  private poll() {
    this.polling ??= this.tick().finally(() => {
      this.polling = undefined;
    });
  }

  private async tick() {
    try {
      const pending = await this.store.pending(this.config.limits.activeRuns);
      for (const record of pending) {
        if (!this.isRunning || this.active.has(record.runId) || this.active.size >= this.config.limits.activeRuns)
          continue;
        const job = this.dispatch(record).finally(() => this.active.delete(record.runId));
        this.active.set(record.runId, job);
      }
    } catch {
      await this.telemetry.diagnostic({ code: 'intake.retry' });
    }
  }

  private async dispatch(record: RunRecord) {
    try {
      await this.store.markDispatching(record.runId);
      const snapshot = await this.intake.workflow.getWorkflowRunById(record.runId);
      if (snapshot?.status === 'success') {
        await this.store.complete(record.runId);
        return;
      }
      if (snapshot?.status === 'failed' || snapshot?.status === 'canceled') {
        await this.store.fail(record.runId, 'workflow_failed');
        return;
      }
      const requestContext = this.intake.authorizeDispatchContext(new RequestContext());
      const tracingOptions = { metadata: { runId: record.runId } };
      const run = await this.intake.workflow.createRun({ runId: record.runId, resourceId: 'lead-qualification' });
      const result =
        snapshot?.status === 'running'
          ? await run.restart({ requestContext, tracingOptions })
          : await run.start({ inputData: { runId: record.runId }, requestContext, tracingOptions });
      if (result.status === 'success') {
        await this.store.complete(record.runId);
        await this.telemetry.diagnostic({ code: 'intake.dispatched', runId: record.runId });
      } else if (result.status === 'failed') {
        await this.store.fail(record.runId, 'workflow_failed');
      }
    } catch {
      // Keep the durable association pending while persistence is unavailable.
      await this.telemetry.diagnostic({ code: 'intake.retry', runId: record.runId });
    }
  }
}
