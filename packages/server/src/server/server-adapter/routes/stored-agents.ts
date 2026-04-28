import {
  LIST_AGENT_VERSIONS_ROUTE,
  CREATE_AGENT_VERSION_ROUTE,
  GET_AGENT_VERSION_ROUTE,
  ACTIVATE_AGENT_VERSION_ROUTE,
  RESTORE_AGENT_VERSION_ROUTE,
  DELETE_AGENT_VERSION_ROUTE,
  COMPARE_AGENT_VERSIONS_ROUTE,
} from '../../handlers/agent-versions';
import { STAR_STORED_AGENT_ROUTE, UNSTAR_STORED_AGENT_ROUTE } from '../../handlers/stored-agent-stars';
import {
  LIST_STORED_AGENTS_ROUTE,
  GET_STORED_AGENT_ROUTE,
  CREATE_STORED_AGENT_ROUTE,
  UPDATE_STORED_AGENT_ROUTE,
  DELETE_STORED_AGENT_ROUTE,
  PREVIEW_INSTRUCTIONS_ROUTE,
} from '../../handlers/stored-agents';
import type { ServerRoute } from '.';

/**
 * Routes for stored agents CRUD operations and version management.
 * These routes provide API access to agent configurations stored in the database,
 * enabling dynamic creation and management of agents via Mastra Studio.
 */
export const STORED_AGENTS_ROUTES: readonly ServerRoute[] = [
  // ============================================================================
  // Stored Agents CRUD Routes
  // IMPORTANT: Routes with literal paths (e.g., /preview-instructions) must come
  // BEFORE routes with path parameters (e.g., /:storedAgentId) to ensure correct matching.
  // ============================================================================
  LIST_STORED_AGENTS_ROUTE,
  PREVIEW_INSTRUCTIONS_ROUTE, // Must be before GET_STORED_AGENT_ROUTE
  GET_STORED_AGENT_ROUTE,
  CREATE_STORED_AGENT_ROUTE,
  UPDATE_STORED_AGENT_ROUTE,
  DELETE_STORED_AGENT_ROUTE,

  // ============================================================================
  // Agent Versions Routes
  // IMPORTANT: Routes with literal paths (e.g., /compare) must come BEFORE
  // routes with path parameters (e.g., /:versionId) to ensure correct matching.
  // ============================================================================
  LIST_AGENT_VERSIONS_ROUTE,
  CREATE_AGENT_VERSION_ROUTE,
  COMPARE_AGENT_VERSIONS_ROUTE, // Must be before GET_AGENT_VERSION_ROUTE
  GET_AGENT_VERSION_ROUTE,
  ACTIVATE_AGENT_VERSION_ROUTE,
  RESTORE_AGENT_VERSION_ROUTE,
  DELETE_AGENT_VERSION_ROUTE,

  // ============================================================================
  // Stars (EE)
  // ============================================================================
  STAR_STORED_AGENT_ROUTE,
  UNSTAR_STORED_AGENT_ROUTE,
];

/**
 * Type-level tuple preserving each stored agent route's specific schema types.
 * Used by ServerRoutes to build the type-level route map.
 */
export type StoredAgentRoutes = readonly [
  typeof LIST_STORED_AGENTS_ROUTE,
  typeof PREVIEW_INSTRUCTIONS_ROUTE,
  typeof GET_STORED_AGENT_ROUTE,
  typeof CREATE_STORED_AGENT_ROUTE,
  typeof UPDATE_STORED_AGENT_ROUTE,
  typeof DELETE_STORED_AGENT_ROUTE,
  typeof LIST_AGENT_VERSIONS_ROUTE,
  typeof CREATE_AGENT_VERSION_ROUTE,
  typeof COMPARE_AGENT_VERSIONS_ROUTE,
  typeof GET_AGENT_VERSION_ROUTE,
  typeof ACTIVATE_AGENT_VERSION_ROUTE,
  typeof RESTORE_AGENT_VERSION_ROUTE,
  typeof DELETE_AGENT_VERSION_ROUTE,
  typeof STAR_STORED_AGENT_ROUTE,
  typeof UNSTAR_STORED_AGENT_ROUTE,
];
