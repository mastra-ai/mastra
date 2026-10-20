import type { EventInputProvider } from '../providers/input';
import type { ReviewService } from '../review/service';
import { RequestContext } from '@mastra/core/request-context';
import { MastraWorker } from '@mastra/core/worker';
import type { IntakeConfig } from '../config/lead-ingestion';
import type { LeadEventStore, RunRecord } from '../persistence/lead-event-store';
import type { Telemetry } from '../observability/telemetry';
import type { ReceiveLeadWorkflow } from '../workflows/receive-lead';

/** Starts with the native server and drains before Mastra closes storage. */
export class LeadDispatcher extends MastraWorker {
  readonly name = 'lead-dispatcher';
  private timer?: ReturnType<typeof setInterval>;
  private polling?: Promise<void>;
  private readonly active = new Map<string, Promise<void>>();
  private reviewFirst = false;
  private lastReviewRun = '';

  constructor(
    private readonly store: LeadEventStore,
    private readonly intake: ReceiveLeadWorkflow,
    private readonly config: IntakeConfig,
    private readonly telemetry: Telemetry,
    private readonly reviews: ReviewService,
    private readonly input?: EventInputProvider,
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
      await this.input?.drain?.();
      const pending = new Map(
        (await this.store.pending(this.config.limits.activeRuns)).map(record => [record.runId, record]),
      );
      const reviewRuns = await this.store.reviews.pending(this.config.limits.maxPendingRuns);
      const nextReview = Math.max(
        0,
        reviewRuns.findIndex(runId => runId > this.lastReviewRun),
      );
      const reviewQueue = [...reviewRuns.slice(nextReview), ...reviewRuns.slice(0, nextReview)];
      // Alternate priority so recoverable output retries and new research both progress.
      const candidates = this.reviewFirst ? [...reviewQueue, ...pending.keys()] : [...pending.keys(), ...reviewQueue];
      this.reviewFirst = !this.reviewFirst;
      for (const runId of candidates) {
        if (this.active.size >= this.config.limits.activeRuns) break;
        if (!this.isRunning || this.active.has(runId)) continue;
        const cycle = await this.store.reviews.get(runId);
        if (
          !pending.has(runId) &&
          cycle?.state === 'awaiting_review' &&
          !cycle.decision &&
          cycle.packet &&
          Date.now() < Date.parse(cycle.packet.expiresAt)
        )
          continue;
        const record = pending.get(runId) ?? (await this.store.get(runId));
        if (!record) continue;
        const job = this.dispatch(record).finally(() => this.active.delete(runId));
        this.active.set(runId, job);
        if (reviewRuns.includes(runId)) this.lastReviewRun = runId;
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
        // Manual review revisions continue only the durable output lifecycle. Research stays completed.
        if ((await this.store.reviews.get(record.runId))?.active) await this.reviews.advance(record.runId);
        await this.store.complete(record.runId);
        return;
      }
      if (snapshot?.status === 'failed' || snapshot?.status === 'canceled') {
        await this.store.fail(record.runId, 'workflow_failed');
        return;
      }
      const requestContext = this.intake.authorizeDispatchContext(new RequestContext(), record.event);
      const tracingOptions = { metadata: { runId: record.runId } };
      const run = await this.intake.workflow.createRun({ runId: record.runId, resourceId: 'lead-qualification' });
      const decision = (await this.store.reviews.get(record.runId))?.decision;
      const result =
        snapshot?.status === 'suspended'
          ? await run.resume({
              step: 'apply-or-review',
              resumeData: decision ? { decisionId: decision.id } : {},
              requestContext,
              tracingOptions,
            })
          : snapshot?.status === 'running'
            ? await run.restart({ requestContext, tracingOptions })
            : await run.start({ inputData: { runId: record.runId }, requestContext, tracingOptions });
      if (result.status === 'suspended' || result.status === 'success') {
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
