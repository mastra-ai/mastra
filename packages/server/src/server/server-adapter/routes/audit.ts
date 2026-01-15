import { LIST_AUDIT_EVENTS_ROUTE, GET_AUDIT_EVENT_ROUTE } from '../../handlers/audit';
import type { ServerRoute } from '.';

export const AUDIT_ROUTES: ServerRoute<any, any, any>[] = [LIST_AUDIT_EVENTS_ROUTE, GET_AUDIT_EVENT_ROUTE];
