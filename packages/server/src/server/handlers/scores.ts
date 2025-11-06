import type { MastraScorerEntry, ScoreRowData } from '@mastra/core/evals';
import type { RequestContext } from '@mastra/core/request-context';
import type { StoragePagination } from '@mastra/core/storage';
import type { Context } from '../types';
import { handleError } from './error';

async function listScorersFromSystem({
  mastra,
  requestContext,
}: Context & {
  requestContext: RequestContext;
}) {
  const agents = mastra.listAgents();
  const workflows = mastra.listWorkflows();

  const scorersMap = new Map<
    string,
    MastraScorerEntry & { agentIds: string[]; agentNames: string[]; workflowIds: string[]; isRegistered: boolean }
  >();

  for (const [_, agent] of Object.entries(agents)) {
    const scorers =
      (await agent.listScorers({
        requestContext,
      })) || {};

    if (Object.keys(scorers).length > 0) {
      for (const [_scorerId, scorer] of Object.entries(scorers)) {
        const scorerId = scorer.scorer.id;
        if (scorersMap.has(scorerId)) {
          scorersMap.get(scorerId)?.agentIds.push(agent.id);
          scorersMap.get(scorerId)?.agentNames.push(agent.name);
        } else {
          scorersMap.set(scorerId, {
            workflowIds: [],
            ...scorer,
            agentNames: [agent.name],
            agentIds: [agent.id],
            isRegistered: false,
          });
        }
      }
    }
  }

  for (const [workflowId, workflow] of Object.entries(workflows)) {
    const scorers =
      (await workflow.listScorers({
        requestContext,
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

  const registeredScorers = await mastra.listScorers();
  for (const [_scorerId, scorer] of Object.entries(registeredScorers || {})) {
    const scorerId = scorer.id;
    if (scorersMap.has(scorerId)) {
      scorersMap.get(scorerId)!.isRegistered = true;
    } else {
      scorersMap.set(scorerId, {
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

export async function listScorersHandler({ mastra, requestContext }: Context & { requestContext: RequestContext }) {
  const scorers = await listScorersFromSystem({
    mastra,
    requestContext,
  });

  return scorers;
}

export async function getScorerHandler({
  mastra,
  scorerId,
  requestContext,
}: Context & { scorerId: string; requestContext: RequestContext }) {
  const scorers = await listScorersFromSystem({
    mastra,
    requestContext,
  });

  const scorer = scorers[scorerId];

  if (!scorer) {
    return null;
  }

  return scorer;
}

export async function listScoresByRunIdHandler({
  mastra,
  runId,
  pagination,
}: Context & { runId: string; pagination: StoragePagination }) {
  try {
    const scoreResults = (await mastra.getStorage()?.listScoresByRunId?.({
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

export async function listScoresByScorerIdHandler({
  mastra,
  scorerId,
  pagination,
  entityId,
  entityType,
}: Context & { scorerId: string; pagination: StoragePagination; entityId?: string; entityType?: string }) {
  try {
    const scoreResults = (await mastra.getStorage()?.listScoresByScorerId?.({
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

export async function listScoresByEntityIdHandler({
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

    const scoreResults = (await mastra.getStorage()?.listScoresByEntityId?.({
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
