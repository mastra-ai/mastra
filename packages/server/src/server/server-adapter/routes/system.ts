import { GET_SYSTEM_PACKAGES_ROUTE } from '../../handlers/system';
import type { ServerRoute } from '.';

/**
 * System Routes
 *
 * Routes for system information and diagnostics.
 */
export const SYSTEM_ROUTES: ServerRoute<any, any, any>[] = [GET_SYSTEM_PACKAGES_ROUTE];
