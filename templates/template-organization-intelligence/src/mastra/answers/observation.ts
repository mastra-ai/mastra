import type { SourceIndex } from '../workspaces/source-index.js';
import type { GroundingOptions, OrganizationAnswer, ProcessorState } from './schema.js';
import { combinedUsage, reportedUsage } from './usage.js';

export function recordAnswerObservation(result: OrganizationAnswer, state: ProcessorState, options: GroundingOptions) {
  if (state.observationRecorded) return;
  state.observationRecorded = true;
  options.onGroundedAnswer?.({
    answer: result,
    evidence: (state.evidence ?? []).map(evidence => ({
      recordId: evidence.recordId,
      locator: evidence.locator,
      sourceId: evidence.sourceId,
      content: evidence.excerpt,
    })),
  });
}

export async function recordAnswerTelemetry(
  index: SourceIndex,
  options: GroundingOptions,
  result: OrganizationAnswer,
  state: ProcessorState,
  rawUsage?: unknown,
  finalUsage: boolean = false,
): Promise<void> {
  const answerUsage = reportedUsage(rawUsage);
  const contextualizationUsage = reportedUsage(state.contextualizationUsage);
  const usage = state.clarification
    ? contextualizationUsage
    : state.contextualizationAttempted
      ? combinedUsage(answerUsage, contextualizationUsage)
      : answerUsage;
  if (!state.usageReported && usage !== 'unavailable') {
    state.usageReported = true;
    options.onGroundedUsage?.(usage);
  } else if (!state.usageReported && finalUsage) {
    state.usageReported = true;
    options.onGroundedUsage?.(undefined);
  }
  if (state.telemetryRecorded && usage === 'unavailable') return;
  state.telemetryRecorded = true;
  await index.telemetry
    ?.recordQuery({
      correlationId: result.metadata.correlationId,
      status: result.status,
      retrievalMs: result.metadata.retrievalMs,
      durationMs: performance.now() - (state.startedAt ?? performance.now()),
      sourceIds: result.metadata.sourceIds,
      usage,
      cost: 'unavailable',
    })
    .catch(() => undefined);
}
