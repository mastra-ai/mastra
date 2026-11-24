import { openDatabase } from '../persistence/database.ts';
import { openProcessingStore } from '../persistence/processing.ts';
import { openReviewStore } from '../persistence/review.ts';
import { domainEventSchema } from '../contracts/telemetry.ts';
import { telemetryId } from './privacy.ts';

export const ratio = (numerator: number, denominator: number) => (denominator === 0 ? null : numerator / denominator);
export async function readDomainMetrics(url: string, runId: string) {
  let db: Awaited<ReturnType<typeof openDatabase>> | undefined,
    processing: Awaited<ReturnType<typeof openProcessingStore>> | undefined,
    review: Awaited<ReturnType<typeof openReviewStore>> | undefined;
  try {
    db = await openDatabase(url);
    processing = await openProcessingStore(url);
    review = await openReviewStore(url);
    const status = await processing.status(runId),
      state = await review.read(runId),
      intake = await processing.readIntake(runId);
    if (!status || !intake) throw new Error('MISSING_PROCESSING_RUN');
    const rows = await db.execute({
      sql: 'SELECT event_json FROM vrq_events WHERE run_id = ? ORDER BY rowid',
      args: [runId],
    });
    const events = rows.rows.map(row => domainEventSchema.parse(JSON.parse(String(row.event_json))));
    const routes = events.filter(e => e.kind === 'first_route');
    const reviewed = events.filter(e => e.kind === 'reviewed');
    const reviewedIds = new Set(reviewed.map(e => e.questionId));
    const correctedIds = new Set(reviewed.filter(e => e.corrected).map(e => e.questionId));
    const latestReview = new Map(reviewed.map(e => [e.questionId, e]));
    const materialClaims = [...latestReview.values()].reduce((n, e) => n + (e.materialClaims ?? 0), 0);
    const supportedClaims = [...latestReview.values()].reduce((n, e) => n + (e.supportedClaims ?? 0), 0);
    const started = events.find(e => e.kind === 'processing_started');
    const finished = events.find(e => e.kind === 'processing_finished');
    const exported = events.filter(e => e.kind === 'exported').at(-1);
    const elapsed = (a: { at: string } | undefined, b: { at: string } | undefined) =>
      a && b ? Math.max(0, Date.parse(b.at) - Date.parse(a.at)) : null;
    const unionMs = (intervals: Array<[number, number]>) => {
      const ordered = intervals.sort((a, b) => a[0] - b[0]);
      let total = 0,
        left = 0,
        right = 0;
      for (const [a, b] of ordered) {
        if (a > right) {
          total += right - left;
          left = a;
          right = b;
        } else right = Math.max(right, b);
      }
      return total + right - left;
    };
    const processingInterval: Array<[number, number]> =
      started && finished ? [[Date.parse(started.at), Date.parse(finished.at)]] : [];
    const reviewIntervals = reviewed
      .filter(e => e.startedAt)
      .map(e => [Date.parse(e.startedAt!), Date.parse(e.at)] as [number, number]);
    const exportIntervals = events
      .filter(e => e.kind === 'exported' && e.startedAt)
      .map(e => [Date.parse(e.startedAt!), Date.parse(e.at)] as [number, number]);
    const finalReview = reviewed.at(-1);
    const reviewElapsed = elapsed(finished, finalReview);
    const usage = [...new Map(status.usage.map(u => [u.id, u])).values()];
    const observed = usage.filter(u => u.status === 'observed');
    const uncertain = usage.length - observed.length;
    const gaps: Record<string, { unknown: number; withheld: number; error: number }> = {};
    for (const r of status.results) {
      const final = state?.projection?.answers.find(a => a.questionId === r.questionId);
      const domain = telemetryId(r.interpretation?.domain ?? 'unclassified')!;
      const bucket = (gaps[domain] ??= { unknown: 0, withheld: 0, error: 0 });
      if (final?.value === 'unknown') bucket.unknown++;
      if (final?.value === 'withheld') bucket.withheld++;
      if (
        r.reasons.some(code =>
          [
            'PROVIDER_FAILURE',
            'AUTHENTICATION_FAILURE',
            'MODEL_UNAVAILABLE',
            'STORAGE_FAILURE',
            'DETECTOR_FAILED',
            'CALL_TIMEOUT',
            'TOKEN_LIMIT',
            'INVALID_MODEL_OUTPUT',
          ].includes(code),
        )
      )
        bucket.error++;
    }
    return {
      schemaVersion: 1,
      runId: telemetryId(runId),
      state: state?.state ?? status.run.state,
      quality: state?.projection?.quality ?? null,
      totalQuestions: intake.input.questions.length,
      supportedAnswerRate: state?.projection ? ratio(state.projection.supported, state.projection.total) : null,
      firstRouting: {
        autoDraft: routes.filter(e => e.route === 'auto_draft').length,
        escalated: routes.filter(e => e.route === 'escalated').length,
        recorded: routes.length,
      },
      corrections: {
        corrected: correctedIds.size,
        reviewed: reviewedIds.size,
        rate: ratio(correctedIds.size, reviewedIds.size),
      },
      evidenceCoverage: state?.projection
        ? { supportedClaims, materialClaims, rate: ratio(supportedClaims, materialClaims) }
        : { supportedClaims: null, materialClaims: null, rate: null },
      gapsByDomain: gaps,
      timing: {
        wallMs: elapsed(started, exported),
        activeProcessingMs:
          started && finished ? unionMs([...processingInterval, ...reviewIntervals, ...exportIntervals]) : null,
        reviewWaitMs: reviewElapsed === null ? null : Math.max(0, reviewElapsed - unionMs(reviewIntervals)),
        incompleteTiming: !started || !finished,
      },
      usage: {
        physicalCalls: usage.length,
        uncertainCalls: uncertain,
        inputTokens: uncertain ? null : observed.reduce((n, u) => n + u.inputTokens!, 0),
        outputTokens: uncertain ? null : observed.reduce((n, u) => n + u.outputTokens!, 0),
        observedInputTokens: observed.reduce((n, u) => n + u.inputTokens!, 0),
        observedOutputTokens: observed.reduce((n, u) => n + u.outputTokens!, 0),
        estimatedUsd: usage.reduce((n, u) => n + u.estimatedUsd, 0),
        rates: status.run.policy.rates,
        policyDigest: status.run.policyDigest,
      },
      failures: {
        stopReason: status.run.stopReason,
        calls: usage.filter(u => u.reason !== null).length,
        security: status.security.filter(s => s.status !== 'passed').length,
        diagnostics: await processing.diagnostics(runId),
      },
      exports: events.filter(e => e.kind === 'exported').length,
    };
  } finally {
    await Promise.allSettled([
      Promise.resolve().then(() => db?.close()),
      Promise.resolve().then(() => processing?.close()),
      Promise.resolve().then(() => review?.close()),
    ]);
  }
}
