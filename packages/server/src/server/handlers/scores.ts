import type { ScoreRowData, StoragePagination } from '@mastra/core';
import type { MastraScorer } from '@mastra/core/agent';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { Context } from '../types';
import { handleError } from './error';

async function getScorersFromSystem({
  mastra,
  runtimeContext,
}: Context & {
  runtimeContext: RuntimeContext;
}) {
  const agents = mastra.getAgents();

  const scorersMap = new Map<string, MastraScorer & { agentIds: string[] }>();

  for (const [agentId, agent] of Object.entries(agents)) {
    const scorers =
      (await agent.getScorers({
        runtimeContext,
      })) || {};

    if (Object.keys(scorers).length > 0) {
      for (const [scorerId, scorer] of Object.entries(scorers)) {
        if (scorersMap.has(scorerId)) {
          scorersMap.get(scorerId)?.agentIds.push(agentId);
        } else {
          scorersMap.set(scorerId, {
            ...scorer,
            agentIds: [agentId],
          });
        }
      }
    }
  }

  return Object.fromEntries(scorersMap.entries());
}

export async function getScorersHandler({ mastra, runtimeContext }: Context & { runtimeContext: RuntimeContext }) {
  const scorers = await getScorersFromSystem({
    mastra,
    runtimeContext,
  });

  return scorers;
}

export async function getScorerHandler({
  mastra,
  scorerId,
  runtimeContext,
}: Context & { scorerId: string; runtimeContext: RuntimeContext }) {
  const scorers = await getScorersFromSystem({
    mastra,
    runtimeContext,
  });

  const scorer = scorers[scorerId];

  if (!scorer) {
    return null;
  }

  const prompts = 'prompts' in scorer.scorer ? scorer.scorer.prompts() : null;

  return {
    ...scorer,
    prompts,
  };
}

export async function getScoresByRunIdHandler({
  mastra,
  runId,
  pagination,
}: Context & { runId: string; pagination: StoragePagination }) {
  try {
    const scores =
      (await mastra.getStorage()?.getScoresByRunId?.({
        runId,
        pagination,
      })) || [];
    return scores;
  } catch (error) {
    return handleError(error, 'Error getting scores by run id');
  }
}

export async function getScoresByEntityIdHandler({
  mastra,
  entityId,
  entityType,
  pagination,
}: Context & { entityId: string; entityType: string; pagination: StoragePagination }) {
  const logger = mastra.getLogger();
  try {
    let entityIdToUse = entityId;

    if (entityType === 'AGENT') {
      let agent;
      try {
        agent = mastra.getAgentById(entityId);
      } catch (error) {
        logger.debug('Error getting agent by id', { error });
      }

      if (!agent) {
        agent = mastra.getAgent(entityId);
      }

      entityIdToUse = agent.id;
    }

    const scores =
      (await mastra.getStorage()?.getScoresByEntityId?.({
        entityId: entityIdToUse,
        entityType,
        pagination,
      })) || [];

    return scores;
  } catch (error) {
    return handleError(error, 'Error getting scores by entity id');
  }
}

export async function saveScoreHandler({ mastra, score }: Context & { score: ScoreRowData }) {
  try {
    const scores = (await mastra.getStorage()?.saveScore?.(score)) || [];
    return scores;
  } catch (error) {
    return handleError(error, 'Error saving score');
  }
}
