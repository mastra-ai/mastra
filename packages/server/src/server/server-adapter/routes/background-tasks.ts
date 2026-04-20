import {
  BACKGROUND_TASK_STREAM_ROUTE,
  GET_BACKGROUND_TASK_ROUTE,
  LIST_BACKGROUND_TASKS_ROUTE,
} from '../../handlers/background-tasks';
import type { ServerRoute } from '.';

export const BACKGROUND_TASK_ROUTES: ServerRoute<any, any, any>[] = [
  BACKGROUND_TASK_STREAM_ROUTE,
  LIST_BACKGROUND_TASKS_ROUTE,
  GET_BACKGROUND_TASK_ROUTE,
];
