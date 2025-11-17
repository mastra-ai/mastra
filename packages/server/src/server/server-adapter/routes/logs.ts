import { LIST_LOG_TRANSPORTS_ROUTE, LIST_LOGS_ROUTE, LIST_LOGS_BY_RUN_ID_ROUTE } from '../../handlers/logs';
import type { ServerRoute } from '.';

export const LOGS_ROUTES: ServerRoute<any, any, any>[] = [
  LIST_LOG_TRANSPORTS_ROUTE,
  LIST_LOGS_ROUTE,
  LIST_LOGS_BY_RUN_ID_ROUTE,
];
