import {
  LIST_STORED_SCORERS_ROUTE,
  GET_STORED_SCORER_ROUTE,
  CREATE_STORED_SCORER_ROUTE,
  UPDATE_STORED_SCORER_ROUTE,
  DELETE_STORED_SCORER_ROUTE,
} from '../../handlers/stored-scorers';
import type { ServerRoute } from '.';

/**
 * Routes for stored scorers CRUD operations.
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
];
