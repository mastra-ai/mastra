import { LIST_PROCESSORS_ROUTE, GET_PROCESSOR_BY_ID_ROUTE, EXECUTE_PROCESSOR_ROUTE } from '../../handlers/processors';
import type { ServerRoute } from '.';

export const PROCESSORS_ROUTES: ServerRoute<any, any, any>[] = [
  LIST_PROCESSORS_ROUTE,
  GET_PROCESSOR_BY_ID_ROUTE,
  EXECUTE_PROCESSOR_ROUTE,
];
