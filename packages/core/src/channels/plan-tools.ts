import { z } from 'zod';

import type { RequestContext } from '../request-context';
import { createTool } from '../tools/tool';
import type { AgentChannels } from './agent-channels';
import type { PersistedPlanTask } from './plan-persistence';
import type { ChannelContext } from './types';

/**
 * Public summary returned by plan tools to the LLM. Matches the
 * mastracode/harness `task_*` tool API so the same prompts work across both.
 */
export interface PlanTaskSummary {
  id: string;
  title: string;
  status: PersistedPlanTask['status'];
}

/**
 * Build the LLM-facing plan tools (`task_write`, `task_update`,
 * `task_complete`, `task_check`, `complete_plan`).
 *
 * Tools mutate a per-thread persisted plan attached to the agent's Mastra
 * thread metadata. The channel posts a Chat SDK `Plan` widget on the first
 * `task_write` call and edits it in place for subsequent updates.
 *
 * The factory takes the owning `AgentChannels` instance so tools can look up
 * the active plan / sdk thread by Mastra thread id resolved from the channel
 * request context.
 *
 * @internal Auto-injected by `AgentChannels.getTools()` when any adapter has
 * `plan` configured. Importing and adding these tools manually is supported
 * but rarely needed.
 */
export function createPlanTools(channels: AgentChannels) {
  // The functions below are typed as `any` parameter access because they
  // reach into internals (`activePlans`, `applyPlanMutation`) that are
  // intentionally private on AgentChannels. Plan tools are an internal
  // collaboration with the channel; the boundary stays inside this module.
  const internals = channels as unknown as {
    resolveActivePlanForTool(requestContext: RequestContext | undefined): Promise<{
      mastraThreadId: string;
      platform: string;
    } | null>;
    applyPlanMutation(
      mastraThreadId: string,
      mutate: (tasks: PersistedPlanTask[]) => PersistedPlanTask[] | void,
    ): Promise<PersistedPlanTask[]>;
    ensurePlanInstanceForTool(mastraThreadId: string): Promise<void>;
    finalizePlanFromTool(mastraThreadId: string, completeMessage?: string): Promise<void>;
    readPlanTasks(mastraThreadId: string): Promise<PersistedPlanTask[]>;
  };

  const requireThreadId = async (context: { requestContext?: RequestContext }) => {
    const resolved = await internals.resolveActivePlanForTool(context.requestContext);
    if (!resolved) {
      throw new Error(
        'Plan tools can only be called from a channel-driven agent run. Configure `plan` on a channel adapter.',
      );
    }
    return resolved.mastraThreadId;
  };

  const toSummary = (t: PersistedPlanTask): PlanTaskSummary => ({ id: t.id, title: t.title, status: t.status });

  const genId = () => `task_${Math.random().toString(36).slice(2, 10)}`;

  return {
    task_write: createTool({
      id: 'task_write',
      description:
        'Create or replace the channel plan task list. ' +
        'Pass the full ordered list of tasks; existing tasks (matched by id) keep their state, ' +
        'new tasks are appended, and tasks removed from the list are marked completed. ' +
        'Use this once at the start of a multi-step task to outline your plan to the user.',
      inputSchema: z.object({
        tasks: z
          .array(
            z.object({
              id: z.string().optional().describe('Stable identifier. Omit to auto-generate.'),
              title: z.string().describe('Short description shown in the plan widget.'),
              status: z.enum(['pending', 'in_progress', 'completed']).optional().default('pending'),
              details: z.string().optional().describe('Optional longer description.'),
            }),
          )
          .min(1),
      }),
      execute: async ({ tasks: input }, context) => {
        const mastraThreadId = await requireThreadId(context);
        await internals.ensurePlanInstanceForTool(mastraThreadId);
        const updated = await internals.applyPlanMutation(mastraThreadId, current => {
          const byId = new Map(current.map(t => [t.id, t]));
          const next: PersistedPlanTask[] = [];
          const seen = new Set<string>();
          for (const item of input) {
            const id = item.id ?? genId();
            const existing = byId.get(id);
            const merged: PersistedPlanTask = {
              id,
              title: item.title,
              status: item.status ?? existing?.status ?? 'pending',
              details: item.details ?? existing?.details,
              toolOutputs: existing?.toolOutputs,
            };
            next.push(merged);
            seen.add(id);
          }
          // Tasks dropped from the new list are implicitly completed.
          for (const old of current) {
            if (!seen.has(old.id)) next.push({ ...old, status: 'completed' });
          }
          return next;
        });
        return { tasks: updated.map(toSummary) };
      },
    }),

    task_update: createTool({
      id: 'task_update',
      description: 'Patch a single task on the channel plan by id. Only provided fields are updated.',
      inputSchema: z.object({
        id: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed']).optional(),
        title: z.string().optional(),
        details: z.string().optional(),
      }),
      execute: async ({ id, status, title, details }, context) => {
        const mastraThreadId = await requireThreadId(context);
        let found: PersistedPlanTask | undefined;
        await internals.applyPlanMutation(mastraThreadId, current => {
          for (const t of current) {
            if (t.id !== id) continue;
            if (status !== undefined) t.status = status;
            if (title !== undefined) t.title = title;
            if (details !== undefined) t.details = details;
            found = t;
            return;
          }
        });
        if (!found) return { ok: false as const, reason: 'unknown task id' };
        return { ok: true as const, task: toSummary(found) };
      },
    }),

    task_complete: createTool({
      id: 'task_complete',
      description: 'Mark a single task on the channel plan as completed by id. Shortcut for `task_update`.',
      inputSchema: z.object({
        id: z.string(),
      }),
      execute: async ({ id }, context) => {
        const mastraThreadId = await requireThreadId(context);
        let found: PersistedPlanTask | undefined;
        await internals.applyPlanMutation(mastraThreadId, current => {
          for (const t of current) {
            if (t.id !== id) continue;
            t.status = 'completed';
            found = t;
            return;
          }
        });
        if (!found) return { ok: false as const, reason: 'unknown task id' };
        return { ok: true as const, task: toSummary(found) };
      },
    }),

    task_check: createTool({
      id: 'task_check',
      description:
        'Read the current channel plan task list and summary. Returns counts plus a list of any tasks ' +
        'that are still pending or in progress. Use this before `complete_plan` to verify everything is done.',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        const mastraThreadId = await requireThreadId(context);
        const tasks = await internals.readPlanTasks(mastraThreadId);
        const counts = { total: tasks.length, completed: 0, inProgress: 0, pending: 0 };
        const incompleteTasks: PlanTaskSummary[] = [];
        for (const t of tasks) {
          if (t.status === 'completed') counts.completed += 1;
          else {
            incompleteTasks.push(toSummary(t));
            if (t.status === 'in_progress') counts.inProgress += 1;
            else counts.pending += 1;
          }
        }
        return {
          summary: { ...counts, allCompleted: counts.total > 0 && counts.completed === counts.total },
          tasks: tasks.map(toSummary),
          incompleteTasks,
        };
      },
    }),

    complete_plan: createTool({
      id: 'complete_plan',
      description:
        'Finalize the channel plan once all tasks are completed. Refuses to complete while tasks are ' +
        'pending or in progress unless `force: true` is passed. Pass an optional `completeMessage` to ' +
        'customize the final block message.',
      inputSchema: z.object({
        completeMessage: z.string().optional(),
        force: z.boolean().optional(),
      }),
      execute: async ({ completeMessage, force }, context) => {
        const mastraThreadId = await requireThreadId(context);
        const tasks = await internals.readPlanTasks(mastraThreadId);
        const incomplete = tasks.filter(t => t.status !== 'completed');
        if (incomplete.length > 0 && !force) {
          return {
            ok: false as const,
            reason: 'incomplete tasks remain',
            incompleteTaskIds: incomplete.map(t => t.id),
          };
        }
        await internals.finalizePlanFromTool(mastraThreadId, completeMessage);
        return { ok: true as const };
      },
    }),
  };
}

/**
 * Internal helper used by `createPlanTools` to extract the resolved Mastra
 * thread id from a request context. Exported for testing.
 */
export function readMastraThreadIdFromContext(requestContext: RequestContext | undefined): string | undefined {
  const channel = requestContext?.get('channel') as ChannelContext | undefined;
  return channel?.mastraThreadId;
}
