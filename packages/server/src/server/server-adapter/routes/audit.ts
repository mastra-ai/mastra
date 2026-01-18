import { GET_AUDIT_EVENTS_ROUTE, GET_AUDIT_EVENT_BY_ID_ROUTE, GET_AUDIT_EXPORT_ROUTE } from '../../handlers/audit';

/**
 * Audit Routes
 *
 * Routes for audit log access and export.
 * Requires audit:read permission for access.
 */
export const AUDIT_ROUTES = [GET_AUDIT_EVENTS_ROUTE, GET_AUDIT_EVENT_BY_ID_ROUTE, GET_AUDIT_EXPORT_ROUTE] as const;
