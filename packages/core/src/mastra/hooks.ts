import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import { saveScorePayloadSchema } from '../evals';
import type { ScoringHookInput } from '../evals/types';
import type { Mastra } from '../mastra';
import type { MastraStorage } from '../storage';

export function createOnScorerHook(mastra: Mastra) {
  return async (hookData: ScoringHookInput) => {
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

      const runResult = await scorerToUse.scorer.run({
        ...rest,
        input,
        output,
      });

      const currentSpan = hookData.tracingContext?.currentSpan;

      // Add score to span and trigger update event so it gets exported to DefaultExporter
      if (currentSpan && currentSpan.isValid) {
        try {
          currentSpan.addScore({
            scorerId: scorerToUse.scorer.id,
            scorerName: scorerToUse.scorer.name,
            score: runResult.score as number,
            reason: runResult.reason as string,
            source: hookData.source,
            metadata: {
              input,
              output,
              ...(runResult.preprocessStepResult ? { preprocessStepResult: runResult.preprocessStepResult } : {}),
              ...(runResult.analyzeStepResult ? { analyzeStepResult: runResult.analyzeStepResult } : {}),
              ...(runResult.preprocessPrompt ? { preprocessPrompt: runResult.preprocessPrompt } : {}),
              ...(runResult.analyzePrompt ? { analyzePrompt: runResult.analyzePrompt } : {}),
              ...(runResult.generateScorePrompt ? { generateScorePrompt: runResult.generateScorePrompt } : {}),
              ...(runResult.generateReasonPrompt ? { generateReasonPrompt: runResult.generateReasonPrompt } : {}),
              ...(hookData.additionalContext ? { additionalContext: hookData.additionalContext } : {}),
              ...(hookData.requestContext ? { requestContext: hookData.requestContext } : {}),
            },
          });

          // Trigger a span update event so the score gets exported
          currentSpan.update({});
        } catch (addScoreError) {
          mastra.getLogger()?.warn(`Failed to add score to span: ${addScoreError}`);
        }
      }
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
      mastra.getLogger()?.error(mastraError.toString());
    }
  };
}

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
    const scorers = await mastra.getAgentById(entityId).listScorers();
    for (const [_, scorer] of Object.entries(scorers)) {
      if (scorer.scorer.id === scorerId) {
        scorerToUse = scorer;
        break;
      }
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
