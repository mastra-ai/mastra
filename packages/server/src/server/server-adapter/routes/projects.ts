import {
  CREATE_PROJECT_ROUTE,
  CREATE_PROJECT_TASK_ROUTE,
  DELETE_PROJECT_ROUTE,
  DELETE_PROJECT_TASK_ROUTE,
  GET_PROJECT_ROUTE,
  INVITE_PROJECT_AGENT_ROUTE,
  LIST_PROJECTS_ROUTE,
  REMOVE_PROJECT_AGENT_ROUTE,
  UPDATE_PROJECT_ROUTE,
  UPDATE_PROJECT_TASK_ROUTE,
} from '../../handlers/projects';

/**
 * Project routes (Agent Studio > Projects).
 *
 * Registered by the server-adapter when `mastra.agentBuilder` is configured.
 * Projects are stored agents with `role: 'supervisor'`; tasks live under
 * `metadata.project.tasks`.
 */
export const PROJECT_ROUTES = [
  LIST_PROJECTS_ROUTE,
  CREATE_PROJECT_ROUTE,
  GET_PROJECT_ROUTE,
  UPDATE_PROJECT_ROUTE,
  DELETE_PROJECT_ROUTE,
  INVITE_PROJECT_AGENT_ROUTE,
  REMOVE_PROJECT_AGENT_ROUTE,
  CREATE_PROJECT_TASK_ROUTE,
  UPDATE_PROJECT_TASK_ROUTE,
  DELETE_PROJECT_TASK_ROUTE,
] as const;
