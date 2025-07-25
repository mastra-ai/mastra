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

    let scorerToUse;

    if (entityType === 'AGENT') {
      const agent = mastra.getAgentById(entityId);
      const scorers = await agent.getScorers();
      scorerToUse = scorers[scorer.id];
    } else if (entityType === 'WORKFLOW') {
      const workflow = mastra.getWorkflowById(entityId);
      const scorers = await workflow.getScorers();
      scorerToUse = scorers[scorer.id];
    } else {
      return;
    }

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

    if (entityType === 'AGENT') {
      input = hookData.input.filter(m => m.role === 'user');
    } else {
      output = { object: hookData.output };
    }

    const score = await scorerToUse.scorer.run({
      ...hookData,
      input,
      output,
    });

    const { structuredOutput, ...rest } = hookData;
    await storage?.saveScore({
      ...rest,
      ...score,
      entityId,
      scorerId: hookData.scorer.id,
      metadata: {
        structuredOutput: !!structuredOutput,
      },
    });
  };
}
