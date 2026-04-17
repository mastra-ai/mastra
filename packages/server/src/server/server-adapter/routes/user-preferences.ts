import { GET_USER_PREFERENCES_ROUTE, UPDATE_USER_PREFERENCES_ROUTE } from '../../handlers/user-preferences';

/**
 * User Preferences Routes
 *
 * Per-user preferences (starred agents/skills, Agent Studio view settings, appearance).
 * Keyed by the authenticated user's id — anonymous requests are rejected.
 */
export const USER_PREFERENCES_ROUTES = [GET_USER_PREFERENCES_ROUTE, UPDATE_USER_PREFERENCES_ROUTE] as const;
