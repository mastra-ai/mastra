/**
 * The per-project cron that fires the `factory-environment-build` workflow,
 * kept in core `Schedules` (one row per project) rather than a factory
 * column: the scheduler owns firing, claims and the run trigger log, factory
 * only creates, pauses, resumes and reads the row.
 */

import type { Mastra } from '@mastra/core/mastra';
import type { AnySchedule, Schedules, WorkflowSchedule } from '@mastra/core/schedules';
import { validateCron } from '@mastra/core/workflows';
import { ENVIRONMENT_BUILD_WORKFLOW_ID } from './build-workflow.js';

export const SCHEDULES_UNAVAILABLE_ERROR_ID = 'SCHEDULES_NO_SCHEDULES_STORAGE';

/**
 * The project's schedule id in its stored form. Core normalizes a created
 * id to `schedule_<slug>` and resolves a bare id to `agent_<slug>` on reads,
 * so factory always addresses the row by the normalized id (a project id is
 * a lower-case uuid, which slugifies to itself).
 */
export function scheduleIdFor(projectId: string): string {
  return `schedule_factory-environment-build-${projectId}`;
}

export interface EnvironmentBuildSchedule {
  enabled: boolean;
  cron: string | null;
  timezone: string | null;
}

export type ScheduleService = Pick<Schedules, 'create' | 'get' | 'list' | 'update' | 'pause' | 'resume' | 'delete'>;

function isSchedulesUnavailable(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { id?: unknown }).id === SCHEDULES_UNAVAILABLE_ERROR_ID
  );
}

/**
 * Whether the host's storage implements the schedules domain. `mastra.schedules`
 * never throws on access; the missing store surfaces on the first call.
 */
export async function probeSchedulesAvailable(schedules: ScheduleService): Promise<boolean> {
  try {
    await schedules.list({ workflowId: ENVIRONMENT_BUILD_WORKFLOW_ID });
    return true;
  } catch (error) {
    if (isSchedulesUnavailable(error)) return false;
    throw error;
  }
}

/** `undefined` when the cron parses; otherwise the validator's message. */
export function invalidCronMessage(cron: string, timezone?: string): string | undefined {
  try {
    validateCron(cron, timezone);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function isWorkflowSchedule(schedule: AnySchedule | null): schedule is WorkflowSchedule {
  return schedule !== null && schedule.agentId === undefined;
}

function toView(schedule: WorkflowSchedule | null): EnvironmentBuildSchedule {
  if (!schedule) return { enabled: false, cron: null, timezone: null };
  return { enabled: schedule.status === 'active', cron: schedule.cron, timezone: schedule.timezone ?? null };
}

/** The project's build schedule as the environment reports it. */
export async function readSchedule(schedules: ScheduleService, projectId: string): Promise<EnvironmentBuildSchedule> {
  const schedule = await schedules.get(scheduleIdFor(projectId));
  return toView(isWorkflowSchedule(schedule) ? schedule : null);
}

/**
 * Create, update, pause or resume the project's schedule so it matches
 * `input`. Disabling a project that never had a schedule creates nothing.
 */
export async function ensureSchedule(
  schedules: ScheduleService,
  projectId: string,
  input: { enabled: boolean; cron: string; timezone?: string },
): Promise<EnvironmentBuildSchedule> {
  const id = scheduleIdFor(projectId);
  const existing = await schedules.get(id);
  const current = isWorkflowSchedule(existing) ? existing : null;
  if (!current) {
    if (!input.enabled) return toView(null);
    const created = await schedules.create({
      id,
      workflowId: ENVIRONMENT_BUILD_WORKFLOW_ID,
      cron: input.cron,
      ...(input.timezone ? { timezone: input.timezone } : {}),
      inputData: { projectId, trigger: 'schedule' },
      resourceId: projectId,
    });
    return toView(created);
  }
  const timingChanged = current.cron !== input.cron || (current.timezone ?? undefined) !== input.timezone;
  let next: AnySchedule = current;
  if (timingChanged) {
    next = await schedules.update(current.id, {
      cron: input.cron,
      ...(input.timezone ? { timezone: input.timezone } : {}),
    });
  }
  if (input.enabled && next.status === 'paused') next = await schedules.resume(current.id);
  if (!input.enabled && next.status === 'active') next = await schedules.pause(current.id);
  return toView(isWorkflowSchedule(next) ? next : null);
}

/** The service behind a booted `Mastra`, or `undefined` before the host finished booting. */
export function scheduleServiceOf(mastra: Mastra | undefined): ScheduleService | undefined {
  return mastra?.schedules;
}
