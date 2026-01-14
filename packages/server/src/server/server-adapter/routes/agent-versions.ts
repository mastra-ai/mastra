import {
  LIST_AGENT_VERSIONS_ROUTE,
  CREATE_AGENT_VERSION_ROUTE,
  GET_AGENT_VERSION_ROUTE,
  ACTIVATE_AGENT_VERSION_ROUTE,
  RESTORE_AGENT_VERSION_ROUTE,
  DELETE_AGENT_VERSION_ROUTE,
  COMPARE_AGENT_VERSIONS_ROUTE,
} from '../../handlers/agent-versions';
import type { ServerRoute } from '.';

/**
 * Routes for agent version management.
 * These routes provide API access to version history for stored agents,
 * enabling versioning, comparison, and rollback capabilities.
 */
export const AGENT_VERSIONS_ROUTES: ServerRoute<any, any, any>[] = [
  // ============================================================================
  // Agent Versions Routes
  // ============================================================================

  // Note: COMPARE route must come before GET with :versionId to avoid path collision
  // /api/stored/agents/:agentId/versions/compare must match before
  // /api/stored/agents/:agentId/versions/:versionId
  COMPARE_AGENT_VERSIONS_ROUTE,

  LIST_AGENT_VERSIONS_ROUTE,
  CREATE_AGENT_VERSION_ROUTE,
  GET_AGENT_VERSION_ROUTE,
  ACTIVATE_AGENT_VERSION_ROUTE,
  RESTORE_AGENT_VERSION_ROUTE,
  DELETE_AGENT_VERSION_ROUTE,
];
