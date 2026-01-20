import {
  GET_SYSTEM_PACKAGES_ROUTE,
  POST_MIGRATE_SPANS_ROUTE,
  GET_MIGRATION_STATUS_ROUTE,
} from '../../handlers/system';

/**
 * System Routes
 *
 * Routes for system information, diagnostics, and migrations.
 */
export const SYSTEM_ROUTES = [GET_SYSTEM_PACKAGES_ROUTE, POST_MIGRATE_SPANS_ROUTE, GET_MIGRATION_STATUS_ROUTE] as const;
