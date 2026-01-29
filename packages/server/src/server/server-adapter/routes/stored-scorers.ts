import {
  LIST_STORED_SCORERS_ROUTE,
  GET_STORED_SCORER_ROUTE,
  CREATE_STORED_SCORER_ROUTE,
  UPDATE_STORED_SCORER_ROUTE,
  DELETE_STORED_SCORER_ROUTE,
  LIST_SCORER_VERSIONS_ROUTE,
  CREATE_SCORER_VERSION_ROUTE,
  GET_SCORER_VERSION_ROUTE,
  ACTIVATE_SCORER_VERSION_ROUTE,
  RESTORE_SCORER_VERSION_ROUTE,
  DELETE_SCORER_VERSION_ROUTE,
} from '../../handlers/stored-scorers';
import type { ServerRoute } from '.';

/**
 * Routes for stored scorers CRUD operations and version management.
 * These routes provide API access to scorer configurations stored in the database,
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
  // Scorer Version Routes
  // ============================================================================
  LIST_SCORER_VERSIONS_ROUTE,
  CREATE_SCORER_VERSION_ROUTE,
  GET_SCORER_VERSION_ROUTE,
  ACTIVATE_SCORER_VERSION_ROUTE,
  RESTORE_SCORER_VERSION_ROUTE,
  DELETE_SCORER_VERSION_ROUTE,
];
