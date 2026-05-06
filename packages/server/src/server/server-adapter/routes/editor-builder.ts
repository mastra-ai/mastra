import { GET_EDITOR_BUILDER_SETTINGS_ROUTE, GET_INFRASTRUCTURE_STATUS_ROUTE } from '../../handlers/editor-builder';

/**
 * Editor Builder Routes
 *
 * Routes for agent builder settings and configuration.
 */
export const EDITOR_BUILDER_ROUTES = [GET_EDITOR_BUILDER_SETTINGS_ROUTE, GET_INFRASTRUCTURE_STATUS_ROUTE] as const;
