import {
  DELETE_DYNAMIC_WORKFLOW_ROUTE,
  GET_DYNAMIC_WORKFLOW_ROUTE,
  LIST_DYNAMIC_WORKFLOWS_ROUTE,
  UPSERT_DYNAMIC_WORKFLOW_ROUTE,
} from '../../handlers/dynamic-workflows';
import type { ServerRoute } from '.';

/**
 * Routes for dynamic workflow definitions: list / get / upsert / delete.
 * Upsert is the path the chat-driven workflow-builder agent (and Studio's
 * future "Save" button) uses to persist + live-register a workflow without
 * a server restart.
 */
export const DYNAMIC_WORKFLOWS_ROUTES: readonly ServerRoute[] = [
  LIST_DYNAMIC_WORKFLOWS_ROUTE,
  UPSERT_DYNAMIC_WORKFLOW_ROUTE,
  GET_DYNAMIC_WORKFLOW_ROUTE, // After UPSERT (POST) since both are on the same /stored/workflows base
  DELETE_DYNAMIC_WORKFLOW_ROUTE,
];

export type DynamicWorkflowRoutes = readonly [
  typeof LIST_DYNAMIC_WORKFLOWS_ROUTE,
  typeof UPSERT_DYNAMIC_WORKFLOW_ROUTE,
  typeof GET_DYNAMIC_WORKFLOW_ROUTE,
  typeof DELETE_DYNAMIC_WORKFLOW_ROUTE,
];
