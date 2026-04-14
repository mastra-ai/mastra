import { randomUUID } from 'node:crypto';

import type { Mastra } from '@mastra/core';
import type { RolloutsStorage, AgentsStorage, ScoresStorage } from '@mastra/core/storage';

import { HTTPException } from '../http-exception';
import {
  agentRolloutPathParams,
  startRolloutBodySchema,
  updateRolloutBodySchema,
  promoteRolloutBodySchema,
  listRolloutsQuerySchema,
  rolloutRecordSchema,
  rolloutActionResponseSchema,
  listRolloutsResponseSchema,
  rolloutResultsSchema,
} from '../schemas/agent-rollouts';
import type { ServerRoute } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

// ============================================================================
// Helpers
// ============================================================================

async function getRolloutsStore(mastra: Mastra): Promise<RolloutsStorage> {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not configured' });
  }
  const store = await storage.getStore('rollouts');
  if (!store) {
    throw new HTTPException(500, { message: 'Rollouts storage domain is not available' });
  }
  return store;
}

async function getAgentsStore(mastra: Mastra): Promise<AgentsStorage> {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not configured' });
  }
  const store = await storage.getStore('agents');
  if (!store) {
    throw new HTTPException(500, { message: 'Agents storage domain is not available' });
  }
  return store;
}

async function getScoresStore(mastra: Mastra): Promise<ScoresStorage | undefined> {
  const storage = mastra.getStorage();
  if (!storage) return undefined;
  return storage.getStore('scores');
}

/**
 * Ensure the rollout accumulator is bound and running.
 * Lazily initializes on first call.
 */
function ensureAccumulator(mastra: Mastra): void {
  const accumulator = mastra.getRolloutAccumulator();
  if (!accumulator || accumulator.bound) return;

  const storage = mastra.getStorage();
  if (!storage) return;

  void storage.getStore('rollouts').then((rolloutsStore: RolloutsStorage | undefined) => {
    if (!rolloutsStore) return;

    accumulator.bind(rolloutsStore, async (agentId: string, rolloutId: string) => {
      // Rollback handler: mark rollout as rolled_back
      try {
        await rolloutsStore.completeRollout(rolloutId, 'rolled_back', new Date());
        accumulator.clearAgent(agentId);
        mastra.getLogger()?.info('Rollout auto-rolled back', { agentId, rolloutId });
        // Clear editor cache so subsequent requests use the stable version
        mastra.getEditor()?.agent.clearCache(agentId);
      } catch (err) {
        mastra.getLogger()?.error('Failed to auto-rollback rollout', { agentId, rolloutId, error: err });
      }
    });

    accumulator.start();
  });
}

// ============================================================================
// GET /agents/:agentId/rollout — Get active rollout
// ============================================================================

interface AllocationWithScores {
  versionId: string;
  weight: number;
  label?: string;
  scores?: Record<string, { avg: number; count: number }>;
}

export const GET_ROLLOUT_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/rollout',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: agentRolloutPathParams,
  responseSchema: rolloutRecordSchema.nullable(),
  summary: 'Get active rollout',
  description: 'Returns the active rollout for an agent, including live score summaries per allocation.',
  tags: ['Agent Rollouts'],
  handler: async ({ mastra, agentId }) => {
    try {
      const rolloutsStore = await getRolloutsStore(mastra);
      const rollout = await rolloutsStore.getActiveRollout(agentId);

      if (!rollout) {
        return null;
      }

      // Enrich allocations with score summaries from the accumulator
      const accumulator = mastra.getRolloutAccumulator();
      if (accumulator && rollout.rules?.length) {
        const scorerIds = rollout.rules.map(r => r.scorerId);
        const enriched: AllocationWithScores[] = rollout.allocations.map(alloc => {
          const scores: Record<string, { avg: number; count: number }> = {};
          for (const scorerId of scorerIds) {
            const window = accumulator.getWindow(agentId, alloc.versionId, scorerId, 1000);
            if (window && window.count > 0) {
              scores[scorerId] = window;
            }
          }
          return Object.keys(scores).length > 0 ? { ...alloc, scores } : { ...alloc };
        });
        return { ...rollout, allocations: enriched };
      }

      return rollout;
    } catch (error) {
      return handleError(error, 'Error getting rollout');
    }
  },
});

// ============================================================================
// POST /agents/:agentId/rollout — Start a rollout
// ============================================================================

export const START_ROLLOUT_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/rollout',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: agentRolloutPathParams,
  bodySchema: startRolloutBodySchema,
  responseSchema: rolloutRecordSchema,
  summary: 'Start a rollout',
  description: 'Start a new canary rollout or A/B test for an agent. Only one active rollout per agent.',
  tags: ['Agent Rollouts'],
  handler: async ({ mastra, agentId, ...body }) => {
    try {
      const rolloutsStore = await getRolloutsStore(mastra);
      const agentsStore = await getAgentsStore(mastra);

      // Check for existing active rollout
      const existing = await rolloutsStore.getActiveRollout(agentId);
      if (existing) {
        throw new HTTPException(409, { message: 'An active rollout already exists for this agent. Cancel it first.' });
      }

      // Get the agent's current active version
      const agent = await agentsStore.getById(agentId);
      let stableVersionId: string | undefined;

      if (agent?.activeVersionId) {
        stableVersionId = agent.activeVersionId;
      } else {
        // Try code-defined agent
        try {
          const codeAgent = mastra.getAgentById(agentId);
          const rawConfig = codeAgent?.toRawConfig?.();
          stableVersionId = rawConfig?.resolvedVersionId as string | undefined;
        } catch {
          // not found
        }
      }

      if (!stableVersionId) {
        throw new HTTPException(400, {
          message: 'Agent has no active version. Publish a version first before starting a rollout.',
        });
      }

      let allocations: Array<{ versionId: string; weight: number; label?: string }>;
      let rules: Array<{ scorerId: string; threshold: number; windowSize: number; action: 'rollback' }> | undefined;
      let routingKey: string | undefined;
      let type: 'canary' | 'ab_test';

      if (body.type === 'canary') {
        type = 'canary';
        routingKey = body.routingKey;
        rules = body.rules;

        // Validate candidate version exists
        const candidateVersion = await agentsStore.getVersion(body.candidateVersionId);
        if (!candidateVersion || candidateVersion.agentId !== agentId) {
          throw new HTTPException(404, {
            message: `Candidate version ${body.candidateVersionId} not found for this agent`,
          });
        }

        allocations = [
          { versionId: stableVersionId, weight: 100 - body.candidateWeight, label: 'stable' },
          { versionId: body.candidateVersionId, weight: body.candidateWeight, label: 'candidate' },
        ];
      } else {
        type = 'ab_test';
        routingKey = body.routingKey;

        // Validate weights sum to 100
        const totalWeight = body.allocations.reduce((sum, a) => sum + a.weight, 0);
        if (totalWeight !== 100) {
          throw new HTTPException(400, { message: `Allocation weights must sum to 100, got ${totalWeight}` });
        }

        // Validate all version IDs exist
        for (const alloc of body.allocations) {
          const version = await agentsStore.getVersion(alloc.versionId);
          if (!version || version.agentId !== agentId) {
            throw new HTTPException(404, { message: `Version ${alloc.versionId} not found for this agent` });
          }
        }

        allocations = body.allocations;
      }

      const rollout = await rolloutsStore.createRollout({
        id: `rol_${randomUUID()}`,
        agentId,
        type,
        stableVersionId,
        allocations,
        routingKey,
        rules,
      });

      // Ensure the accumulator is running for rule evaluation
      ensureAccumulator(mastra);

      return rollout;
    } catch (error) {
      return handleError(error, 'Error starting rollout');
    }
  },
});

// ============================================================================
// PATCH /agents/:agentId/rollout — Update rollout weights
// ============================================================================

export const UPDATE_ROLLOUT_ROUTE = createRoute({
  method: 'PATCH',
  path: '/agents/:agentId/rollout',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: agentRolloutPathParams,
  bodySchema: updateRolloutBodySchema,
  responseSchema: rolloutRecordSchema,
  summary: 'Update rollout weights',
  description: 'Update traffic weights for an active canary rollout.',
  tags: ['Agent Rollouts'],
  handler: async ({ mastra, agentId, candidateWeight }) => {
    try {
      const rolloutsStore = await getRolloutsStore(mastra);

      const rollout = await rolloutsStore.getActiveRollout(agentId);
      if (!rollout) {
        throw new HTTPException(404, { message: 'No active rollout found for this agent' });
      }

      if (rollout.type !== 'canary') {
        throw new HTTPException(400, { message: 'Weight updates are only supported for canary rollouts' });
      }

      // Recalculate allocations
      const stableAlloc = rollout.allocations.find(a => a.versionId === rollout.stableVersionId);
      const candidateAlloc = rollout.allocations.find(a => a.versionId !== rollout.stableVersionId);

      if (!stableAlloc || !candidateAlloc) {
        throw new HTTPException(500, { message: 'Invalid rollout state: missing allocations' });
      }

      const updatedAllocations = [
        { ...stableAlloc, weight: 100 - candidateWeight },
        { ...candidateAlloc, weight: candidateWeight },
      ];

      const updated = await rolloutsStore.updateRollout({
        id: rollout.id,
        allocations: updatedAllocations,
      });

      return updated;
    } catch (error) {
      return handleError(error, 'Error updating rollout');
    }
  },
});

// ============================================================================
// POST /agents/:agentId/rollout/promote — Promote / conclude
// ============================================================================

export const PROMOTE_ROLLOUT_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/rollout/promote',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: agentRolloutPathParams,
  bodySchema: promoteRolloutBodySchema,
  responseSchema: rolloutActionResponseSchema,
  summary: 'Promote rollout',
  description: 'For canary: promotes the candidate to active. For A/B tests: specify which version wins.',
  tags: ['Agent Rollouts'],
  handler: async ({ mastra, agentId, versionId }) => {
    try {
      const rolloutsStore = await getRolloutsStore(mastra);
      const agentsStore = await getAgentsStore(mastra);

      const rollout = await rolloutsStore.getActiveRollout(agentId);
      if (!rollout) {
        throw new HTTPException(404, { message: 'No active rollout found for this agent' });
      }

      let promoteVersionId: string;

      if (rollout.type === 'canary') {
        // Promote the candidate version
        const candidate = rollout.allocations.find(a => a.versionId !== rollout.stableVersionId);
        if (!candidate) {
          throw new HTTPException(500, { message: 'Invalid rollout state: no candidate allocation' });
        }
        promoteVersionId = candidate.versionId;
      } else {
        // A/B test: caller specifies which version wins
        promoteVersionId = versionId ?? rollout.stableVersionId;
        // Validate the version is part of the rollout
        if (!rollout.allocations.some(a => a.versionId === promoteVersionId)) {
          throw new HTTPException(400, { message: `Version ${promoteVersionId} is not part of this rollout` });
        }
      }

      // Activate the promoted version
      await agentsStore.update({ id: agentId, activeVersionId: promoteVersionId, status: 'published' });

      // Clear editor cache so new version is used
      mastra.getEditor()?.agent.clearCache(agentId);

      // Complete the rollout
      const completed = await rolloutsStore.completeRollout(rollout.id, 'completed', new Date());

      // Clear accumulator
      const accumulator = mastra.getRolloutAccumulator();
      accumulator?.clearAgent(agentId);

      return { success: true, rollout: completed };
    } catch (error) {
      return handleError(error, 'Error promoting rollout');
    }
  },
});

// ============================================================================
// POST /agents/:agentId/rollout/rollback — Rollback
// ============================================================================

export const ROLLBACK_ROLLOUT_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/rollout/rollback',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: agentRolloutPathParams,
  responseSchema: rolloutActionResponseSchema,
  summary: 'Rollback rollout',
  description: 'Rollback a canary rollout. The agent stays on the stable version.',
  tags: ['Agent Rollouts'],
  handler: async ({ mastra, agentId }) => {
    try {
      const rolloutsStore = await getRolloutsStore(mastra);

      const rollout = await rolloutsStore.getActiveRollout(agentId);
      if (!rollout) {
        throw new HTTPException(404, { message: 'No active rollout found for this agent' });
      }

      // Complete the rollout as rolled_back — agent stays on stableVersionId
      const completed = await rolloutsStore.completeRollout(rollout.id, 'rolled_back', new Date());

      // Clear editor cache
      mastra.getEditor()?.agent.clearCache(agentId);

      // Clear accumulator
      const accumulator = mastra.getRolloutAccumulator();
      accumulator?.clearAgent(agentId);

      return { success: true, rollout: completed };
    } catch (error) {
      return handleError(error, 'Error rolling back rollout');
    }
  },
});

// ============================================================================
// DELETE /agents/:agentId/rollout — Cancel
// ============================================================================

export const CANCEL_ROLLOUT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/agents/:agentId/rollout',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: agentRolloutPathParams,
  responseSchema: rolloutActionResponseSchema,
  summary: 'Cancel rollout',
  description: 'Cancel an active rollout without promoting or rolling back.',
  tags: ['Agent Rollouts'],
  handler: async ({ mastra, agentId }) => {
    try {
      const rolloutsStore = await getRolloutsStore(mastra);

      const rollout = await rolloutsStore.getActiveRollout(agentId);
      if (!rollout) {
        throw new HTTPException(404, { message: 'No active rollout found for this agent' });
      }

      // Complete the rollout as cancelled
      const completed = await rolloutsStore.completeRollout(rollout.id, 'cancelled', new Date());

      // Clear accumulator
      const accumulator = mastra.getRolloutAccumulator();
      accumulator?.clearAgent(agentId);

      return { success: true, rollout: completed };
    } catch (error) {
      return handleError(error, 'Error cancelling rollout');
    }
  },
});

// ============================================================================
// GET /agents/:agentId/rollout/results — A/B test results
// ============================================================================

export const GET_ROLLOUT_RESULTS_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/rollout/results',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: agentRolloutPathParams,
  responseSchema: rolloutResultsSchema,
  summary: 'Get A/B test results',
  description: 'Returns per-allocation score breakdowns for comparison.',
  tags: ['Agent Rollouts'],
  handler: async ({ mastra, agentId }) => {
    try {
      const rolloutsStore = await getRolloutsStore(mastra);

      const rollout = await rolloutsStore.getActiveRollout(agentId);
      if (!rollout) {
        throw new HTTPException(404, { message: 'No active rollout found for this agent' });
      }

      // Query scores from storage for each allocation
      const scoresStore = await getScoresStore(mastra);

      const allocations = await Promise.all(
        rollout.allocations.map(async alloc => {
          const scores: Record<string, { avg: number; stddev: number; count: number; min: number; max: number }> = {};

          if (scoresStore) {
            // Get all scores for this agent — filter by version via entity.resolvedVersionId
            const allScores = await scoresStore.listScoresByEntityId({
              entityId: agentId,
              entityType: 'AGENT',
              pagination: { page: 0, perPage: 10000 },
            });

            // Group scores by scorerId, filtering by version
            const byScorer = new Map<string, number[]>();
            for (const score of allScores.scores || []) {
              // Match scores to allocations via the entity's resolvedVersionId
              const scoreVersionId = score.entity?.resolvedVersionId as string | undefined;
              if (scoreVersionId !== alloc.versionId) continue;

              const sid = score.scorerId;
              if (!byScorer.has(sid)) byScorer.set(sid, []);
              byScorer.get(sid)!.push(score.score);
            }

            for (const [scorerId, values] of byScorer) {
              if (values.length === 0) continue;
              const avg = values.reduce((a, b) => a + b, 0) / values.length;
              const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
              const stddev = Math.sqrt(variance);
              scores[scorerId] = {
                avg,
                stddev,
                count: values.length,
                min: Math.min(...values),
                max: Math.max(...values),
              };
            }
          }

          return {
            versionId: alloc.versionId,
            label: alloc.label,
            requestCount: Object.values(scores).reduce((sum, s) => Math.max(sum, s.count), 0),
            scores,
          };
        }),
      );

      return {
        rolloutId: rollout.id,
        type: rollout.type,
        allocations,
      };
    } catch (error) {
      return handleError(error, 'Error getting rollout results');
    }
  },
});

// ============================================================================
// GET /agents/:agentId/rollouts — List rollout history
// ============================================================================

export const LIST_ROLLOUTS_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/rollouts',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: agentRolloutPathParams,
  queryParamSchema: listRolloutsQuerySchema,
  responseSchema: listRolloutsResponseSchema,
  summary: 'List rollout history',
  description: 'Returns a paginated list of past and current rollouts for an agent.',
  tags: ['Agent Rollouts'],
  handler: async ({ mastra, agentId, page, perPage }) => {
    try {
      const rolloutsStore = await getRolloutsStore(mastra);

      const result = await rolloutsStore.listRollouts({
        agentId,
        pagination: { page: page ?? 0, perPage: perPage ?? 20 },
      });

      return {
        rollouts: result.rollouts,
        total: result.pagination.total,
        page: result.pagination.page,
        perPage: typeof result.pagination.perPage === 'number' ? result.pagination.perPage : 0,
      };
    } catch (error) {
      return handleError(error, 'Error listing rollouts');
    }
  },
});

// ============================================================================
// Route Collection
// ============================================================================

export const AGENT_ROLLOUT_ROUTES: ServerRoute[] = [
  GET_ROLLOUT_ROUTE,
  START_ROLLOUT_ROUTE,
  UPDATE_ROLLOUT_ROUTE,
  PROMOTE_ROLLOUT_ROUTE,
  ROLLBACK_ROLLOUT_ROUTE,
  CANCEL_ROLLOUT_ROUTE,
  GET_ROLLOUT_RESULTS_ROUTE,
  LIST_ROLLOUTS_ROUTE,
];
