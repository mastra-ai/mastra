import type { Agent, AgentConfig } from '@mastra/core/agent';
import type { Processor } from '@mastra/core/processors';
import type { TaskRecord } from '@mastra/core/storage';
import { createTool, taskUpdateTool, formatTaskListResult } from '@mastra/core/tools';
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

/** Require a stored owner conversation and native thread-state persistence before progress changes. */
async function ownedThread(agent: Agent, ownerId: string, threadId?: string, resourceId?: string) {
  if (!threadId || resourceId !== ownerId)
    throw new Error('Objective and task operations require an owner-backed conversation.');
  const thread = await findOwnerThread(agent, ownerId, threadId, resourceId);
  if (!thread) throw new Error('The conversation does not belong to this owner.');
  const store = await agent.getMastraInstance()?.getStorage()?.getStore('threadState');
  if (!store) throw new Error('Objective and task operations require persistent thread storage.');
  return { threadId, resourceId: ownerId, store };
}

/** Manage native objectives without resetting usage or discarding unused evaluation allowances. */
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
    /** Apply explicit owner objective actions while preserving unfinished state and prior evaluation usage. */
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
            : {
                maxRuns:
                  Math.max(current.runsUsed, current.maxRuns ?? config.maxGoalEvaluations) +
                  input.additionalEvaluations,
              }),
        }),
      };
    },
  });
}

// Bind native tool hooks to identity validated by the state-signal callback for this run.
// Native task tools and storage retain ownership of the task lifecycle.
/** Preserve unfinished tasks and persist actionable status when a bounded run cannot finish. */
export function createProgressProtection(config: AssistantConfig, getAgent: () => Agent) {
  const contexts = new WeakMap<object, { threadId: string; resourceId: string }>();
  const taskTools = new Set(['task_write', 'task_update', 'task_complete', 'task_check']);
  const processor = {
    id: 'owner-progress',
    /** Bind progress operations to a stored owner conversation and reject ambiguous identity. */
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
    /** Persist unfinished-work notices and park active tasks when execution stops without a confirmed outcome. */
    async processOutputResult({ result, messageList, requestContext, sendStateSignal, sendSignal, writer }) {
      if (result.finishReason === 'suspended') return messageList;
      const last = result.steps.at(-1);
      const unresolved = new Map<string, { toolName: string; validation: boolean }>();
      for (const step of result.steps) {
        for (const { payload } of step.toolResults) {
          const args =
            payload.args && typeof payload.args === 'object' && !Array.isArray(payload.args)
              ? (payload.args as Record<string, unknown>)
              : undefined;
          // Correcting timing retains a schedule's identified operation. A
          // success for another request must not hide the original failure.
          const identity =
            payload.toolName === 'schedule' && args
              ? { action: args.action, requestId: args.requestId, scheduleId: args.scheduleId }
              : payload.args;
          const key = JSON.stringify([payload.toolName, identity]);
          const value = payload.result;
          const failed =
            payload.isError ||
            (value &&
              typeof value === 'object' &&
              (('error' in value && value.error === true) || ('isError' in value && value.isError === true)));
          if (failed)
            unresolved.set(key, {
              toolName: /^[\w.:-]{1,128}$/.test(payload.toolName) ? payload.toolName : 'tool',
              validation: Boolean(value && typeof value === 'object' && 'validationErrors' in value),
            });
          else unresolved.delete(key);
        }
      }
      const failures = [...unresolved.values()];
      // A suspended approval has no completed result for its pending call.
      // Leave that native lifecycle and its original arguments untouched.
      const toolOnlyStop =
        result.finishReason === 'tool-calls' &&
        Boolean(last?.toolCalls.length) &&
        last!.toolResults.length === last!.toolCalls.length;
      const outputLimit = result.finishReason === 'length';
      if (!failures.length && !toolOnlyStop && !outputLimit && result.finishReason !== 'error') return messageList;

      const failedNames = [...new Set(failures.map(failure => failure.toolName))];
      let notice = failures.length
        ? `The ${failedNames.join(', ')} step failed. This turn has stopped; the failed call is not confirmation of success. Inspect its result before continuing or retrying an uncertain action.`
        : result.finishReason === 'error'
          ? 'The run failed and has stopped. Work remains unfinished. Inspect existing results before continuing; do not repeat uncertain writes automatically.'
          : 'This turn ended after a tool call without a final confirmation. Work remains unfinished. Inspect existing results before continuing; do not repeat completed or uncertain actions.';
      if (outputLimit) {
        const limitNotice =
          'The model reached its output token limit before completing this turn. Work remains unfinished. Review the output allowance and existing results before continuing; do not repeat completed or uncertain actions automatically.';
        notice = failures.length ? `${notice} ${limitNotice}` : limitNotice;
      }
      if (failures.some(failure => failure.toolName === 'schedule' && failure.validation)) {
        notice +=
          ' Schedule validation failed before execution. Use timing.kind="cron" with cron and timezone, or timing.kind="once" with date and timezone. Keep the same requestId when correcting creation.';
      }

      // Rejected task/objective management must leave the protected plan intact.
      // Execution failures and incomplete terminal turns park active work.
      const progressOnlyFailure =
        failures.length > 0 &&
        failures.every(failure => taskTools.has(failure.toolName) || failure.toolName === 'objective');
      if (progressOnlyFailure) notice += ' The rejected progress change left the existing task list unchanged.';
      const identity = requestContext && contexts.get(requestContext);
      if (identity && !progressOnlyFailure) {
        try {
          const target = await ownedThread(getAgent(), config.ownerId, identity.threadId, identity.resourceId);
          const tasks = (await target.store.getState<TaskRecord[]>({ threadId: target.threadId, type: 'task' })) ?? [];
          let updated = tasks;
          for (const task of tasks.filter(task => task.status === 'in_progress')) {
            const update = await taskUpdateTool.execute!(
              { id: task.id, status: 'pending' },
              {
                agent: {
                  ...identity,
                  agentId: getAgent().id,
                  toolCallId: `terminal-task-${task.id}`,
                  messages: messageList.get.all.db(),
                  suspend: async () => {
                    throw new Error('Terminal task updates cannot suspend.');
                  },
                },
                requestContext,
                mastra: getAgent().getMastraInstance(),
              },
            );
            if (!update || !('tasks' in update) || update.isError) throw new Error('Task update unavailable.');
            updated = update.tasks;
          }
          if (updated !== tasks) {
            const snapshot = {
              id: 'tasks',
              mode: 'snapshot' as const,
              cacheKey: JSON.stringify(updated),
              tagName: 'current-task-list',
              contents: formatTaskListResult(updated),
              value: { tasks: updated },
              metadata: { value: { tasks: updated } },
              attributes: { count: updated.length },
            };
            if (sendStateSignal) await sendStateSignal(snapshot);
            else
              await sendSignal?.({
                type: 'state',
                tagName: snapshot.tagName,
                contents: snapshot.contents,
                metadata: snapshot.metadata,
                attributes: snapshot.attributes,
              });
          }
        } catch {
          notice += ' The task status could not be saved; the displayed task list may be stale.';
        }
      }
      // Native signals make the notice visible during streaming as well as on
      // reload. Persist an assistant answer even when no model step remains.
      if (writer) {
        try {
          await sendSignal?.({ type: 'notification', tagName: 'execution-status', contents: notice });
        } catch {
          notice += ' The live status notification could not be delivered.';
        }
      }
      const answer = messageList.get.response
        .db()
        .findLast(
          message =>
            message.role === 'assistant' &&
            message.content.parts.some(part => part.type === 'text' && part.text.trim()),
        );
      if (answer && last?.text.trim()) {
        // Preserve the model's useful explanation and native tool parts. Adding
        // a separate response would make generate().text expose only our notice.
        messageList.removeByIds([answer.id]);
        const lastText = answer.content.parts.findLastIndex(part => part.type === 'text');
        messageList.add(
          {
            ...answer,
            content: {
              ...answer.content,
              parts: answer.content.parts.map((part, index) =>
                part.type === 'text' && index === lastText ? { ...part, text: `${part.text}\n\n${notice}` } : part,
              ),
              content: undefined,
            },
          },
          'response',
          { merge: false },
        );
      } else messageList.add({ role: 'assistant', content: notice }, 'response');
      return messageList;
    },
  } satisfies Processor;
  const hooks: NonNullable<AgentConfig['hooks']> = {
    /** Validate native task replacement against the latest stored unfinished tasks immediately before mutation. */
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
