import pMap from 'p-map';
import type { Mastra } from '../mastra';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import { saveScorePayloadSchema } from '../scores';
import type { ScoringHookInput } from '../scores/types';
import type { MastraStorage } from '../storage';

export function createOnScorerHook(mastra: Mastra) {
  return async (hookData: ScoringHookInput) => {
    const storage = mastra.getStorage();

    if (!storage) {
      mastra.getLogger()?.warn('Storage not found, skipping score validation and saving');
      return;
    }

    const entityId = hookData.entity.id;
    const entityType = hookData.entityType;
    const scorer = hookData.scorer;
    try {
      const scorerToUse = await findScorer(mastra, entityId, entityType, scorer.name);

      if (!scorerToUse) {
        throw new MastraError({
          id: 'MASTRA_SCORER_NOT_FOUND',
          domain: ErrorDomain.MASTRA,
          category: ErrorCategory.USER,
          text: `Scorer with ID ${hookData.scorer.id} not found`,
        });
      }

      let input = hookData.input;
      let output = hookData.output;

      const { structuredOutput, ...rest } = hookData;

      const runResult = await scorerToUse.scorer.run({
        ...rest,
        input,
        output,
      });

      let spanId;
      let traceId;
      const currentSpan = hookData.tracingContext?.currentSpan;
      if (currentSpan && currentSpan.isValid) {
        spanId = currentSpan.id;
        traceId = currentSpan.traceId;
      }

      const payload = {
        ...rest,
        ...runResult,
        entityId,
        scorerId: hookData.scorer.name,
        spanId,
        traceId,
        metadata: {
          structuredOutput: !!structuredOutput,
        },
      };
      await validateAndSaveScore(storage, payload);

      if (currentSpan && spanId && traceId) {
        await pMap(
          currentSpan.aiTracing.getExporters(),
          async exporter => {
            if (exporter.addScoreToTrace) {
              await exporter.addScoreToTrace({
                traceId: traceId,
                spanId: spanId,
                score: runResult.score,
                reason: runResult.reason,
                scorerName: scorerToUse.scorer.name,
                metadata: {
                  ...(currentSpan.metadata ?? {}),
                },
              });
            }
          },
          { concurrency: 3 },
        );
      }
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_SCORER_FAILED_TO_RUN_HOOK',
          domain: ErrorDomain.SCORER,
          category: ErrorCategory.USER,
          details: {
            scorerId: scorer.id,
            entityId,
            entityType,
          },
        },
        error,
      );

      mastra.getLogger()?.trackException(mastraError);
      mastra.getLogger()?.error(mastraError.toString());
    }
  };
}

export async function validateAndSaveScore(storage: MastraStorage, payload: unknown) {
  const payloadToSave = saveScorePayloadSchema.parse(payload);
  await storage?.saveScore(payloadToSave);
}

async function findScorer(mastra: Mastra, entityId: string, entityType: string, scorerName: string) {
  let scorerToUse;
  if (entityType === 'AGENT') {
    const scorers = await mastra.getAgentById(entityId).listScorers();
    for (const [_, scorer] of Object.entries(scorers)) {
      if (scorer.scorer.name === scorerName) {
        scorerToUse = scorer;
        break;
      }
    }
  } else if (entityType === 'WORKFLOW') {
    const scorers = await mastra.getWorkflowById(entityId).listScorers();
    for (const [_, scorer] of Object.entries(scorers)) {
      if (scorer.scorer.name === scorerName) {
        scorerToUse = scorer;
        break;
      }
    }
  }

  // Fallback to mastra-registered scorer
  if (!scorerToUse) {
    const mastraRegisteredScorer = mastra.getScorerByName(scorerName);
    scorerToUse = mastraRegisteredScorer ? { scorer: mastraRegisteredScorer } : undefined;
  }

  return scorerToUse;
}
