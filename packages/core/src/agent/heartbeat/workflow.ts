import type { z } from 'zod/v4';
import type { Mastra } from '../../mastra';
import { createStep, createWorkflow } from '../../workflows/evented';
import { HEARTBEAT_WORKFLOW_ID, HeartbeatInputSchema, HeartbeatOutputSchema } from './types';
import type { HeartbeatInput, HeartbeatOutcome } from './types';

/**
 * Returns `true` when `nowMs` (UTC ms) falls inside the daily window
 * defined by `window.start` / `window.end` (HH:mm) in `window.timezone`
 * (defaults to UTC). When `start > end` the window wraps midnight.
 */
export function isWithinActiveHours(window: { start: string; end: string; timezone?: string }, nowMs: number): boolean {
  const tz = window.timezone ?? 'UTC';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(nowMs));
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  const nowMinutes = hour * 60 + minute;

  const [sh, sm] = window.start.split(':').map(Number);
  const [eh, em] = window.end.split(':').map(Number);
  const startMinutes = sh! * 60 + sm!;
  const endMinutes = eh! * 60 + em!;

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Wrapped window (e.g. 22:00 -> 06:00)
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

/**
 * Best-effort delete of the schedule row. Heartbeats may race with
 * an explicit `clearHeartbeat()` so we swallow errors with a debug log.
 */
async function selfClean(mastra: Mastra, scheduleId: string): Promise<void> {
  try {
    const store = await mastra.getStorage()?.getStore('schedules');
    if (!store) return;
    await store.deleteSchedule(scheduleId);
  } catch (error) {
    mastra.getLogger?.()?.debug?.('heartbeat self-clean failed', { scheduleId, error });
  }
}

async function executeHeartbeat(
  mastra: Mastra,
  inputData: HeartbeatInput,
): Promise<{ outcome: HeartbeatOutcome; reason?: string }> {
  const { scheduleId, agentId, prompt, threadId, resourceId, activeHours, idleThresholdMs } = inputData;

  const agent = (() => {
    try {
      return mastra.getAgentById(agentId);
    } catch {
      return null;
    }
  })();
  if (!agent) {
    await selfClean(mastra, scheduleId);
    return { outcome: 'agent-missing', reason: `agent "${agentId}" no longer registered` };
  }

  if (activeHours && !isWithinActiveHours(activeHours, Date.now())) {
    return { outcome: 'skipped-outside-hours' };
  }

  if (threadId) {
    if (!resourceId) {
      return { outcome: 'invalid-input', reason: 'resourceId required when threadId is set' };
    }
    const memory = await agent.getMemory();
    if (memory) {
      const thread = await memory.getThreadById({ threadId });
      if (!thread) {
        await selfClean(mastra, scheduleId);
        return { outcome: 'thread-missing', reason: `thread "${threadId}" not found` };
      }
      if (idleThresholdMs !== undefined) {
        const updatedAt = thread.updatedAt instanceof Date ? thread.updatedAt.getTime() : Number(thread.updatedAt);
        if (Number.isFinite(updatedAt) && Date.now() - updatedAt < idleThresholdMs) {
          return { outcome: 'skipped-idle-threshold' };
        }
      }
    }

    agent.sendSignal(
      {
        type: inputData.signalType ?? 'user-message',
        contents: prompt,
      },
      {
        resourceId,
        threadId,
        ifActive: { behavior: inputData.ifActive ?? 'discard' },
        ifIdle: { behavior: inputData.ifIdle ?? 'wake' },
      },
    );
    return { outcome: 'signal-accepted' };
  }

  await agent.generate(prompt);
  return { outcome: 'fired' };
}

/**
 * Built-in workflow that drives every heartbeat fire. Registered by
 * `Mastra` on construction. Each `agent.setHeartbeat()` call creates a
 * schedule row whose `target.workflowId === HEARTBEAT_WORKFLOW_ID`, and
 * the scheduler tick publishes `workflow.start` against this workflow
 * with the persisted `HeartbeatInput` as `inputData`.
 */
/**
 * Build the built-in heartbeat workflow. Defined as a factory rather than a
 * module-eval constant to avoid a circular module-init dependency between
 * `agent/heartbeat`, `workflows/evented` (which references `Agent` at runtime
 * via `instanceof`), and `agent/agent`. `Mastra` calls this once during
 * construction to register the workflow.
 */
export function buildHeartbeatWorkflow() {
  return createWorkflow({
    id: HEARTBEAT_WORKFLOW_ID,
    inputSchema: HeartbeatInputSchema,
    outputSchema: HeartbeatOutputSchema,
  })
    .then(
      createStep({
        id: 'tick',
        inputSchema: HeartbeatInputSchema,
        outputSchema: HeartbeatOutputSchema,
        execute: async ({ inputData, mastra }) => {
          const parsed = HeartbeatInputSchema.safeParse(inputData);
          if (!parsed.success) {
            return { outcome: 'invalid-input' as const, reason: parsed.error.message };
          }
          return executeHeartbeat(mastra, parsed.data);
        },
      }),
    )
    .commit();
}

// Re-export the schemas under aliases that internal tests use.
export { HEARTBEAT_WORKFLOW_ID, HeartbeatInputSchema, HeartbeatOutputSchema };
export const __internal = { executeHeartbeat, selfClean };
export type { z };
