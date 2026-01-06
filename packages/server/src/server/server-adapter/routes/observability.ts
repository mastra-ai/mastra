import {
  LIST_TRACES_ROUTE,
  GET_TRACE_ROUTE,
  SCORE_TRACES_ROUTE,
  LIST_SCORES_BY_SPAN_ROUTE,
  GET_METRICS_ROUTE,
} from '../../handlers/observability';
import type { ServerRoute } from '.';

export const OBSERVABILITY_ROUTES: ServerRoute<any, any, any>[] = [
  LIST_TRACES_ROUTE,
  GET_TRACE_ROUTE,
  SCORE_TRACES_ROUTE,
  LIST_SCORES_BY_SPAN_ROUTE,
  GET_METRICS_ROUTE,
];
