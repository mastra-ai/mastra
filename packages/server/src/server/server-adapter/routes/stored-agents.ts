import {
  LIST_STORED_AGENTS_ROUTE,
  GET_STORED_AGENT_ROUTE,
  CREATE_STORED_AGENT_ROUTE,
  UPDATE_STORED_AGENT_ROUTE,
  DELETE_STORED_AGENT_ROUTE,
} from '../../handlers/stored-agents';
import type { ServerRoute } from '.';

/**
 * Routes for stored agents CRUD operations.
 * These routes provide API access to agent configurations stored in the database,
 * enabling dynamic creation and management of agents via Mastra Studio.
 */
export const STORED_AGENTS_ROUTES: ServerRoute<any, any, any>[] = [
  // ============================================================================
  // Stored Agents CRUD Routes
  // ============================================================================
  LIST_STORED_AGENTS_ROUTE,
  GET_STORED_AGENT_ROUTE,
  CREATE_STORED_AGENT_ROUTE,
  UPDATE_STORED_AGENT_ROUTE,
  DELETE_STORED_AGENT_ROUTE,
];
