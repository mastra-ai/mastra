import { HTTPException } from '../http-exception';
import {
  storedScorerIdPathParams,
  agentIdPathParams,
  agentScorerPathParams,
  assignmentIdPathParams,
  listStoredScorersQuerySchema,
  listAgentScorerAssignmentsQuerySchema,
  createStoredScorerBodySchema,
  updateStoredScorerBodySchema,
  assignScorerToAgentBodySchema,
  updateAgentScorerAssignmentBodySchema,
  listStoredScorersResponseSchema,
  getStoredScorerResponseSchema,
  createStoredScorerResponseSchema,
  updateStoredScorerResponseSchema,
  deleteStoredScorerResponseSchema,
  listAgentScorerAssignmentsResponseSchema,
  assignScorerToAgentResponseSchema,
  updateAgentScorerAssignmentResponseSchema,
  unassignScorerFromAgentResponseSchema,
} from '../schemas/stored-scorers';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

// ============================================================================
// Stored Scorers CRUD Routes
// ============================================================================

/**
 * GET /api/stored/scorers - List all stored scorers
 */
export const LIST_STORED_SCORERS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/stored/scorers',
  responseType: 'json',
  queryParamSchema: listStoredScorersQuerySchema,
  responseSchema: listStoredScorersResponseSchema,
  summary: 'List stored scorers',
  description: 'Returns a paginated list of all scorer definitions stored in the database',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, page, perPage, orderBy }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const storedScorersStore = await storage.getStore('storedScorers');
      if (!storedScorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      const result = await storedScorersStore.listScorers({
        page,
        perPage,
        orderBy,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing stored scorers');
    }
  },
});

/**
 * GET /api/stored/scorers/:storedScorerId - Get a stored scorer by ID
 */
export const GET_STORED_SCORER_ROUTE = createRoute({
  method: 'GET',
  path: '/api/stored/scorers/:storedScorerId',
  responseType: 'json',
  pathParamSchema: storedScorerIdPathParams,
  responseSchema: getStoredScorerResponseSchema,
  summary: 'Get stored scorer by ID',
  description: 'Returns a specific scorer definition from storage by its unique identifier',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, storedScorerId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const storedScorersStore = await storage.getStore('storedScorers');
      if (!storedScorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      const scorer = await storedScorersStore.getScorerById({ id: storedScorerId });

      if (!scorer) {
        throw new HTTPException(404, { message: `Stored scorer with id ${storedScorerId} not found` });
      }

      return scorer;
    } catch (error) {
      return handleError(error, 'Error getting stored scorer');
    }
  },
});

/**
 * POST /api/stored/scorers - Create a new stored scorer
 */
export const CREATE_STORED_SCORER_ROUTE = createRoute({
  method: 'POST',
  path: '/api/stored/scorers',
  responseType: 'json',
  bodySchema: createStoredScorerBodySchema,
  responseSchema: createStoredScorerResponseSchema,
  summary: 'Create stored scorer',
  description: 'Creates a new scorer definition in storage with the provided configuration',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, id, name, description, type, judge, steps, sampling, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const storedScorersStore = await storage.getStore('storedScorers');
      if (!storedScorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Check if scorer with this ID already exists
      const existing = await storedScorersStore.getScorerById({ id });
      if (existing) {
        throw new HTTPException(409, { message: `Scorer with id ${id} already exists` });
      }

      const scorer = await storedScorersStore.createScorer({
        scorer: {
          id,
          name,
          description,
          type,
          judge,
          steps,
          sampling,
          metadata,
        },
      });

      return scorer;
    } catch (error) {
      return handleError(error, 'Error creating stored scorer');
    }
  },
});

/**
 * PATCH /api/stored/scorers/:storedScorerId - Update a stored scorer
 */
export const UPDATE_STORED_SCORER_ROUTE = createRoute({
  method: 'PATCH',
  path: '/api/stored/scorers/:storedScorerId',
  responseType: 'json',
  pathParamSchema: storedScorerIdPathParams,
  bodySchema: updateStoredScorerBodySchema,
  responseSchema: updateStoredScorerResponseSchema,
  summary: 'Update stored scorer',
  description: 'Updates an existing scorer definition in storage with the provided fields',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, storedScorerId, name, description, type, judge, steps, sampling, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const storedScorersStore = await storage.getStore('storedScorers');
      if (!storedScorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Check if scorer exists
      const existing = await storedScorersStore.getScorerById({ id: storedScorerId });
      if (!existing) {
        throw new HTTPException(404, { message: `Stored scorer with id ${storedScorerId} not found` });
      }

      const scorer = await storedScorersStore.updateScorer({
        id: storedScorerId,
        name,
        description,
        type,
        judge,
        steps,
        sampling,
        metadata,
      });

      return scorer;
    } catch (error) {
      return handleError(error, 'Error updating stored scorer');
    }
  },
});

/**
 * DELETE /api/stored/scorers/:storedScorerId - Delete a stored scorer
 */
export const DELETE_STORED_SCORER_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/stored/scorers/:storedScorerId',
  responseType: 'json',
  pathParamSchema: storedScorerIdPathParams,
  responseSchema: deleteStoredScorerResponseSchema,
  summary: 'Delete stored scorer',
  description: 'Deletes a scorer definition from storage by its unique identifier. Also removes any agent assignments.',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, storedScorerId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const storedScorersStore = await storage.getStore('storedScorers');
      if (!storedScorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Check if scorer exists
      const existing = await storedScorersStore.getScorerById({ id: storedScorerId });
      if (!existing) {
        throw new HTTPException(404, { message: `Stored scorer with id ${storedScorerId} not found` });
      }

      await storedScorersStore.deleteScorer({ id: storedScorerId });

      return { success: true, message: `Scorer ${storedScorerId} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting stored scorer');
    }
  },
});

// ============================================================================
// Agent-Scorer Assignment Routes
// ============================================================================

/**
 * GET /api/stored/scorers/agents/:agentId/assignments - List scorer assignments for an agent
 */
export const LIST_AGENT_SCORER_ASSIGNMENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/stored/scorers/agents/:agentId/assignments',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  queryParamSchema: listAgentScorerAssignmentsQuerySchema,
  responseSchema: listAgentScorerAssignmentsResponseSchema,
  summary: 'List agent scorer assignments',
  description: 'Returns a paginated list of scorer assignments for a specific agent',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, agentId, page, perPage, enabledOnly }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const storedScorersStore = await storage.getStore('storedScorers');
      if (!storedScorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      const result = await storedScorersStore.listAgentScorerAssignments({
        agentId,
        page,
        perPage,
        enabledOnly,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing agent scorer assignments');
    }
  },
});

/**
 * POST /api/stored/scorers/agents/:agentId/assignments - Assign a scorer to an agent
 */
export const ASSIGN_SCORER_TO_AGENT_ROUTE = createRoute({
  method: 'POST',
  path: '/api/stored/scorers/agents/:agentId/assignments',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: assignScorerToAgentBodySchema,
  responseSchema: assignScorerToAgentResponseSchema,
  summary: 'Assign scorer to agent',
  description: 'Creates a new assignment linking a stored scorer to an agent',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, agentId, scorerId, sampling, enabled, priority, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const storedScorersStore = await storage.getStore('storedScorers');
      if (!storedScorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      const assignment = await storedScorersStore.assignScorerToAgent({
        agentId,
        scorerId,
        sampling,
        enabled: enabled ?? true,
        priority,
        metadata,
      });

      return assignment;
    } catch (error) {
      return handleError(error, 'Error assigning scorer to agent');
    }
  },
});

/**
 * PATCH /api/stored/scorers/assignments/:assignmentId - Update an agent-scorer assignment
 */
export const UPDATE_AGENT_SCORER_ASSIGNMENT_ROUTE = createRoute({
  method: 'PATCH',
  path: '/api/stored/scorers/assignments/:assignmentId',
  responseType: 'json',
  pathParamSchema: assignmentIdPathParams,
  bodySchema: updateAgentScorerAssignmentBodySchema,
  responseSchema: updateAgentScorerAssignmentResponseSchema,
  summary: 'Update agent scorer assignment',
  description: 'Updates an existing agent-scorer assignment',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, assignmentId, sampling, enabled, priority, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const storedScorersStore = await storage.getStore('storedScorers');
      if (!storedScorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Check if assignment exists
      const existing = await storedScorersStore.getAssignmentById({ id: assignmentId });
      if (!existing) {
        throw new HTTPException(404, { message: `Assignment with id ${assignmentId} not found` });
      }

      const assignment = await storedScorersStore.updateAgentScorerAssignment({
        id: assignmentId,
        sampling,
        enabled,
        priority,
        metadata,
      });

      return assignment;
    } catch (error) {
      return handleError(error, 'Error updating agent scorer assignment');
    }
  },
});

/**
 * DELETE /api/stored/scorers/agents/:agentId/scorers/:scorerId - Unassign a scorer from an agent
 */
export const UNASSIGN_SCORER_FROM_AGENT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/stored/scorers/agents/:agentId/scorers/:scorerId',
  responseType: 'json',
  pathParamSchema: agentScorerPathParams,
  responseSchema: unassignScorerFromAgentResponseSchema,
  summary: 'Unassign scorer from agent',
  description: 'Removes a scorer assignment from an agent',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, agentId, scorerId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const storedScorersStore = await storage.getStore('storedScorers');
      if (!storedScorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      await storedScorersStore.unassignScorerFromAgent({ agentId, scorerId });

      return { success: true, message: `Scorer ${scorerId} unassigned from agent ${agentId} successfully` };
    } catch (error) {
      return handleError(error, 'Error unassigning scorer from agent');
    }
  },
});
