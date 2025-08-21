import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { MastraScorerEntry, ScoreRowData } from '@mastra/core/scores';
import type { StoragePagination } from '@mastra/core/storage';
import type { Context } from '../types';
import { handleError } from './error';

async function getScorersFromSystem({
  mastra,
  runtimeContext,
}: Context & {
  runtimeContext: RuntimeContext;
}) {
  const agents = mastra.getAgents();
  const workflows = mastra.getWorkflows();

  const scorersMap = new Map<string, MastraScorerEntry & { agentIds: string[]; workflowIds: string[] }>();

  for (const [_agentId, agent] of Object.entries(agents)) {
    const scorers =
      (await agent.getScorers({
        runtimeContext,
      })) || {};

    if (Object.keys(scorers).length > 0) {
      for (const [scorerId, scorer] of Object.entries(scorers)) {
        if (scorersMap.has(scorerId)) {
          scorersMap.get(scorerId)?.agentIds.push(agent.name);
        } else {
          scorersMap.set(scorerId, {
            workflowIds: [],
            ...scorer,
            agentIds: [agent.name],
          });
        }
      }
    }
  }

  for (const [workflowId, workflow] of Object.entries(workflows)) {
    const scorers =
      (await workflow.getScorers({
        runtimeContext,
      })) || {};

    if (Object.keys(scorers).length > 0) {
      for (const [scorerId, scorer] of Object.entries(scorers)) {
        if (scorersMap.has(scorerId)) {
          scorersMap.get(scorerId)?.workflowIds.push(workflowId);
        } else {
          scorersMap.set(scorerId, {
            agentIds: [],
            ...scorer,
            workflowIds: [workflowId],
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

  return scorer;
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

export async function getScoresByScorerIdHandler({
  mastra,
  scorerId,
  pagination,
  entityId,
  entityType,
}: Context & { scorerId: string; pagination: StoragePagination; entityId?: string; entityType?: string }) {
  try {
    const scores =
      (await mastra.getStorage()?.getScoresByScorerId?.({
        scorerId,
        pagination,
        entityId,
        entityType,
      })) || [];
    return scores;
  } catch (error) {
    return handleError(error, 'Error getting scores by scorer id');
  }
}

export async function getScoresByEntityIdHandler({
  mastra,
  entityId,
  entityType,
  pagination,
}: Context & { entityId: string; entityType: string; pagination: StoragePagination }) {
  try {
    let entityIdToUse = entityId;

    if (entityType === 'AGENT') {
      const agent = mastra.getAgentById(entityId);
      entityIdToUse = agent.id;
    } else if (entityType === 'WORKFLOW') {
      const workflow = mastra.getWorkflowById(entityId);
      entityIdToUse = workflow.id;
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
