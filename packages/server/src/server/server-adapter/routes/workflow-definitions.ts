import {
  LIST_WORKFLOW_DEFINITIONS_ROUTE,
  CREATE_WORKFLOW_DEFINITION_ROUTE,
  GET_WORKFLOW_DEFINITION_ROUTE,
  UPDATE_WORKFLOW_DEFINITION_ROUTE,
  DELETE_WORKFLOW_DEFINITION_ROUTE,
} from '../../handlers/workflow-definitions';
import type { ServerRoute } from '.';

/**
 * Routes for workflow definitions CRUD operations.
 * These routes provide API access to workflow definitions stored in the database,
 * enabling dynamic creation and management of workflows via Mastra Studio.
 */
export const WORKFLOW_DEFINITIONS_ROUTES: ServerRoute<any, any, any>[] = [
  // ============================================================================
  // Workflow Definitions CRUD Routes
  // ============================================================================
  LIST_WORKFLOW_DEFINITIONS_ROUTE,
  GET_WORKFLOW_DEFINITION_ROUTE,
  CREATE_WORKFLOW_DEFINITION_ROUTE,
  UPDATE_WORKFLOW_DEFINITION_ROUTE,
  DELETE_WORKFLOW_DEFINITION_ROUTE,
];

export {
  LIST_WORKFLOW_DEFINITIONS_ROUTE,
  CREATE_WORKFLOW_DEFINITION_ROUTE,
  GET_WORKFLOW_DEFINITION_ROUTE,
  UPDATE_WORKFLOW_DEFINITION_ROUTE,
  DELETE_WORKFLOW_DEFINITION_ROUTE,
};
