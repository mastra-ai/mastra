import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { Mastra } from '../../mastra';
import { resolveAgentById } from '../../mastra/resolve-agent';
import { EntityType } from '../../observability';
import type { MastraStorage } from '../../storage';
import { saveScorePayloadSchema } from '../types';
import type { ScoringHookInput } from '../types';

export const SCORE_RUN_WORKFLOW_ID = '__score-run';

/**
 * Serializable input for a single durable scoring run: the hook payload minus
 * the non-serializable `tracingContext`, plus the target span identity
 * extracted from it at dispatch time.
 */
export type ScoreRunInput = {
  hookData: ScoringHookInput;
  traceId?: string;
  spanId?: string;
  targetCorrelationContext?: Record<string, any>;
  targetMetadata?: Record<string, any>;
};

function toScorerTargetEntityType(entityType: string): EntityType | undefined {
  switch (entityType) {
    case 'AGENT':
      return EntityType.AGENT;
    case 'WORKFLOW':
      return EntityType.WORKFLOW_RUN;
    default:
      return undefined;
  }
}

/**
 * Extract the serializable target span identity from a live scoring hook
 * payload. Must run at dispatch time — `tracingContext` does not survive
 * serialization into a workflow run.
 */
export function extractScoreRunTarget(hookData: ScoringHookInput): Omit<ScoreRunInput, 'hookData'> {
  const currentSpan = (hookData.tracingContext ?? hookData.tracing)?.currentSpan;
  const traceId = currentSpan?.isValid ? currentSpan.traceId : undefined;
  const spanId = currentSpan?.isValid ? currentSpan.id : undefined;
  const targetCorrelationContext = currentSpan?.isValid ? currentSpan.getCorrelationContext?.() : undefined;
  const targetMetadata = currentSpan?.isValid && currentSpan.metadata ? { ...currentSpan.metadata } : undefined;
  return { traceId, spanId, targetCorrelationContext, targetMetadata };
}

/**
 * Deterministic run id for a live scoring run so duplicate dispatches of the
 * same (scorer, span) upsert the same intent row instead of creating new runs.
 */
export function getScoreRunId({
  scorerId,
  hookData,
  traceId,
  spanId,
}: {
  scorerId: string;
  hookData: ScoringHookInput;
  traceId?: string;
  spanId?: string;
}): string {
  const entityId = hookData.entity?.id as string | undefined;
  const primary = traceId ?? hookData.runId;
  const secondary = spanId ?? entityId;
  // No stable identity available — fall back to a random id so unrelated
  // scoring events don't collide on `scoring-<scorer>-undefined-undefined`.
  if (primary === undefined && secondary === undefined) {
    return `scoring-${scorerId}-${crypto.randomUUID()}`;
  }
  return `scoring-${scorerId}-${primary}-${secondary}`;
}

/**
 * Run one live scoring execution end-to-end: resolve the scorer, run it, and
 * persist the resulting score. Unlike the legacy hook path, errors PROPAGATE
 * so a durable run that wraps this ends `failed` with the error recorded.
 */
export async function executeScoreRun({
  mastra,
  input,
}: {
  mastra: Mastra;
  input: ScoreRunInput;
}): Promise<{ scorerId: string; score?: number }> {
  const { hookData, traceId, spanId, targetCorrelationContext, targetMetadata } = input;
  const storage = mastra.getStorage();

  if (!storage) {
    throw new MastraError({
      id: 'MASTRA_SCORER_STORAGE_NOT_FOUND',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: 'Storage not found, cannot validate and save score',
    });
  }

  const entityId = hookData.entity.id as string;
  const entityType = hookData.entityType;
  const scorerId = hookData.scorer.id as string;

  const scorerToUse = await findScorer(mastra, entityId, entityType, scorerId);

  if (!scorerToUse) {
    throw new MastraError({
      id: 'MASTRA_SCORER_NOT_FOUND',
      domain: ErrorDomain.MASTRA,
      category: ErrorCategory.USER,
      text: `Scorer with ID ${scorerId} not found`,
    });
  }

  const { structuredOutput, ...rest } = hookData;

  const runResult = await scorerToUse.scorer.run({
    ...rest,
    input: hookData.input,
    output: hookData.output,
    scoreSource: 'live',
    targetScope: 'span',
    targetEntityType: toScorerTargetEntityType(entityType),
    targetTraceId: traceId,
    targetSpanId: spanId,
    targetCorrelationContext,
    targetMetadata,
  } as any);

  const payload = {
    ...rest,
    ...runResult,
    // Deterministic score id: retries of the same (scorer, span) upsert the
    // same row instead of inserting duplicates.
    id: getScoreRunId({ scorerId, hookData, traceId, spanId }),
    entityId,
    scorerId,
    spanId,
    traceId,
    scorer: {
      ...rest.scorer,
      hasJudge: !!scorerToUse.scorer.judge,
    },
    metadata: {
      structuredOutput: !!structuredOutput,
    },
  };
  // Legacy score-store emission. This path is being deprecated.
  // ScoreEvent emission already happens inside MastraScorer.run() (see
  // packages/core/src/evals/base.ts). This path must not republish or every
  // exporter would receive the same score twice.
  await validateAndSaveScore(storage, payload);

  return { scorerId, score: runResult.score as number | undefined };
}

/**
 * @deprecated Legacy scores-store path. New score emission should use `mastra.observability.addScore()`.
 */
export async function validateAndSaveScore(storage: MastraStorage, payload: unknown) {
  const scoresStore = await storage.getStore('scores');
  if (!scoresStore) {
    throw new MastraError({
      id: 'MASTRA_SCORES_STORAGE_NOT_AVAILABLE',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: 'Scores storage domain is not available',
    });
  }
  const payloadToSave = saveScorePayloadSchema.parse(payload);
  await scoresStore.saveScore(payloadToSave);
}

async function findScorer(mastra: Mastra, entityId: string, entityType: string, scorerId: string) {
  let scorerToUse;
  if (entityType === 'AGENT') {
    try {
      // Registry first, then stored agents via the editor.
      const resolved = await resolveAgentById(mastra, entityId);
      if (resolved.status === 'found') {
        const scorers = await resolved.agent.listScorers();
        for (const [_, scorer] of Object.entries(scorers)) {
          if (scorer.scorer.id === scorerId) {
            scorerToUse = scorer;
            break;
          }
        }
      }
    } catch {
      // Resolution or scorer listing failed — fall back to mastra-registered scorer
    }
  } else if (entityType === 'WORKFLOW') {
    try {
      const scorers = await mastra.getWorkflowById(entityId).listScorers();
      for (const [_, scorer] of Object.entries(scorers)) {
        if (scorer.scorer.id === scorerId) {
          scorerToUse = scorer;
          break;
        }
      }
    } catch {
      // Workflow lookup or scorer listing failed — fall back to mastra-registered scorer
    }
  }

  // Fallback to mastra-registered scorer
  if (!scorerToUse) {
    const mastraRegisteredScorer = mastra.getScorerById(scorerId);
    scorerToUse = mastraRegisteredScorer ? { scorer: mastraRegisteredScorer } : undefined;
  }

  return scorerToUse;
}
