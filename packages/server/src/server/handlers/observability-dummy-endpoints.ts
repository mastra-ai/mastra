import { z } from 'zod';
import { HTTPException } from '../http-exception';
import type { ServerRoute } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import { NEW_OBSERVABILITY_UPGRADE_MESSAGE, NEW_ROUTE_DEFS } from './observability-shared';

function createDummyRoute<TMethod extends ServerRoute['method'], TPath extends string>(config: {
  method: TMethod;
  path: TPath;
  summary: string;
  description: string;
  requiresPermission?: ServerRoute['requiresPermission'];
}) {
  return createRoute({
    method: config.method,
    path: config.path,
    responseType: 'json',
    responseSchema: z.object({ message: z.string() }),
    summary: config.summary,
    description: config.description,
    tags: ['Observability'],
    requiresAuth: true,
    requiresPermission: config.requiresPermission,
    handler: async () => {
      throw new HTTPException(501, { message: NEW_OBSERVABILITY_UPGRADE_MESSAGE });
    },
  });
}

export const DUMMY_ROUTES = {
  LIST_LOGS: createDummyRoute(NEW_ROUTE_DEFS.LIST_LOGS),
  LIST_SCORES: createDummyRoute(NEW_ROUTE_DEFS.LIST_SCORES),
  CREATE_SCORE: createDummyRoute(NEW_ROUTE_DEFS.CREATE_SCORE),
  LIST_FEEDBACK: createDummyRoute(NEW_ROUTE_DEFS.LIST_FEEDBACK),
  CREATE_FEEDBACK: createDummyRoute(NEW_ROUTE_DEFS.CREATE_FEEDBACK),
  GET_METRIC_AGGREGATE: createDummyRoute(NEW_ROUTE_DEFS.GET_METRIC_AGGREGATE),
  GET_METRIC_BREAKDOWN: createDummyRoute(NEW_ROUTE_DEFS.GET_METRIC_BREAKDOWN),
  GET_METRIC_TIME_SERIES: createDummyRoute(NEW_ROUTE_DEFS.GET_METRIC_TIME_SERIES),
  GET_METRIC_PERCENTILES: createDummyRoute(NEW_ROUTE_DEFS.GET_METRIC_PERCENTILES),
  GET_METRIC_NAMES: createDummyRoute(NEW_ROUTE_DEFS.GET_METRIC_NAMES),
  GET_METRIC_LABEL_KEYS: createDummyRoute(NEW_ROUTE_DEFS.GET_METRIC_LABEL_KEYS),
  GET_METRIC_LABEL_VALUES: createDummyRoute(NEW_ROUTE_DEFS.GET_METRIC_LABEL_VALUES),
  GET_ENTITY_TYPES: createDummyRoute(NEW_ROUTE_DEFS.GET_ENTITY_TYPES),
  GET_ENTITY_NAMES: createDummyRoute(NEW_ROUTE_DEFS.GET_ENTITY_NAMES),
  GET_SERVICE_NAMES: createDummyRoute(NEW_ROUTE_DEFS.GET_SERVICE_NAMES),
  GET_ENVIRONMENTS: createDummyRoute(NEW_ROUTE_DEFS.GET_ENVIRONMENTS),
  GET_TAGS: createDummyRoute(NEW_ROUTE_DEFS.GET_TAGS),
};
