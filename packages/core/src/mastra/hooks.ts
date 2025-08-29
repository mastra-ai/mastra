import type { Mastra } from '..';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { ScoringHookInput } from '../scores';

export function createOnScorerHook(mastra: Mastra) {
  return async (hookData: ScoringHookInput) => {
    if (!mastra.getStorage()) {
      return;
    }

    const storage = mastra.getStorage();
    const entityId = hookData.entity.id;
    const entityType = hookData.entityType;
    const scorer = hookData.scorer;
    try {
      const scorerToUse = await findScorer(mastra, entityId, entityType, scorer.id);

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

      if (entityType !== 'AGENT') {
        output = { object: hookData.output };
      }

      const { structuredOutput, ...rest } = hookData;

      const runResult = await scorerToUse.scorer.run({
        ...rest,
        input,
        output,
      });

      const payload = {
        ...rest,
        ...runResult,
        entityId,
        scorerId: hookData.scorer.id,
        metadata: {
          structuredOutput: !!structuredOutput,
        },
      };
      await storage?.saveScore(payload);
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

async function findScorer(mastra: Mastra, entityId: string, entityType: string, scorerId: string) {
  let scorerToUse;
  if (entityType === 'AGENT') {
    const scorers = await mastra.getAgentById(entityId).getScorers();
    scorerToUse = scorers[scorerId];
  } else if (entityType === 'WORKFLOW') {
    const scorers = await mastra.getWorkflowById(entityId).getScorers();
    scorerToUse = scorers[scorerId];
  }

  // Fallback to mastra-registered scorer
  if (!scorerToUse) {
    const mastraRegisteredScorer = mastra.getScorerByName(scorerId);
    scorerToUse = mastraRegisteredScorer ? { scorer: mastraRegisteredScorer } : undefined;
  }

  return scorerToUse;
}
