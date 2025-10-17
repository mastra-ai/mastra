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

  const scorersMap = new Map<
    string,
    MastraScorerEntry & { agentIds: string[]; agentNames: string[]; workflowIds: string[]; isRegistered: boolean }
  >();

  for (const [agentId, agent] of Object.entries(agents)) {
    const scorers =
      (await agent.getScorers({
        runtimeContext,
      })) || {};

    if (Object.keys(scorers).length > 0) {
      for (const [_scorerId, scorer] of Object.entries(scorers)) {
        const scorerName = scorer.scorer.name;
        if (scorersMap.has(scorerName)) {
          scorersMap.get(scorerName)?.agentIds.push(agentId);
          scorersMap.get(scorerName)?.agentNames.push(agent.name);
        } else {
          scorersMap.set(scorerName, {
            workflowIds: [],
            ...scorer,
            agentNames: [agent.name],
            agentIds: [agentId],
            isRegistered: false,
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
      for (const [_scorerId, scorer] of Object.entries(scorers)) {
        const scorerName = scorer.scorer.name;
        if (scorersMap.has(scorerName)) {
          scorersMap.get(scorerName)?.workflowIds.push(workflowId);
        } else {
          scorersMap.set(scorerName, {
            agentIds: [],
            agentNames: [],
            ...scorer,
            workflowIds: [workflowId],
            isRegistered: false,
          });
        }
      }
    }
  }

  const registeredScorers = await mastra.getScorers();
  for (const [_scorerId, scorer] of Object.entries(registeredScorers || {})) {
    const scorerName = scorer.name;
    if (scorersMap.has(scorerName)) {
      scorersMap.get(scorerName)!.isRegistered = true;
    } else {
      scorersMap.set(scorerName, {
        scorer: scorer,
        agentIds: [],
        agentNames: [],
        workflowIds: [],
        isRegistered: true,
      });
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
    const scoreResults = (await mastra.getStorage()?.getScoresByRunId?.({
      runId,
      pagination,
    })) || { pagination: { total: 0, page: 0, perPage: 0, hasMore: false }, scores: [] };
    return {
      pagination: scoreResults.pagination,
      scores: scoreResults.scores.map(score => ({ ...score, ...getTraceDetails(score.traceId) })),
    };
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
    const scoreResults = (await mastra.getStorage()?.getScoresByScorerId?.({
      scorerId,
      pagination,
      entityId,
      entityType,
    })) || { pagination: { total: 0, page: 0, perPage: 0, hasMore: false }, scores: [] };
    return {
      pagination: scoreResults.pagination,
      scores: scoreResults.scores.map(score => ({ ...score, ...getTraceDetails(score.traceId) })),
    };
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

    const scoreResults = (await mastra.getStorage()?.getScoresByEntityId?.({
      entityId: entityIdToUse,
      entityType,
      pagination,
    })) || { pagination: { total: 0, page: 0, perPage: 0, hasMore: false }, scores: [] };

    return {
      pagination: scoreResults.pagination,
      scores: scoreResults.scores.map(score => ({ ...score, ...getTraceDetails(score.traceId) })),
    };
  } catch (error) {
    return handleError(error, 'Error getting scores by entity id');
  }
}

// Legacy function to get trace and span details
function getTraceDetails(traceIdWithSpanId?: string) {
  if (!traceIdWithSpanId) {
    return {};
  }

  const [traceId, spanId] = traceIdWithSpanId.split('-');

  return {
    ...(traceId ? { traceId } : {}),
    ...(spanId ? { spanId } : {}),
  };
}

export async function saveScoreHandler({ mastra, score }: Context & { score: ScoreRowData }) {
  try {
    const scores = (await mastra.getStorage()?.saveScore?.(score)) || [];
    return scores;
  } catch (error) {
    return handleError(error, 'Error saving score');
  }
}
