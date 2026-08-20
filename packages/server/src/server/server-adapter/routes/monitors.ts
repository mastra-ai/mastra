import {
  LIST_MONITORS_ROUTE,
  EVALUATE_MONITORS_ROUTE,
  CREATE_MONITOR_ROUTE,
  GET_MONITOR_ROUTE,
  UPDATE_MONITOR_ROUTE,
  DELETE_MONITOR_ROUTE,
  LIST_MONITOR_EVENTS_ROUTE,
} from '../../handlers/monitors';

export const MONITORS_ROUTES = [
  LIST_MONITORS_ROUTE,
  // Registered before parameterized routes so `/monitors/evaluate` never
  // resolves as `/monitors/:monitorId`.
  EVALUATE_MONITORS_ROUTE,
  CREATE_MONITOR_ROUTE,
  GET_MONITOR_ROUTE,
  UPDATE_MONITOR_ROUTE,
  DELETE_MONITOR_ROUTE,
  LIST_MONITOR_EVENTS_ROUTE,
] as const;
