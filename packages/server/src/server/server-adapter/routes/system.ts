import { GET_API_SCHEMA_ROUTE, GET_SYSTEM_PACKAGES_ROUTE } from '../../handlers/system';

/**
 * System Routes
 *
 * Routes for system information and diagnostics.
 */
export const SYSTEM_ROUTES = [GET_SYSTEM_PACKAGES_ROUTE, GET_API_SCHEMA_ROUTE] as const;
