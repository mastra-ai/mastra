import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import { saveScorePayloadSchema } from '../evals';
import type { ScoringHookInput } from '../evals/types';
import { isScorerHookForMastra } from '../hooks/scorer-owner';
import type { Mastra } from '../mastra';
import { resolveAgentById } from '../mastra/resolve-agent';
import { EntityType } from '../observability';
import type { MastraStorage } from '../storage';

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

export function createOnScorerHook(mastra: Mastra) {
  return async (hookData: ScoringHookInput) => {
    if (!isScorerHookForMastra(hookData, mastra)) {
      return;
    }

    const storage = mastra.getStorage();

    if (!storage) {
      mastra.getLogger()?.warn('Storage not found, skipping score validation and saving');
      return;
    }

    const entityId = hookData.entity.id as string;
    const entityType = hookData.entityType;
    const scorer = hookData.scorer;
    const scorerId = scorer.id as string;

    if (!scorerId) {
      mastra.getLogger()?.warn('Scorer ID not found, skipping score validation and saving');
      return;
    }

    try {
      const scorerToUse = await findScorer(mastra, entityId, entityType, scorerId);

      if (!scorerToUse) {
        throw new MastraError({
          id: 'MASTRA_SCORER_NOT_FOUND',
          domain: ErrorDomain.MASTRA,
          category: ErrorCategory.USER,
          text: `Scorer with ID ${scorerId} not found`,
        });
      }

      let input = hookData.input;
      let output = hookData.output;

      const { structuredOutput, ...rest } = hookData;

      const currentSpan = hookData.tracingContext?.currentSpan;
      const traceId = currentSpan?.isValid ? currentSpan.traceId : undefined;
      const spanId = currentSpan?.isValid ? currentSpan.id : undefined;
      const targetCorrelationContext = currentSpan?.isValid ? currentSpan.getCorrelationContext?.() : undefined;
      const targetMetadata = currentSpan?.isValid && currentSpan.metadata ? { ...currentSpan.metadata } : undefined;
      const runResult = await scorerToUse.scorer.run({
        ...rest,
        input,
        output,
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
        entityId,
        scorerId: scorerId,
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
      // packages/core/src/evals/base.ts). The hook must not republish or every
      // exporter would receive the same score twice.
      await validateAndSaveScore(storage, payload);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_SCORER_FAILED_TO_RUN_HOOK',
          domain: ErrorDomain.SCORER,
          category: ErrorCategory.USER,
          details: {
            scorerId,
            entityId,
            entityType,
          },
        },
        error,
      );

      mastra.getLogger()?.trackException(mastraError);
    }
  };
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
    const scorers = await mastra.getWorkflowById(entityId).listScorers();
    for (const [_, scorer] of Object.entries(scorers)) {
      if (scorer.scorer.id === scorerId) {
        scorerToUse = scorer;
        break;
      }
    }
  }

  // Fallback to mastra-registered scorer
  if (!scorerToUse) {
    const mastraRegisteredScorer = mastra.getScorerById(scorerId);
    scorerToUse = mastraRegisteredScorer ? { scorer: mastraRegisteredScorer } : undefined;
  }

  return scorerToUse;
}
