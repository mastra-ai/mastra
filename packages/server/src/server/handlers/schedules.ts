import { HTTPException } from '../http-exception';
import {
  listSchedulesQuerySchema,
  listSchedulesResponseSchema,
  scheduleIdPathParams,
  scheduleResponseSchema,
  listScheduleTriggersQuerySchema,
  listScheduleTriggersResponseSchema,
} from '../schemas/schedules';
import { createRoute } from '../server-adapter/routes/route-builder';

export const LIST_SCHEDULES_ROUTE = createRoute({
  method: 'GET',
  path: '/schedules',
  responseType: 'json' as const,
  queryParamSchema: listSchedulesQuerySchema,
  responseSchema: listSchedulesResponseSchema,
  summary: 'List workflow schedules',
  description: 'Returns the configured schedules, optionally filtered by workflowId or status.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, status }) => {
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      // Schedules domain not configured — there are no schedules to return.
      return { schedules: [] };
    }
    const schedules = await schedulesStore.listSchedules({ workflowId, status });
    return { schedules };
  },
});

export const GET_SCHEDULE_ROUTE = createRoute({
  method: 'GET',
  path: '/schedules/:scheduleId',
  responseType: 'json' as const,
  pathParamSchema: scheduleIdPathParams,
  responseSchema: scheduleResponseSchema,
  summary: 'Get a workflow schedule by ID',
  description: 'Returns a single schedule row by its storage id.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, scheduleId }) => {
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      throw new HTTPException(404, { message: 'Schedule not found' });
    }
    const schedule = await schedulesStore.getSchedule(scheduleId);
    if (!schedule) {
      throw new HTTPException(404, { message: 'Schedule not found' });
    }
    return schedule;
  },
});

export const LIST_SCHEDULE_TRIGGERS_ROUTE = createRoute({
  method: 'GET',
  path: '/schedules/:scheduleId/triggers',
  responseType: 'json' as const,
  pathParamSchema: scheduleIdPathParams,
  queryParamSchema: listScheduleTriggersQuerySchema,
  responseSchema: listScheduleTriggersResponseSchema,
  summary: 'List trigger history for a schedule',
  description: 'Returns the audit trail of trigger attempts for a schedule, ordered by actualFireAt descending.',
  tags: ['Schedules'],
  requiresAuth: true,
  handler: async ({ mastra, scheduleId, limit, fromActualFireAt, toActualFireAt }) => {
    const schedulesStore = await mastra.getStorage()?.getStore('schedules');
    if (!schedulesStore) {
      return { triggers: [] };
    }
    const triggers = await schedulesStore.listTriggers(scheduleId, { limit, fromActualFireAt, toActualFireAt });
    return { triggers };
  },
});
