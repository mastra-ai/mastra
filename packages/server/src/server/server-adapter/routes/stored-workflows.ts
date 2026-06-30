import {
  DELETE_STORED_WORKFLOW_ROUTE,
  GET_STORED_WORKFLOW_ROUTE,
  LIST_STORED_WORKFLOWS_ROUTE,
  UPSERT_STORED_WORKFLOW_ROUTE,
} from '../../handlers/stored-workflows';
import type { ServerRoute } from '.';

/**
 * Routes for stored workflow definitions: list / get / upsert / delete.
 * Upsert is the path the chat-driven workflow-builder agent (and Studio's
 * future "Save" button) uses to persist + live-register a workflow without
 * a server restart.
 */
export const STORED_WORKFLOWS_ROUTES: readonly ServerRoute[] = [
  LIST_STORED_WORKFLOWS_ROUTE,
  UPSERT_STORED_WORKFLOW_ROUTE,
  GET_STORED_WORKFLOW_ROUTE, // After UPSERT (POST) since both are on the same /stored/workflows base
  DELETE_STORED_WORKFLOW_ROUTE,
];

export type StoredWorkflowRoutes = readonly [
  typeof LIST_STORED_WORKFLOWS_ROUTE,
  typeof UPSERT_STORED_WORKFLOW_ROUTE,
  typeof GET_STORED_WORKFLOW_ROUTE,
  typeof DELETE_STORED_WORKFLOW_ROUTE,
];
