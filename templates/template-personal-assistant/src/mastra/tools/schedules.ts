import { createHash } from 'node:crypto';
import type { Agent } from '@mastra/core/agent';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { AgentSchedule, AnySchedule, ScheduleHooks } from '@mastra/core/schedules';
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { computeNextFireAt, validateCron } from '@mastra/core/workflows';
import { z } from 'zod';
import { explicitTimezone as timezone } from '../config';
import type { AssistantConfig } from '../config';
import { findOwnerThread } from '../context';

const explicitTiming = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cron'), cron: z.string().trim().min(1).max(200), timezone }).strict(),
  z
    .object({
      kind: z.literal('once'),
      date: z
        .string()
        .regex(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/,
          'Use a complete date with seconds and an explicit UTC offset.',
        ),
      timezone,
    })
    .strict(),
]);

// Models sometimes omit the redundant discriminator. Infer it only from one
// unambiguous timing field; explicit invalid kinds and mixed shapes still fail.
const timingFields = z
  .object({
    kind: z.enum(['cron', 'once']).optional().describe('cron for recurring schedules; once for a single date.'),
    cron: z.string().optional().describe('Cron expression for recurring schedules; omit for once.'),
    date: z.string().optional().describe('ISO date with seconds and UTC offset for once; omit for cron.'),
    timezone,
  })
  .strict();
const timingInput = timingFields
  .transform(input => ({
    ...input,
    kind:
      input.kind ??
      (input.cron !== undefined && input.date === undefined
        ? 'cron'
        : input.date !== undefined && input.cron === undefined
          ? 'once'
          : undefined),
  }))
  .pipe(explicitTiming);

export const scheduleTiming = timingInput.transform((input, context) => {
  try {
    if (input.kind === 'cron') {
      validateCron(input.cron, input.timezone);
      requireSafeCadence(input.cron);
      return { cron: input.cron, timezone: input.timezone };
    }
    const instant = Date.parse(input.date);
    if (!Number.isFinite(instant)) throw new Error('Choose a valid calendar date.');
    const local = input.date.slice(0, 19);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: input.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)!.value;
    const actual = `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
    if (actual !== local)
      throw new Error(
        'The calendar date or UTC offset does not match this timezone. Choose an explicit valid date and offset.',
      );
    const cron = `${part('second')} ${part('minute')} ${part('hour')} ${part('day')} ${part('month')} * ${part('year')}`;
    validateCron(cron, input.timezone);
    if (computeNextFireAt(cron, { timezone: input.timezone, after: instant - 1000 }) !== instant)
      throw new Error(
        'The native scheduler cannot represent this offset choice. Choose a different explicit date and offset.',
      );
    return { cron, timezone: input.timezone, date: input.date };
  } catch (error) {
    context.addIssue({
      code: 'custom',
      message: error instanceof Error ? error.message : 'Invalid schedule timing.',
    });
    return z.NEVER;
  }
});

/** Identify invalid stored cadence separately from unavailable schedule dependencies. */
class UnsafeScheduleCadenceError extends Error {}

/** Reject sub-minute recurring work, including legacy rows checked before native dispatch. */
function requireSafeCadence(cron: string) {
  const fields = cron.trim().split(/\s+/);
  // Native five-field cron already has minute granularity. A fixed seconds field preserves it.
  if (fields.length >= 6 && !/^\d{1,2}$/.test(fields[0]!))
    throw new UnsafeScheduleCadenceError(
      'Recurring schedules require at least 60 seconds between occurrences; use a fixed seconds field.',
    );
}

/** Require a remaining native occurrence for new or explicitly updated timing. */
function requireFuture(timing: z.output<typeof scheduleTiming>) {
  try {
    computeNextFireAt(timing.cron, { timezone: timing.timezone });
  } catch {
    throw new Error('Choose schedule timing with a valid future occurrence.');
  }
}

const detail =
  'Dispatch is best effort, not proof of completed work. Active or approval-blocked conversations can skip checks. Missed checks may not replay. A completed cadence does not mean the responsibility succeeded. Inspect conversation results and provider references before repeating an uncertain action.';
const text = z.string().trim().min(1).max(4000);
const id = z.string().min(1).max(200);
const actions = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create'),
      requestId: id,
      name: z.string().trim().min(1).max(120),
      prompt: text,
      timing: scheduleTiming,
    })
    .strict(),
  z.object({ action: z.literal('list') }).strict(),
  z.object({ action: z.literal('inspect'), scheduleId: id }).strict(),
  z
    .object({
      action: z.literal('update'),
      scheduleId: id,
      timing: scheduleTiming,
      name: z.string().trim().min(1).max(120).optional(),
      prompt: text.optional(),
    })
    .strict(),
  z.object({ action: z.literal('pause'), scheduleId: id }).strict(),
  z.object({ action: z.literal('resume'), scheduleId: id }).strict(),
  z
    .object({
      action: z.literal('cancel'),
      scheduleId: id,
      reason: z.enum(['owner-request', 'confirmed-completion']),
    })
    .strict(),
  z.object({ action: z.literal('run-now'), scheduleId: id }).strict(),
]);

// Keep the provider-facing root an object while preserving strict per-action validation.
const schema = z
  .object({
    action: z.enum(['create', 'list', 'inspect', 'update', 'pause', 'resume', 'cancel', 'run-now']),
    requestId: id.optional().describe('Required only for create; omit for other actions.'),
    name: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe('Required for create, optional for update; otherwise omit.'),
    prompt: text.optional().describe('Required for create, optional for update; otherwise omit.'),
    timing: timingFields
      .optional()
      .describe(
        'Required for create/update. Recurring example: {"kind":"cron","cron":"0 9 * * *","timezone":"America/Sao_Paulo"}. One-time example: {"kind":"once","date":"2030-01-15T09:00:00-03:00","timezone":"America/Sao_Paulo"}. Never combine cron and date. Omit timing for other actions.',
      ),
    scheduleId: id
      .optional()
      .describe('Required for actions targeting an existing schedule; omit for create and list.'),
    reason: z
      .enum(['owner-request', 'confirmed-completion'])
      .optional()
      .describe('Required only for cancel; omit for all other actions, including create.'),
  })
  .strict()
  .pipe(actions);

/** Manage identified owner schedules and prepare approval-preserving native dispatches. */
export function createScheduleOperations(config: AssistantConfig, getAgent: () => Agent) {
  /** Require the native runtime before reading schedules or invoking scheduler operations. */
  const mastra = () => {
    const instance = getAgent().getMastraInstance();
    if (!instance) throw new Error('Schedules require the assistant runtime.');
    return instance;
  };
  /** Resolve owner identity while preserving infrastructure failures. */
  async function findThread(threadId?: string, resourceId?: string) {
    const stored = await findOwnerThread(getAgent(), config.ownerId, threadId, resourceId);
    return stored?.id ?? null;
  }
  /** Require an existing owner conversation before schedule operations. */
  async function thread(threadId?: string, resourceId?: string) {
    const value = await findThread(threadId, resourceId);
    if (!value) throw new Error('Schedules require an owner-backed conversation.');
    return value;
  }
  /** Verify schedule ownership, reusing thread reads only within the current operation. */
  async function owned(
    schedule: AnySchedule | null,
    threads?: Map<string, Promise<string | null>>,
  ): Promise<AgentSchedule | null> {
    if (
      !schedule ||
      schedule.agentId !== getAgent().id ||
      schedule.resourceId !== config.ownerId ||
      schedule.metadata?.personalAssistant !== true ||
      !schedule.threadId
    )
      return null;
    let thread = threads?.get(schedule.threadId);
    if (!thread) {
      thread = findThread(schedule.threadId, schedule.resourceId);
      threads?.set(schedule.threadId, thread);
    }
    if (!(await thread)) return null;
    return schedule as AgentSchedule;
  }
  /** Reject missing or foreign schedules before exposing their state. */
  async function requireOwned(schedule: AnySchedule | null) {
    const value = await owned(schedule);
    if (!value) throw new Error('Schedule not found in this assistant owner scope.');
    return value;
  }
  /** Check route visibility while retaining unavailable-storage semantics. */
  async function canRead(scheduleId: string) {
    try {
      return (await owned(await mastra().schedules.get(scheduleId))) !== null;
    } catch {
      throw new Error('Schedule storage is unavailable.');
    }
  }
  /** Return the owned schedule and bounded native occurrence history. */
  async function inspect(schedule: AnySchedule) {
    const value = await requireOwned(schedule);
    const store = await mastra().getStorage()?.getStore('schedules');
    return {
      schedule: value,
      occurrences: await store!.listTriggers(value.id, { limit: 20 }),
      detail,
    };
  }
  /** Count active and paused schedules under the serialized mutation lock. */
  async function requireCapacity(excludeId?: string) {
    const all = await Promise.all(
      ['active', 'paused'].map(status =>
        mastra().schedules.list({
          agentId: getAgent().id,
          resourceId: config.ownerId,
          status: status as AgentSchedule['status'],
        }),
      ),
    );
    if (all.flat().filter(value => value.id !== excludeId).length >= config.limits.schedules)
      throw new Error(
        `Keep at most ${config.limits.schedules} active or paused schedules. Cancel an existing schedule first.`,
      );
  }
  let mutation = Promise.resolve();
  const hooks: ScheduleHooks<Mastra> = {
    /** Prepare owned, approval-safe schedule work and preserve distinct cadence and dependency failures. */
    async prepare({ schedule, agentId, trigger }) {
      if (agentId !== getAgent().id) return null;
      try {
        const value = await owned(await mastra().schedules.get(schedule.id));
        if (!value) return null;
        requireSafeCadence(value.cron);
        const suspended = await getAgent().listSuspendedRuns({ threadId: value.threadId, resourceId: config.ownerId });
        if (suspended.runs.length) return null;
        return {
          threadId: value.threadId,
          resourceId: config.ownerId,
          prompt: value.prompt,
          signalType: 'notification',
          tagName: 'schedule',
          providerOptions: {},
          attributes: { scheduleId: value.id },
          ifActive: { behavior: 'discard' },
          ifIdle: {
            behavior: 'wake',
            streamOptions: {
              requestContext: {
                [MASTRA_RESOURCE_ID_KEY]: config.ownerId,
                scheduleId: value.id,
                actualFireAt: trigger.firedAt.toISOString(),
                triggerKind: trigger.kind,
              },
            },
          },
        };
      } catch (error) {
        if (error instanceof UnsafeScheduleCadenceError) throw error;
        mastra().getLogger().warn('Schedule preparation failed.', {
          category: 'schedule-preparation',
          scheduleId: schedule.id,
          triggerKind: trigger.kind,
          actualFireAt: trigger.firedAt.toISOString(),
        });
        throw new Error('Schedule preparation failed: schedule dependency unavailable.');
      }
    },
  };
  const tool = createTool({
    id: 'schedule',
    description: `Manage native schedules for owner conversations: create, list, inspect, update, pause, resume, cancel, run-now. Use a stable requestId for an identified creation request and an explicit IANA timezone. Resolve natural language before calling. One-time dates require seconds and an explicit matching UTC offset. Cancel only on explicit owner request or confirmed responsibility completion. Run-now publishes immediately and preserves cadence; the native active/discard rule can discard it during this very tool call. ${detail}`,
    inputSchema: schema,
    /** Serialize owner schedule changes, preserve identified replay and enforce capacity before new scheduling. */
    execute: async (input, context) => {
      const previous = mutation;
      let release!: () => void;
      mutation = new Promise<void>(resolve => {
        release = resolve;
      });
      await previous;
      try {
        const currentThread = await thread(context?.agent?.threadId, context?.agent?.resourceId);
        const service = mastra().schedules;
        if (input.action === 'list') {
          try {
            const all = await Promise.all(
              ['active', 'paused', 'completed'].map(status =>
                service.list({
                  agentId: getAgent().id,
                  resourceId: config.ownerId,
                  status: status as AgentSchedule['status'],
                }),
              ),
            );
            const schedules: AgentSchedule[] = [];
            const threads = new Map<string, Promise<string | null>>();
            threads.set(currentThread, Promise.resolve(currentThread));
            for (const value of all.flat()) {
              const visible = await owned(value, threads);
              if (visible) schedules.push(visible);
            }
            return { schedules, detail };
          } catch {
            throw new Error('Schedule storage is unavailable.');
          }
        }
        if (input.action === 'create') {
          const scheduleId = `agent_${createHash('sha256')
            .update(JSON.stringify([config.ownerId, currentThread, input.requestId]))
            .digest('hex')}`;
          const existing = await service.get(scheduleId);
          if (existing)
            return {
              ...(await inspect(existing)),
              detail: `Existing identified request preserved. Use update to change it. ${detail}`,
            };
          requireFuture(input.timing);
          await requireCapacity();
          const { cron, timezone, ...timing } = input.timing;
          return inspect(
            await service.create({
              id: scheduleId,
              agentId: getAgent().id,
              threadId: currentThread,
              resourceId: config.ownerId,
              prompt: input.prompt,
              name: input.name,
              cron,
              timezone,
              ifActive: { behavior: 'discard' },
              ifIdle: { behavior: 'wake' },
              metadata: { personalAssistant: true, ...timing },
            }),
          );
        }
        const value = await requireOwned(await service.get(input.scheduleId));
        if (input.action === 'inspect') return inspect(value);
        if (input.action === 'cancel') {
          await service.delete(value.id);
          return {
            scheduleId: value.id,
            deleted: true,
            reason: input.reason,
            detail:
              'Future scheduling stopped. Deletion does not roll back dispatched work or external effects; native trigger history is deleted. Preserve existing result references in this conversation.',
          };
        }
        if (input.action === 'run-now')
          return {
            ...(await service.run(value.id)),
            detail: `Manual publication requested; this is not a completed check. Inspect native occurrences for discarded, skipped or failed dispatch and conversation results for actual effects. ${detail}`,
          };
        if (input.action === 'pause') return inspect(await service.pause(value.id));
        if (input.action === 'resume') {
          requireSafeCadence(value.cron);
          await requireCapacity(value.id);
          return inspect(await service.resume(value.id));
        }
        requireFuture(input.timing);
        const { cron, timezone, ...timing } = input.timing;
        return inspect(
          await service.update(value.id, {
            cron,
            timezone,
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.prompt === undefined ? {} : { prompt: input.prompt }),
            metadata: { personalAssistant: true, ...timing },
          }),
        );
      } finally {
        release();
      }
    },
  });
  return { tool, hooks, canRead };
}
