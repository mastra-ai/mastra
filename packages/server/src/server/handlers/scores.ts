import type { MastraScorerEntry, ScoreRowData } from '@mastra/core/evals';
import type { RequestContext } from '@mastra/core/request-context';
import type { StoragePagination } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import { runIdSchema } from '../schemas/common';
import {
  listScorersResponseSchema,
  scorerEntrySchema,
  scorerIdPathParams,
  entityPathParams,
  listScoresByRunIdQuerySchema,
  listScoresByScorerIdQuerySchema,
  listScoresByEntityIdQuerySchema,
  saveScoreBodySchema,
  scoresWithPaginationResponseSchema,
  saveScoreResponseSchema,
} from '../schemas/scores';
import { createRoute } from '../server-adapter/routes/route-builder';
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

  // Helper function to process an agent's scorers
  const processAgentScorers = async (agent: {
    id: string;
    name: string;
    listScorers: (typeof agents)[string]['listScorers'];
  }) => {
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
  };

  // Process code-defined agents
  for (const [_, agent] of Object.entries(agents)) {
    await processAgentScorers(agent);
  }

  // Process stored agents (database-backed agents)
  try {
    const storedAgentsResult = await mastra.listStoredAgents();
    if (storedAgentsResult?.agents) {
      for (const storedAgent of storedAgentsResult.agents) {
        await processAgentScorers(storedAgent);
      }
    }
  } catch {
    // Silently ignore if storage is not configured - not all setups have storage
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

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const LIST_SCORERS_ROUTE = createRoute({
  method: 'GET',
  path: '/scores/scorers',
  responseType: 'json',
  responseSchema: listScorersResponseSchema,
  summary: 'List all scorers',
  description: 'Returns a list of all registered scorers with their configuration and associated agents and workflows',
  tags: ['Scoring'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext }) => {
    const scorers = await listScorersFromSystem({
      mastra,
      requestContext,
    });
    return scorers;
  },
});

export const GET_SCORER_ROUTE = createRoute({
  method: 'GET',
  path: '/scores/scorers/:scorerId',
  responseType: 'json',
  pathParamSchema: scorerIdPathParams,
  responseSchema: scorerEntrySchema.nullable(),
  summary: 'Get scorer by ID',
  description: 'Returns details for a specific scorer including its configuration and associations',
  tags: ['Scoring'],
  requiresAuth: true,
  handler: async ({ mastra, scorerId, requestContext }) => {
    const scorers = await listScorersFromSystem({
      mastra,
      requestContext,
    });

    const scorer = scorers[scorerId];

    if (!scorer) {
      return null;
    }

    return scorer;
  },
});

export const LIST_SCORES_BY_RUN_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/scores/run/:runId',
  responseType: 'json',
  pathParamSchema: runIdSchema,
  queryParamSchema: listScoresByRunIdQuerySchema,
  responseSchema: scoresWithPaginationResponseSchema,
  summary: 'List scores by run ID',
  description: 'Returns all scores for a specific execution run',
  tags: ['Scoring'],
  requiresAuth: true,
  handler: async ({ mastra, runId, ...params }) => {
    try {
      const { page, perPage } = params;
      const pagination: StoragePagination = {
        page: page ?? 0,
        perPage: perPage ?? 10,
      };
      const scores = await mastra.getStorage()?.getStore('scores');
      const scoreResults = (await scores?.listScoresByRunId?.({
        runId,
        pagination,
      })) || { pagination: { total: 0, page: 0, perPage: 0, hasMore: false }, scores: [] };
      return {
        pagination: scoreResults.pagination,
        scores: scoreResults.scores.map((score: ScoreRowData) => ({ ...score, ...getTraceDetails(score.traceId) })),
      };
    } catch (error) {
      return handleError(error, 'Error getting scores by run id');
    }
  },
});

export const LIST_SCORES_BY_SCORER_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/scores/scorer/:scorerId',
  responseType: 'json',
  pathParamSchema: scorerIdPathParams,
  queryParamSchema: listScoresByScorerIdQuerySchema,
  responseSchema: scoresWithPaginationResponseSchema,
  summary: 'List scores by scorer ID',
  description: 'Returns all scores generated by a specific scorer',
  tags: ['Scoring'],
  requiresAuth: true,
  handler: async ({ mastra, scorerId, ...params }) => {
    try {
      const { page, perPage, entityId, entityType } = params;
      const filters = Object.fromEntries(Object.entries({ entityId, entityType }).filter(([_, v]) => v !== undefined));
      const scores = await mastra.getStorage()?.getStore('scores');
      const scoreResults = (await scores?.listScoresByScorerId?.({
        scorerId,
        pagination: { page: page ?? 0, perPage: perPage ?? 10 },
        ...filters,
      })) || { pagination: { total: 0, page: 0, perPage: 0, hasMore: false }, scores: [] };
      return {
        pagination: scoreResults.pagination,
        scores: scoreResults.scores.map((score: ScoreRowData) => ({ ...score, ...getTraceDetails(score.traceId) })),
      };
    } catch (error) {
      return handleError(error, 'Error getting scores by scorer id');
    }
  },
});

export const LIST_SCORES_BY_ENTITY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/scores/entity/:entityType/:entityId',
  responseType: 'json',
  pathParamSchema: entityPathParams,
  queryParamSchema: listScoresByEntityIdQuerySchema,
  responseSchema: scoresWithPaginationResponseSchema,
  summary: 'List scores by entity ID',
  description: 'Returns all scores for a specific entity (agent or workflow)',
  tags: ['Scoring'],
  requiresAuth: true,
  handler: async ({ mastra, entityId, entityType, ...params }) => {
    try {
      const { page, perPage } = params;
      let entityIdToUse = entityId;

      if (entityType === 'AGENT') {
        const agent = mastra.getAgentById(entityId);
        entityIdToUse = agent.id;
      } else if (entityType === 'WORKFLOW') {
        const workflow = mastra.getWorkflowById(entityId);
        entityIdToUse = workflow.id;
      }

      const pagination: StoragePagination = {
        page: page ?? 0,
        perPage: perPage ?? 10,
      };

      const scoresStore = await mastra.getStorage()?.getStore('scores');
      const scoreResults = (await scoresStore?.listScoresByEntityId?.({
        entityId: entityIdToUse,
        entityType,
        pagination,
      })) || { pagination: { total: 0, page: 0, perPage: 0, hasMore: false }, scores: [] };

      return {
        pagination: scoreResults.pagination,
        scores: scoreResults.scores.map((score: ScoreRowData) => ({ ...score, ...getTraceDetails(score.traceId) })),
      };
    } catch (error) {
      return handleError(error, 'Error getting scores by entity id');
    }
  },
});

export const SAVE_SCORE_ROUTE = createRoute({
  method: 'POST',
  path: '/scores',
  responseType: 'json',
  bodySchema: saveScoreBodySchema,
  responseSchema: saveScoreResponseSchema,
  summary: 'Save score',
  description: 'Saves a new score record to storage',
  tags: ['Scoring'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const { score } = params as { score: ScoreRowData };
      const scoresStore = await mastra.getStorage()?.getStore('scores');
      const result = await scoresStore?.saveScore?.(score);
      if (!result) {
        throw new HTTPException(500, { message: 'Storage not configured' });
      }
      return result;
    } catch (error) {
      return handleError(error, 'Error saving score');
    }
  },
});
