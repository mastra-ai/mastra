import pMap from 'p-map';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import { saveScorePayloadSchema } from '../evals';
import type { ScoringHookInput } from '../evals/types';
import type { Mastra } from '../mastra';
import type { MastraStorage } from '../storage';

export function createOnScorerHook(mastra: Mastra) {
  return async (hookData: ScoringHookInput) => {
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
      await validateAndSaveScore(storage, payload);

      if (currentSpan && spanId && traceId) {
        await pMap(
          currentSpan.observabilityInstance.getExporters(),
          async exporter => {
            if (exporter.addScoreToTrace) {
              try {
                await exporter.addScoreToTrace({
                  traceId: traceId,
                  spanId: spanId,
                  score: runResult.score as number,
                  reason: runResult.reason as string,
                  scorerName: scorerToUse.scorer.id,
                  metadata: {
                    ...(currentSpan.metadata ?? {}),
                  },
                });
              } catch (error) {
                // Log error but don't fail the hook if exporter fails
                mastra.getLogger()?.error(`Failed to add score to trace via exporter: ${error}`);
              }
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
    // Try code-defined agents first
    try {
      const agent = mastra.getAgentById(entityId);
      const scorers = await agent.listScorers();
      for (const [_, scorer] of Object.entries(scorers)) {
        if (scorer.scorer.id === scorerId) {
          scorerToUse = scorer;
          break;
        }
      }
    } catch {
      // Agent not found in code-defined agents, try stored agents via editor
      try {
        const storedAgent = (await mastra.getEditor()?.agent.getById(entityId)) ?? null;
        if (storedAgent) {
          const scorers = await storedAgent.listScorers();
          for (const [_, scorer] of Object.entries(scorers) as [string, any][]) {
            if (scorer.scorer.id === scorerId) {
              scorerToUse = scorer;
              break;
            }
          }
        }
      } catch {
        // Stored agent also not found, will fall back to mastra-registered scorer
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
