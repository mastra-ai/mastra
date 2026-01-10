import {
  LIST_STORED_SCORERS_ROUTE,
  GET_STORED_SCORER_ROUTE,
  CREATE_STORED_SCORER_ROUTE,
  UPDATE_STORED_SCORER_ROUTE,
  DELETE_STORED_SCORER_ROUTE,
  LIST_AGENT_SCORER_ASSIGNMENTS_ROUTE,
  ASSIGN_SCORER_TO_AGENT_ROUTE,
  UPDATE_AGENT_SCORER_ASSIGNMENT_ROUTE,
  UNASSIGN_SCORER_FROM_AGENT_ROUTE,
} from '../../handlers/stored-scorers';
import type { ServerRoute } from '.';

/**
 * Routes for stored scorers CRUD operations and agent-scorer assignments.
 * These routes provide API access to scorer definitions stored in the database,
 * enabling dynamic creation and management of scorers via Mastra Studio.
 */
export const STORED_SCORERS_ROUTES: ServerRoute<any, any, any>[] = [
  // ============================================================================
  // Stored Scorers CRUD Routes
  // ============================================================================
  LIST_STORED_SCORERS_ROUTE,
  GET_STORED_SCORER_ROUTE,
  CREATE_STORED_SCORER_ROUTE,
  UPDATE_STORED_SCORER_ROUTE,
  DELETE_STORED_SCORER_ROUTE,

  // ============================================================================
  // Agent-Scorer Assignment Routes
  // ============================================================================
  LIST_AGENT_SCORER_ASSIGNMENTS_ROUTE,
  ASSIGN_SCORER_TO_AGENT_ROUTE,
  UPDATE_AGENT_SCORER_ASSIGNMENT_ROUTE,
  UNASSIGN_SCORER_FROM_AGENT_ROUTE,
];
