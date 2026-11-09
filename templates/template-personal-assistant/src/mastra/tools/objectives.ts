import type { Agent, AgentConfig } from '@mastra/core/agent';
import type { Processor } from '@mastra/core/processors';
import type { TaskRecord } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { z } from 'zod';
import type { AssistantConfig } from '../config';
import { findOwnerThread } from '../context';

export const goalGuidance = `Judge completion using concrete results, not plans, promises, or claims of success.
Choose done only when every requirement is supported by the actual work described in the conversation.
Choose waiting when required information, owner approval, human verification, or an external event is missing.
A proposed external action, a pending or declined approval, or a partial provider result is not completed work.
Choose continue only when useful work can proceed without inventing missing information or bypassing approval.
Give a specific reason identifying completed evidence or the remaining work/checkpoint.`;

async function ownedThread(agent: Agent, ownerId: string, threadId?: string, resourceId?: string) {
  if (!threadId || resourceId !== ownerId)
    throw new Error('Objective and task operations require an owner-backed conversation.');
  const thread = await findOwnerThread(agent, ownerId, threadId, resourceId);
  if (!thread) throw new Error('The conversation does not belong to this owner.');
  const store = await agent.getMastraInstance()?.getStorage()?.getStore('threadState');
  if (!store) throw new Error('Objective and task operations require persistent thread storage.');
  return { threadId, resourceId: ownerId, store };
}

export function createObjectiveTool(config: AssistantConfig, getAgent: () => Agent) {
  const allowance = z.number().int().min(1).max(config.maxGoalEvaluations);
  const actions = z.discriminatedUnion('action', [
    z.object({ action: z.literal('inspect') }).strict(),
    z
      .object({
        action: z.literal('set'),
        objective: z.string().trim().min(1).max(4000),
        maxEvaluations: allowance.optional(),
        replaceExisting: z.literal(true).optional(),
      })
      .strict(),
    z.object({ action: z.literal('pause') }).strict(),
    z.object({ action: z.literal('resume'), additionalEvaluations: allowance.optional() }).strict(),
    z.object({ action: z.literal('clear'), confirmClear: z.literal(true) }).strict(),
  ]);
  return createTool({
    id: 'objective',
    description:
      "Inspect, set, pause, resume, or explicitly clear this conversation objective. Inspect conflicts; request explicit replacement intent or use a separate conversation. Repeating the same objective never resets its usage. Resume an exhausted objective with an additional bounded evaluation allowance. Clear only on the owner's explicit request; clearing is not completion.",
    // The model receives an object schema; native validation retains action-specific requirements.
    inputSchema: z
      .object({
        action: z.enum(['inspect', 'set', 'pause', 'resume', 'clear']),
        objective: z.string().trim().min(1).max(4000).optional(),
        maxEvaluations: allowance.optional(),
        replaceExisting: z.literal(true).optional(),
        additionalEvaluations: allowance.optional(),
        confirmClear: z.literal(true).optional(),
      })
      .strict()
      .pipe(actions),
    execute: async (input, context) => {
      const agent = getAgent();
      const target = await ownedThread(agent, config.ownerId, context?.agent?.threadId, context?.agent?.resourceId);
      const current = await agent.getObjective({ threadId: target.threadId });
      if (input.action === 'inspect') return { objective: current ?? null };
      if (input.action === 'clear') {
        await agent.clearObjective({ threadId: target.threadId });
        return { objective: null, detail: "The objective was cleared at the owner's request, not completed." };
      }
      if (input.action === 'set') {
        if (current?.objective === input.objective)
          return { objective: current, detail: 'Existing objective and evaluation usage preserved.' };
        if (current && current.status !== 'done' && !input.replaceExisting) {
          return {
            objective: current,
            conflict: true,
            detail: 'An unfinished objective exists. Ask for explicit replacement or use a separate conversation.',
          };
        }
        const objective = await agent.setObjective(input.objective, {
          threadId: target.threadId,
          resourceId: target.resourceId,
          maxRuns: input.maxEvaluations ?? config.maxGoalEvaluations,
        });
        if (!objective) throw new Error('The objective could not be persisted.');
        return { objective };
      }
      if (!current) throw new Error('This conversation has no objective.');
      if (current.status === 'done')
        throw new Error('This objective is already complete. Set a new objective explicitly.');
      if (input.action === 'pause')
        return { objective: await agent.updateObjectiveOptions({ threadId: target.threadId, status: 'paused' }) };
      const exhausted = current.runsUsed >= (current.maxRuns ?? config.maxGoalEvaluations);
      if (exhausted && input.additionalEvaluations === undefined) {
        return {
          objective: current,
          needsBudget: true,
          detail: 'The evaluation budget is exhausted. Ask for an explicit additional evaluation allowance.',
        };
      }
      return {
        objective: await agent.updateObjectiveOptions({
          threadId: target.threadId,
          status: 'active',
          ...(input.additionalEvaluations === undefined
            ? {}
            : { maxRuns: current.runsUsed + input.additionalEvaluations }),
        }),
      };
    },
  });
}

// Bind native tool hooks to identity validated by the state-signal callback for this run.
// Native task tools and storage retain ownership of the task lifecycle.
export function createProgressProtection(config: AssistantConfig, getAgent: () => Agent) {
  const contexts = new WeakMap<object, { threadId: string; resourceId: string }>();
  const taskTools = new Set(['task_write', 'task_update', 'task_complete', 'task_check']);
  const processor = {
    id: 'owner-progress',
    async computeStateSignal({ threadId, resourceId, requestContext, abort }) {
      if (!threadId && !resourceId) return;
      if (!requestContext) return abort('Task state requires the assistant runtime.');
      try {
        const target = await ownedThread(getAgent(), config.ownerId, threadId, resourceId);
        contexts.set(requestContext, { threadId: target.threadId, resourceId: target.resourceId });
      } catch {
        return abort('Task state requires a stored conversation belonging to this owner.');
      }
    },
  } satisfies Processor;
  const hooks: NonNullable<AgentConfig['hooks']> = {
    async beforeToolCall({ toolName, input, context }) {
      if (!taskTools.has(toolName)) return;
      const requestContext = (context as Pick<ToolExecutionContext, 'requestContext'>)?.requestContext;
      const identity = requestContext && contexts.get(requestContext);
      const target = await ownedThread(getAgent(), config.ownerId, identity?.threadId, identity?.resourceId);
      if (toolName !== 'task_write') return;
      const current = (await target.store.getState<TaskRecord[]>({ threadId: target.threadId, type: 'task' })) ?? [];
      const tasks = (input as { tasks?: { id?: string }[] })?.tasks;
      if (
        !Array.isArray(tasks) ||
        current.some(task => task.status !== 'completed' && !tasks.some(next => next.id === task.id))
      ) {
        return {
          proceed: false,
          output: {
            content:
              'Keep every unfinished task and its stable ID when replacing the list. Use task_update for targeted changes.',
            tasks: current,
            isError: true,
          },
        };
      }
    },
  };
  return { processor, hooks };
}

export type JudgeModel = NonNullable<AgentConfig['goal']>['judge'];
