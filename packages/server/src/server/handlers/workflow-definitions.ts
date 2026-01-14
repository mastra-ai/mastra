import { HTTPException } from '../http-exception';
import {
  workflowDefinitionIdPathParams,
  listWorkflowDefinitionsQuerySchema,
  createWorkflowDefinitionBodySchema,
  updateWorkflowDefinitionBodySchema,
  listWorkflowDefinitionsResponseSchema,
  getWorkflowDefinitionResponseSchema,
  createWorkflowDefinitionResponseSchema,
  updateWorkflowDefinitionResponseSchema,
  deleteWorkflowDefinitionResponseSchema,
} from '../schemas/workflow-definitions';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';
import { handleAutoVersioning } from './workflow-definition-versions';

import type { Context } from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates that all referenced agents, tools, and workflows exist.
 * @param mastra - The Mastra instance
 * @param definition - The workflow definition to validate
 * @returns Array of validation error messages
 */
async function validateWorkflowDefinition(
  mastra: Context['mastra'],
  definition: { steps?: Record<string, any>; stepGraph?: any[] },
): Promise<string[]> {
  const errors: string[] = [];

  if (!definition.steps) return errors;

  for (const [stepId, stepDef] of Object.entries(definition.steps)) {
    switch (stepDef.type) {
      case 'agent': {
        // First try to get from registered agents
        let agentFound = false;
        try {
          const agent = mastra.getAgentById?.(stepDef.agentId);
          if (agent) {
            agentFound = true;
          }
        } catch {
          // Agent not found in registered agents, try storage
        }

        if (!agentFound) {
          try {
            const storage = mastra.getStorage();
            if (storage) {
              const agentsStore = await storage.getStore('agents');
              if (agentsStore) {
                const stored = await agentsStore.getAgentById?.({ id: stepDef.agentId });
                if (stored) {
                  agentFound = true;
                }
              }
            }
          } catch {
            // Agent not found in storage either
          }
        }

        if (!agentFound) {
          errors.push(`Step "${stepId}": Agent "${stepDef.agentId}" not found`);
        }
        break;
      }
      case 'tool': {
        let toolFound = false;

        // Check globally registered tools
        try {
          const tool = mastra.getToolById?.(stepDef.toolId);
          if (tool) {
            toolFound = true;
          }
        } catch {
          // Tool not found by ID
        }

        if (!toolFound) {
          try {
            const tool = mastra.getTool?.(stepDef.toolId);
            if (tool) {
              toolFound = true;
            }
          } catch {
            // Tool not found by name
          }
        }

        // Check agent tools if not found globally
        if (!toolFound) {
          const agents = mastra.listAgents?.() || {};
          for (const agent of Object.values(agents)) {
            try {
              const agentTools = await agent.listTools?.();
              if (
                agentTools &&
                (agentTools[stepDef.toolId] || Object.values(agentTools).some((t: any) => t.id === stepDef.toolId))
              ) {
                toolFound = true;
                break;
              }
            } catch {
              // Error getting agent tools
            }
          }
        }

        if (!toolFound) {
          errors.push(`Step "${stepId}": Tool "${stepDef.toolId}" not found`);
        }
        break;
      }
      case 'workflow': {
        // First try to get from registered workflows
        let workflowFound = false;
        try {
          const workflow = mastra.getWorkflow?.(stepDef.workflowId);
          if (workflow) {
            workflowFound = true;
          }
        } catch {
          // Workflow not found in registered workflows
        }

        // Could also check stored workflow definitions, but skip for now
        // to avoid circular dependencies
        if (!workflowFound) {
          errors.push(`Step "${stepId}": Workflow "${stepDef.workflowId}" not found`);
        }
        break;
      }
    }
  }

  // Validate stepGraph references valid step IDs
  if (definition.stepGraph) {
    for (const entry of definition.stepGraph) {
      if (entry.type === 'step' && definition.steps && !definition.steps[entry.step?.id]) {
        errors.push(`Step graph references unknown step "${entry.step?.id}"`);
      }
    }
  }

  return errors;
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /api/workflow-definitions - List all workflow definitions
 */
export const LIST_WORKFLOW_DEFINITIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workflow-definitions',
  responseType: 'json',
  queryParamSchema: listWorkflowDefinitionsQuerySchema,
  responseSchema: listWorkflowDefinitionsResponseSchema,
  summary: 'List workflow definitions',
  description: 'Returns a paginated list of stored workflow definitions',
  tags: ['Workflow Definitions'],
  handler: async ({ mastra, page, perPage, orderBy, ownerId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const workflowDefinitionsStore = await storage.getStore('workflowDefinitions');
      if (!workflowDefinitionsStore) {
        throw new HTTPException(500, { message: 'Workflow definitions storage domain is not available' });
      }

      const result = await workflowDefinitionsStore.listWorkflowDefinitions({
        page,
        perPage,
        orderBy,
        ownerId,
      });

      return {
        definitions: result.definitions.map((def: any) => ({
          ...def,
          createdAt: def.createdAt instanceof Date ? def.createdAt.toISOString() : def.createdAt,
          updatedAt: def.updatedAt instanceof Date ? def.updatedAt.toISOString() : def.updatedAt,
        })),
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        hasMore: result.hasMore,
      };
    } catch (error) {
      return handleError(error, 'Error listing workflow definitions');
    }
  },
});

/**
 * GET /api/workflow-definitions/:workflowDefinitionId - Get a workflow definition by ID
 */
export const GET_WORKFLOW_DEFINITION_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workflow-definitions/:workflowDefinitionId',
  responseType: 'json',
  pathParamSchema: workflowDefinitionIdPathParams,
  responseSchema: getWorkflowDefinitionResponseSchema,
  summary: 'Get workflow definition by ID',
  description: 'Returns a specific workflow definition from storage by its unique identifier',
  tags: ['Workflow Definitions'],
  handler: async ({ mastra, workflowDefinitionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const workflowDefinitionsStore = await storage.getStore('workflowDefinitions');
      if (!workflowDefinitionsStore) {
        throw new HTTPException(500, { message: 'Workflow definitions storage domain is not available' });
      }

      const definition = await workflowDefinitionsStore.getWorkflowDefinitionById({ id: workflowDefinitionId });

      if (!definition) {
        throw new HTTPException(404, { message: `Workflow definition with id ${workflowDefinitionId} not found` });
      }

      return {
        ...definition,
        createdAt: definition.createdAt instanceof Date ? definition.createdAt.toISOString() : definition.createdAt,
        updatedAt: definition.updatedAt instanceof Date ? definition.updatedAt.toISOString() : definition.updatedAt,
      };
    } catch (error) {
      return handleError(error, 'Error getting workflow definition');
    }
  },
});

/**
 * POST /api/workflow-definitions - Create a new workflow definition
 */
export const CREATE_WORKFLOW_DEFINITION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflow-definitions',
  responseType: 'json',
  bodySchema: createWorkflowDefinitionBodySchema,
  responseSchema: createWorkflowDefinitionResponseSchema,
  summary: 'Create workflow definition',
  description: 'Creates a new workflow definition in storage with the provided configuration',
  tags: ['Workflow Definitions'],
  handler: async ({
    mastra,
    requestContext,
    id,
    name,
    description,
    inputSchema,
    outputSchema,
    stateSchema,
    stepGraph,
    steps,
    retryConfig,
    metadata,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const workflowDefinitionsStore = await storage.getStore('workflowDefinitions');
      if (!workflowDefinitionsStore) {
        throw new HTTPException(500, { message: 'Workflow definitions storage domain is not available' });
      }

      // Check if workflow definition with this ID already exists
      const existing = await workflowDefinitionsStore.getWorkflowDefinitionById({ id });
      if (existing) {
        throw new HTTPException(409, { message: `Workflow definition with id ${id} already exists` });
      }

      // Validate references exist
      const definitionToValidate = { steps, stepGraph };
      const validationErrors = await validateWorkflowDefinition(mastra, definitionToValidate);
      if (validationErrors.length > 0) {
        throw new HTTPException(400, { message: `Validation failed: ${validationErrors.join(', ')}` });
      }

      // Get ownerId from request context if available
      const ownerId = requestContext?.get?.('ownerId') as string | undefined;

      const definition = await workflowDefinitionsStore.createWorkflowDefinition({
        definition: {
          id,
          name,
          description,
          inputSchema,
          outputSchema,
          stateSchema,
          stepGraph: stepGraph as any, // Type assertion: Zod schema condition types use z.any() for nested conditions
          steps: steps as any, // Type assertion: Zod schema is compatible with storage type
          retryConfig,
          metadata,
          ownerId,
        },
      });

      return {
        ...definition,
        createdAt: definition.createdAt instanceof Date ? definition.createdAt.toISOString() : definition.createdAt,
        updatedAt: definition.updatedAt instanceof Date ? definition.updatedAt.toISOString() : definition.updatedAt,
      };
    } catch (error) {
      return handleError(error, 'Error creating workflow definition');
    }
  },
});

/**
 * PATCH /api/workflow-definitions/:workflowDefinitionId - Update a workflow definition
 */
export const UPDATE_WORKFLOW_DEFINITION_ROUTE = createRoute({
  method: 'PATCH',
  path: '/api/workflow-definitions/:workflowDefinitionId',
  responseType: 'json',
  pathParamSchema: workflowDefinitionIdPathParams,
  bodySchema: updateWorkflowDefinitionBodySchema,
  responseSchema: updateWorkflowDefinitionResponseSchema,
  summary: 'Update workflow definition',
  description: 'Updates an existing workflow definition in storage and auto-creates a version',
  tags: ['Workflow Definitions'],
  handler: async ({
    mastra,
    requestContext,
    workflowDefinitionId,
    name,
    description,
    inputSchema,
    outputSchema,
    stateSchema,
    stepGraph,
    steps,
    retryConfig,
    metadata,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const workflowDefinitionsStore = await storage.getStore('workflowDefinitions');
      if (!workflowDefinitionsStore) {
        throw new HTTPException(500, { message: 'Workflow definitions storage domain is not available' });
      }

      // Check if workflow definition exists
      const existing = await workflowDefinitionsStore.getWorkflowDefinitionById({ id: workflowDefinitionId });
      if (!existing) {
        throw new HTTPException(404, { message: `Workflow definition with id ${workflowDefinitionId} not found` });
      }

      // Validate if steps or stepGraph changed
      if (steps || stepGraph) {
        const toValidate = {
          steps: steps ?? existing.steps,
          stepGraph: stepGraph ?? existing.stepGraph,
        };
        const validationErrors = await validateWorkflowDefinition(mastra, toValidate);
        if (validationErrors.length > 0) {
          throw new HTTPException(400, { message: `Validation failed: ${validationErrors.join(', ')}` });
        }
      }

      // Update the definition
      const updated = await workflowDefinitionsStore.updateWorkflowDefinition({
        id: workflowDefinitionId,
        name,
        description,
        inputSchema,
        outputSchema,
        stateSchema,
        stepGraph: stepGraph as any, // Type assertion: Zod schema condition types use z.any() for nested conditions
        steps: steps as any, // Type assertion: Zod schema is compatible with storage type
        retryConfig,
        metadata,
      });

      // Auto-create version on update
      const createdBy = requestContext?.get?.('userId') as string | undefined;
      await handleAutoVersioning(storage, workflowDefinitionId, existing, updated, createdBy);

      return {
        ...updated,
        createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
        updatedAt: updated.updatedAt instanceof Date ? updated.updatedAt.toISOString() : updated.updatedAt,
      };
    } catch (error) {
      return handleError(error, 'Error updating workflow definition');
    }
  },
});

/**
 * DELETE /api/workflow-definitions/:workflowDefinitionId - Delete a workflow definition
 */
export const DELETE_WORKFLOW_DEFINITION_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/workflow-definitions/:workflowDefinitionId',
  responseType: 'json',
  pathParamSchema: workflowDefinitionIdPathParams,
  responseSchema: deleteWorkflowDefinitionResponseSchema,
  summary: 'Delete workflow definition',
  description: 'Deletes a workflow definition and all its versions from storage',
  tags: ['Workflow Definitions'],
  handler: async ({ mastra, workflowDefinitionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const workflowDefinitionsStore = await storage.getStore('workflowDefinitions');
      if (!workflowDefinitionsStore) {
        throw new HTTPException(500, { message: 'Workflow definitions storage domain is not available' });
      }

      // Check if workflow definition exists
      const existing = await workflowDefinitionsStore.getWorkflowDefinitionById({ id: workflowDefinitionId });
      if (!existing) {
        throw new HTTPException(404, { message: `Workflow definition with id ${workflowDefinitionId} not found` });
      }

      // Delete the workflow definition (cascade deletes versions)
      await workflowDefinitionsStore.deleteWorkflowDefinition({ id: workflowDefinitionId });

      return { success: true, message: `Workflow definition ${workflowDefinitionId} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting workflow definition');
    }
  },
});
