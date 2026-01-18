import { GET_AUDIT_EVENTS_ROUTE, GET_AUDIT_EVENT_BY_ID_ROUTE, GET_AUDIT_EXPORT_ROUTE } from '../../handlers/audit';

/**
 * Audit Routes
 *
 * Routes for audit log access and export.
 * Requires audit:read permission for access.
 *
 * IMPORTANT: Literal routes must be registered before parameterized routes.
 * Otherwise /api/audit/export will be captured by /api/audit/:id as id='export'.
 */
export const AUDIT_ROUTES = [GET_AUDIT_EVENTS_ROUTE, GET_AUDIT_EXPORT_ROUTE, GET_AUDIT_EVENT_BY_ID_ROUTE] as const;
