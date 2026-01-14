import {
  LIST_DEFINITION_VERSIONS_ROUTE,
  CREATE_DEFINITION_VERSION_ROUTE,
  COMPARE_DEFINITION_VERSIONS_ROUTE,
  GET_DEFINITION_VERSION_ROUTE,
  ACTIVATE_DEFINITION_VERSION_ROUTE,
  DELETE_DEFINITION_VERSION_ROUTE,
} from '../../handlers/workflow-definition-versions';
import type { ServerRoute } from '.';

/**
 * Routes for workflow definition versions operations.
 * These routes provide API access to workflow definition version history,
 * enabling version management, comparison, and rollback capabilities.
 *
 * Route Order Note:
 * The order of routes matters for path matching.
 * COMPARE_DEFINITION_VERSIONS_ROUTE must come before GET_DEFINITION_VERSION_ROUTE
 * because /versions/compare would otherwise match /:versionId
 */
export const WORKFLOW_DEFINITION_VERSIONS_ROUTES: ServerRoute<any, any, any>[] = [
  // ============================================================================
  // Workflow Definition Versions Routes
  // ============================================================================
  LIST_DEFINITION_VERSIONS_ROUTE,
  CREATE_DEFINITION_VERSION_ROUTE,
  COMPARE_DEFINITION_VERSIONS_ROUTE, // Before GET - /compare before /:versionId
  GET_DEFINITION_VERSION_ROUTE,
  ACTIVATE_DEFINITION_VERSION_ROUTE,
  DELETE_DEFINITION_VERSION_ROUTE,
];

export {
  LIST_DEFINITION_VERSIONS_ROUTE,
  CREATE_DEFINITION_VERSION_ROUTE,
  COMPARE_DEFINITION_VERSIONS_ROUTE,
  GET_DEFINITION_VERSION_ROUTE,
  ACTIVATE_DEFINITION_VERSION_ROUTE,
  DELETE_DEFINITION_VERSION_ROUTE,
};
