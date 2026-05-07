import { z } from 'zod/v4';

import { Agent } from '../agent';
import type { ToolsInput, ToolsetsInput } from '../agent/types';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import { RequestContext } from '../request-context';
import { createTool } from '../tools/tool';
import { createWorkspaceTools } from '../workspace/tools/tools';

import type { HarnessQuestionAnswer, HarnessRequestContext, HarnessSubagent } from './types';

let questionCounter = 0;
let planCounter = 0;

const FORKED_SUBAGENT_NESTING_NOTICE =
  'Do not call the `subagent` tool. You are currently running inside a forked subagent, and this is the maximum allowed subagent nesting level. Further subagent calls will return an error. Answer the task directly using the conversation history and the other tools available to you.';

/**
 * Converts the user's answer into the text returned to the model after the `ask_user`
 * tool resumes. Free-text and single-select prompts already produce a single string,
 * while multi-select prompts return an array of selected labels that must be flattened
 * before the tool result is added back into the generation context.
 *
 * The formatter intentionally keeps the model-facing output compact by joining
 * multi-select answers with commas. This mirrors the old single-answer behavior while
 * still preserving every selected option in a readable form.
 */
function formatQuestionAnswer(answer: HarnessQuestionAnswer): string {
  return Array.isArray(answer) ? answer.join(', ') : answer;
}

/**
 * Built-in harness tool: ask the user a question and wait for their response.
 *
 * The tool supports three prompt shapes. Omitting `options` asks an open-ended
 * free-text question. Providing `options` without `selectionMode` asks the UI to
 * render a single-select prompt for backwards compatibility. Providing
 * `selectionMode: 'multi_select'` lets the UI return multiple selected option labels
 * as a string array through `respondToQuestion()`.
 *
 * During normal harness execution the tool emits an `ask_question` event, registers a
 * resolver, and pauses until the UI answers. When the tool is executed without harness
 * callbacks, it returns a readable fallback prompt so non-UI execution paths still
 * expose the question and available choices to the model.
 */
export const askUserTool = createTool({
  id: 'ask_user',
  description:
    'Ask the user a question and wait for their response. Use this when you need clarification, want to validate assumptions, or need the user to make a decision between options. Provide options for structured choices (2-4 options), or omit them for open-ended questions. Use selectionMode to choose whether the user can pick one option or multiple options.',
  inputSchema: z.object({
    question: z.string().min(1).describe('The question to ask the user. Should be clear and specific.'),
    options: z
      .array(
        z.object({
          label: z.string().describe('Short display text for this option (1-5 words)'),
          description: z.string().optional().describe('Explanation of what this option means'),
        }),
      )
      .optional()
      .describe('Optional choices. If provided, shows a selection list. If omitted, shows a free-text input.'),
    selectionMode: z
      .enum(['single_select', 'multi_select'])
      .optional()
      .describe(
        'Controls how many provided options the user can select. Defaults to single_select when options are provided. Requires options.',
      ),
  }),
  execute: async ({ question, options, selectionMode }, context) => {
    try {
      const harnessCtx = context?.requestContext?.get('harness') as HarnessRequestContext | undefined;
      const resolvedSelectionMode = options?.length ? (selectionMode ?? 'single_select') : undefined;

      if (selectionMode && !options?.length) {
        return {
          content: 'Failed to ask user: selectionMode requires options.',
          isError: true,
        };
      }

      if (!harnessCtx?.emitEvent || !harnessCtx?.registerQuestion) {
        return {
          content: `[Question for user]: ${question}${
            options?.length ? '\nOptions: ' + options.map(o => o.label).join(', ') : ''
          }${resolvedSelectionMode ? '\nSelection mode: ' + resolvedSelectionMode : ''}`,
          isError: false,
        };
      }

      const questionId = `q_${++questionCounter}_${Date.now()}`;

      const answer = await new Promise<HarnessQuestionAnswer>((resolve, reject) => {
        const signal = harnessCtx.abortSignal;
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
        signal?.addEventListener('abort', onAbort, { once: true });

        harnessCtx.registerQuestion!({
          questionId,
          resolve: answer => {
            signal?.removeEventListener('abort', onAbort);
            resolve(answer);
          },
        });

        harnessCtx.emitEvent!({
          type: 'ask_question',
          questionId,
          question,
          options,
          selectionMode: resolvedSelectionMode,
        });
      });

      return { content: `User answered: ${formatQuestionAnswer(answer)}`, isError: false };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { content: `Failed to ask user: ${msg}`, isError: true };
    }
  },
});

/**
 * Built-in harness tool: submit a plan for user review.
 * The plan renders in the UI with approve/reject options.
 * On approval, the harness switches to the default mode.
 */
export const submitPlanTool = createTool({
  id: 'submit_plan',
  description:
    'Submit a completed implementation plan for user review. The plan will be rendered as markdown and the user can approve, reject, or request changes. Use this when your exploration is complete and you have a concrete plan ready for review. On approval, the system automatically switches to the default mode so you can implement.',
  inputSchema: z.object({
    title: z.string().optional().describe("Short title for the plan (e.g., 'Add dark mode toggle')"),
    plan: z
      .string()
      .min(1)
      .describe('The full plan content in markdown format. Should include Overview, Steps, and Verification sections.'),
  }),
  execute: async ({ title, plan }, context) => {
    try {
      const harnessCtx = context?.requestContext?.get('harness') as HarnessRequestContext | undefined;

      if (!harnessCtx?.emitEvent || !harnessCtx?.registerPlanApproval) {
        return {
          content: `[Plan submitted for review]\n\nTitle: ${title || 'Implementation Plan'}\n\n${plan}`,
          isError: false,
        };
      }

      const planId = `plan_${++planCounter}_${Date.now()}`;

      const result = await new Promise<{ action: 'approved' | 'rejected'; feedback?: string }>((resolve, reject) => {
        const signal = harnessCtx.abortSignal;
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
        signal?.addEventListener('abort', onAbort, { once: true });

        harnessCtx.registerPlanApproval!({
          planId,
          resolve: res => {
            signal?.removeEventListener('abort', onAbort);
            resolve(res);
          },
        });

        harnessCtx.emitEvent!({
          type: 'plan_approval_required',
          planId,
          title: title || 'Implementation Plan',
          plan,
        });
      });

      if (result.action === 'approved') {
        return {
          content: 'Plan approved. Proceed with implementation following the approved plan.',
          isError: false,
        };
      }

      const feedback = result.feedback ? `\n\nUser feedback: ${result.feedback}` : '';
      return {
        content: `Plan was not approved. The user wants revisions.${feedback}\n\nPlease revise the plan based on the feedback and submit again with submit_plan.`,
        isError: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { content: `Failed to submit plan: ${msg}`, isError: true };
    }
  },
});

// =============================================================================
// Task Tools
// =============================================================================

const taskItemSchema = z.object({
  content: z.string().min(1).describe("Task description in imperative form (e.g., 'Fix authentication bug')"),
  status: z.enum(['pending', 'in_progress', 'completed']).describe('Current task status'),
  activeForm: z
    .string()
    .min(1)
    .describe("Present continuous form shown during execution (e.g., 'Fixing authentication bug')"),
});

export type TaskItem = z.infer<typeof taskItemSchema>;

/**
 * Built-in harness tool: manage a structured task list for the coding session.
 * Full-replacement semantics: each call replaces the entire task list.
 */
export const taskWriteTool = createTool({
  id: 'task_write',
  description: `Create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.

Usage:
- Pass the FULL task list each time (replaces previous list)
- Each task has: content (imperative), status (pending|in_progress|completed), activeForm (present continuous)
- Mark tasks in_progress BEFORE starting work (only ONE at a time)
- Mark tasks completed IMMEDIATELY after finishing
- Use this for multi-step tasks requiring 3+ distinct actions

States:
- pending: Not yet started
- in_progress: Currently working on (limit to ONE)
- completed: Finished successfully`,
  inputSchema: z.object({
    tasks: z.array(taskItemSchema).describe('The complete updated task list'),
  }),
  execute: async ({ tasks }, context) => {
    try {
      const harnessCtx = context?.requestContext?.get('harness') as HarnessRequestContext | undefined;

      if (harnessCtx) {
        // Always update state
        await harnessCtx.setState({ tasks });

        // Always emit event immediately for real-time updates
        // The UI will handle deduplication if needed
        harnessCtx.emitEvent?.({
          type: 'task_updated',
          tasks,
        });
      }

      // Build summary for the model's context
      const completed = tasks.filter(t => t.status === 'completed').length;
      const inProgress = tasks.find(t => t.status === 'in_progress');
      const total = tasks.length;

      let summary = `Tasks updated: [${completed}/${total} completed]`;
      if (inProgress) {
        summary += `\nCurrently: ${inProgress.activeForm}`;
      }

      return {
        content: summary,
        isError: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: `Failed to update tasks: ${msg}`,
        isError: true,
      };
    }
  },
});

/**
 * Built-in harness tool: check the completion status of the current task list.
 * Helps the agent determine if all tasks are completed before ending work.
 */
export const taskCheckTool = createTool({
  id: 'task_check',
  description: `Check the completion status of your current task list. Use this before deciding to end work on a task to ensure all tasks are completed.

Returns:
- Total number of tasks
- Number of completed, in progress, and pending tasks
- List of incomplete tasks (if any)
- Boolean indicating if all tasks are done`,
  inputSchema: z.object({}), // No input needed
  execute: async ({}, context) => {
    try {
      const harnessCtx = context?.requestContext?.get('harness') as HarnessRequestContext | undefined;

      if (!harnessCtx) {
        return {
          content: 'Unable to access task list (no harness context)',
          isError: true,
        };
      }

      // Get current state which includes tasks
      // Use getState() for live state instead of the snapshot
      const state = harnessCtx.getState ? harnessCtx.getState() : harnessCtx.state;
      const typedState = state as {
        tasks?: Array<{
          content: string;
          status: 'pending' | 'in_progress' | 'completed';
          activeForm: string;
        }>;
      };

      const tasks = typedState.tasks || [];

      if (tasks.length === 0) {
        return {
          content: 'No tasks found. Consider using task_write to create a task list for complex work.',
          isError: false,
        };
      }

      // Calculate statistics
      const completed = tasks.filter(t => t.status === 'completed');
      const inProgress = tasks.filter(t => t.status === 'in_progress');
      const pending = tasks.filter(t => t.status === 'pending');
      const incomplete = [...inProgress, ...pending];
      const allDone = incomplete.length === 0;

      // Build detailed response
      let response = `Task Status: [${completed.length}/${tasks.length} completed]\n`;
      response += `- Completed: ${completed.length}\n`;
      response += `- In Progress: ${inProgress.length}\n`;
      response += `- Pending: ${pending.length}\n`;
      response += `\nAll tasks completed: ${allDone ? '✓ YES' : '✗ NO'}`;

      if (!allDone) {
        response += '\n\nIncomplete tasks:';
        if (inProgress.length > 0) {
          response += '\n\nIn Progress:';
          inProgress.forEach(t => {
            response += `\n- ${t.content}`;
          });
        }
        if (pending.length > 0) {
          response += '\n\nPending:';
          pending.forEach(t => {
            response += `\n- ${t.content}`;
          });
        }
        response += '\n\nContinue working on these tasks before ending.';
      }

      return {
        content: response,
        isError: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: `Failed to check tasks: ${msg}`,
        isError: true,
      };
    }
  },
});

// =============================================================================
// Subagent Tool
// =============================================================================

export interface CreateSubagentToolOptions {
  subagents: HarnessSubagent[];
  resolveModel: (modelId: string) => MastraLanguageModel;
  /** Resolved harness tools (already evaluated from DynamicArgument) */
  harnessTools?: ToolsInput;
  /** Fallback model ID when subagent definition has no defaultModelId */
  fallbackModelId?: string;
  /** Returns the parent model ID for display when a subagent call is forked. */
  getParentModelId?: () => string;
  /**
   * Returns the parent Agent that owns the current run. Invoked when a
   * subagent call is forked so the fork can reuse the parent's
   * instructions, tools, and model to preserve prompt-cache prefix.
   */
  getParentAgent?: () => Agent | undefined;
  /**
   * Clones the parent thread so a forked subagent can run on a copy
   * without polluting the parent conversation. Typically delegates to
   * `Harness.cloneThread`. Returns the new thread metadata.
   */
  cloneThreadForFork?: (opts: {
    sourceThreadId: string;
    resourceId?: string;
    title?: string;
  }) => Promise<{ id: string; resourceId: string }>;
  /**
   * Resolves the toolsets the parent agent runs with for the current request.
   * When set, forked subagents inherit the parent's toolsets so harness-injected
   * tools like `ask_user` / `submit_plan` / user-configured harness tools remain
   * available inside the fork. The `subagent` entry is preserved for prompt-cache
   * stability, but its runtime execute function is patched to block recursion.
   */
  getParentToolsets?: (requestContext?: RequestContext) => Promise<ToolsetsInput | undefined>;
}

/**
 * Creates a `subagent` tool from registered subagent definitions.
 * The tool spawns a fresh Agent per invocation with constrained tools,
 * streams the response, and forwards events to the harness.
 */
export function createSubagentTool(opts: CreateSubagentToolOptions) {
  const { subagents, resolveModel, harnessTools, fallbackModelId } = opts;

  const subagentIds = subagents.map(s => s.id);

  const typeDescriptions = subagents.map(s => `- **${s.id}** (${s.name}): ${s.description}`).join('\n');

  return createTool({
    id: 'subagent',
    description: `Delegate a focused task to a specialized subagent. The subagent runs independently with a constrained toolset, then returns its findings as text.

Available agent types:
${typeDescriptions}

By default the subagent runs in its own context — it does NOT see the parent conversation history. Write a clear, self-contained task description.

Set \`forked: true\` for context-dependent parallel work that needs the parent conversation, prior tool results, or the parent tool environment. Omit it for self-contained delegation. A forked subagent reuses the parent agent's instructions and tools so the prompt prefix stays cache-friendly.

Use this tool when:
- You want to run multiple investigations in parallel
- The task is self-contained and can be delegated`,
    inputSchema: z.object({
      agentType: z.enum(subagentIds as [string, ...string[]]).describe('Type of subagent to spawn'),
      task: z
        .string()
        .describe(
          'Clear, self-contained description of what the subagent should do. For non-forked subagents include all relevant context — the subagent cannot see the parent conversation.',
        ),
      modelId: z
        .string()
        .optional()
        .describe(
          "Optional model ID override for this task. Ignored when `forked: true` (the parent agent's model is used).",
        ),
      forked: z
        .boolean()
        .optional()
        .describe(
          "If true, fork the parent conversation: clone the parent thread and run with the parent agent's instructions/tools so prompt cache is preserved. Requires memory to be configured on the Harness. Defaults to the subagent definition's `forked` setting.",
        ),
    }),
    execute: async (input, context) => {
      const { agentType, modelId, forked } = input;
      let { task } = input;
      const displayTask = task;
      const definition = subagents.find(s => s.id === agentType);
      if (!definition) {
        return {
          content: `Unknown agent type: ${agentType}. Valid types: ${subagentIds.join(', ')}`,
          isError: true,
        };
      }

      const harnessCtx = context?.requestContext?.get('harness') as HarnessRequestContext | undefined;
      const emitEvent = harnessCtx?.emitEvent;
      const abortSignal = harnessCtx?.abortSignal;
      const toolCallId = context?.agent?.toolCallId ?? 'unknown';
      const workspace = context?.workspace;

      const runAsForked = forked ?? definition.forked ?? false;

      // Per-invocation state produced by either the forked or non-forked setup path.
      let subagentToRun: Agent;
      let resolvedModelId: string;
      let subagentRequestContext: RequestContext | undefined;
      let streamMemory: { thread: string; resource?: string } | undefined;
      let streamMaxSteps: number | undefined;
      let streamStopWhen: HarnessSubagent['stopWhen'];
      let streamPrepareStep: ((args: { tools?: Record<string, unknown> }) => { activeTools: string[] }) | undefined;
      let forkedToolsets: ToolsetsInput | undefined;

      if (runAsForked) {
        // Forked path: reuse the parent agent + a clone of the parent thread so the
        // request prefix (system prompt + tool schemas + history) stays identical and
        // the prompt cache hits. The subagent definition's instructions/tools/model
        // are intentionally ignored in this path.
        const parentAgent = opts.getParentAgent?.();
        if (!parentAgent) {
          return {
            content: 'Forked subagent requires a parent agent. None is configured on this Harness.',
            isError: true,
          };
        }
        const parentThreadId = harnessCtx?.threadId;
        if (!parentThreadId) {
          return {
            content: 'Forked subagent requires an active parent thread; none is set on the Harness.',
            isError: true,
          };
        }
        if (!opts.cloneThreadForFork) {
          return {
            content:
              'Forked subagent requires memory to be configured on the Harness so the parent thread can be cloned.',
            isError: true,
          };
        }

        // The parent stream batches message saves through a debounced save
        // queue (see SaveQueueManager). If we clone straight away, the parent's
        // user message (and the assistant turn that produced this tool call)
        // are still in-memory, not in the store — and the clone ends up empty.
        // Drain the queue first so the fork actually carries the prior
        // conversation.
        await context?.agent?.flushMessages?.().catch(() => {
          // Non-fatal: a failed flush just means the fork may be missing the
          // very latest turn. Still proceed with the clone.
        });

        let forkedThread: { id: string; resourceId: string };
        try {
          forkedThread = await opts.cloneThreadForFork({
            sourceThreadId: parentThreadId,
            resourceId: harnessCtx?.resourceId,
            title: `Fork: ${definition.name} subagent`,
          });
        } catch (err) {
          return {
            content: `Failed to clone parent thread for forked subagent: ${err instanceof Error ? err.message : String(err)}`,
            isError: true,
          };
        }

        subagentToRun = parentAgent;
        // Display value only; forked runs use the parent agent's configured model.
        resolvedModelId = opts.getParentModelId?.() || 'parent-agent';
        task = `${task}\n\n${FORKED_SUBAGENT_NESTING_NOTICE}`;
        streamMemory = { thread: forkedThread.id, resource: forkedThread.resourceId };
        // Allow a recovery step if the forked model accidentally calls the
        // inherited-but-disabled `subagent` tool. Without this, the single-step
        // default can return only the stub tool result instead of the answer.
        streamMaxSteps = 1000;
        streamStopWhen = undefined;
        streamPrepareStep = undefined;

        if (context?.requestContext) {
          subagentRequestContext = new RequestContext(context.requestContext.entries());
          if (harnessCtx) {
            // Point at the fork so inherited tools (recall, browser, OM, memory writes, etc.)
            // operate on the cloned thread instead of the active parent thread.
            subagentRequestContext.set('harness', {
              ...harnessCtx,
              threadId: forkedThread.id,
              resourceId: forkedThread.resourceId,
            });
          }
        }

        // Inherit the parent's toolsets with the fork request context so tools that
        // close over request-scoped state use the cloned thread/resource. Preserve
        // `subagent` in the tool schema to keep the prompt-cache prefix stable, but
        // patch its runtime execute function so nested forks fail gracefully.
        const inheritedToolsets = await opts.getParentToolsets?.(subagentRequestContext);
        if (inheritedToolsets) {
          forkedToolsets = {};
          for (const [setName, setTools] of Object.entries(inheritedToolsets)) {
            const patched: ToolsInput = {};
            for (const [toolId, tool] of Object.entries(setTools as ToolsInput)) {
              if (toolId === 'subagent') {
                patched[toolId] = patchSubagentToolForFork(tool);
              } else {
                patched[toolId] = tool;
              }
            }
            forkedToolsets[setName] = patched;
          }
        }
      } else {
        // Non-forked path: fresh Agent with the subagent's own instructions/tools/model.
        // Merge tools: subagent's own tools + filtered harness tools
        const mergedTools: ToolsInput = { ...definition.tools };
        if (definition.allowedHarnessTools && harnessTools) {
          for (const toolId of definition.allowedHarnessTools) {
            if (harnessTools[toolId] && !mergedTools[toolId]) {
              mergedTools[toolId] = harnessTools[toolId];
            }
          }
        }

        // Resolve model: explicit arg → harness setting → subagent default → fallback
        const harnessModelId = harnessCtx?.getSubagentModelId?.({ agentType }) ?? undefined;
        const maybeModelId = modelId ?? harnessModelId ?? definition.defaultModelId ?? fallbackModelId;
        if (!maybeModelId) {
          return { content: 'No model ID available for subagent. Configure defaultModelId.', isError: true };
        }
        resolvedModelId = maybeModelId;

        let model: MastraLanguageModel;
        try {
          model = resolveModel(resolvedModelId);
        } catch (err) {
          return {
            content: `Failed to resolve model "${resolvedModelId}": ${err instanceof Error ? err.message : String(err)}`,
            isError: true,
          };
        }

        subagentToRun = new Agent({
          id: `subagent-${definition.id}`,
          name: `${definition.name} Subagent`,
          instructions: definition.instructions,
          model,
          tools: mergedTools,
          workspace,
        });

        // Only resolve workspace tool names when an allowlist is configured,
        // avoiding unnecessary createWorkspaceTools overhead for subagents
        // that don't restrict workspace tools.
        const allowedWs = definition.allowedWorkspaceTools ? new Set(definition.allowedWorkspaceTools) : undefined;
        const allWorkspaceToolNames =
          workspace && allowedWs
            ? new Set(
                Object.keys(
                  await createWorkspaceTools(workspace, {
                    requestContext: context?.requestContext ?? {},
                    workspace,
                  }),
                ),
              )
            : undefined;

        streamMaxSteps = definition.maxSteps ?? (definition.stopWhen ? undefined : 50);
        streamStopWhen = definition.stopWhen;
        streamPrepareStep =
          allowedWs && allWorkspaceToolNames
            ? ({ tools }) => ({
                activeTools: Object.keys(tools ?? {}).filter(k => !allWorkspaceToolNames.has(k) || allowedWs!.has(k)),
              })
            : undefined;

        // Build a request context for the subagent that inherits sandbox paths
        // and harness state but strips threadId/resourceId so the subagent
        // doesn't trigger OM enrichment on the parent's memory thread.
        if (context?.requestContext) {
          subagentRequestContext = new RequestContext(context.requestContext.entries());
          if (harnessCtx) {
            subagentRequestContext.set('harness', { ...harnessCtx, threadId: null, resourceId: '' });
          }
        }
      }

      const startTime = Date.now();

      emitEvent?.({
        type: 'subagent_start',
        toolCallId,
        agentType,
        task: displayTask,
        modelId: resolvedModelId,
        forked: runAsForked,
      });

      let partialText = '';

      try {
        const response = await subagentToRun.stream(task, {
          maxSteps: streamMaxSteps,
          stopWhen: streamStopWhen,
          abortSignal,
          requireToolApproval: false,
          requestContext: subagentRequestContext,
          ...(streamMemory && { memory: streamMemory }),
          ...(forkedToolsets && { toolsets: forkedToolsets }),
          ...(context?.tracingContext && { tracingContext: context.tracingContext }),
          prepareStep: streamPrepareStep,
        });

        for await (const chunk of response.fullStream) {
          switch (chunk.type) {
            case 'text-delta':
              partialText += chunk.payload.text;
              emitEvent?.({
                type: 'subagent_text_delta',
                toolCallId,
                agentType,
                textDelta: chunk.payload.text,
              });
              break;

            case 'tool-call':
              if (!(runAsForked && chunk.payload.toolName === 'subagent')) {
                emitEvent?.({
                  type: 'subagent_tool_start',
                  toolCallId,
                  agentType,
                  subToolName: chunk.payload.toolName,
                  subToolArgs: chunk.payload.args,
                });
              }
              break;

            case 'tool-result': {
              const isErr = chunk.payload.isError ?? false;
              if (!(runAsForked && chunk.payload.toolName === 'subagent')) {
                emitEvent?.({
                  type: 'subagent_tool_end',
                  toolCallId,
                  agentType,
                  subToolName: chunk.payload.toolName,
                  subToolResult: chunk.payload.result,
                  isError: isErr,
                });
              }
              break;
            }
          }
        }

        if (abortSignal?.aborted) {
          const durationMs = Date.now() - startTime;
          const abortResult = partialText
            ? `[Aborted by user]\n\nPartial output:\n${partialText}`
            : '[Aborted by user]';

          emitEvent?.({ type: 'subagent_end', toolCallId, agentType, result: abortResult, isError: false, durationMs });
          // Intentionally do NOT append `<subagent-meta />` to model-facing
          // content: when the parent model can see the tag in a tool result
          // it sometimes echoes the literal markup back into its own assistant
          // text on the next turn. Live UIs get model/duration/tool data from
          // the structured `subagent_*` events emitted above; history UIs read
          // the persisted `tool_call.args.modelId`. Older persisted threads
          // that still carry the tag are handled by `parseSubagentMeta` for
          // backward compatibility.
          return { content: abortResult, isError: false };
        }

        const fullOutput = await response.getFullOutput();
        const resultText = fullOutput.text || partialText;

        const durationMs = Date.now() - startTime;
        emitEvent?.({ type: 'subagent_end', toolCallId, agentType, result: resultText, isError: false, durationMs });

        return { content: resultText, isError: false };
      } catch (err) {
        const isAbort =
          err instanceof Error &&
          (err.name === 'AbortError' || err.message?.includes('abort') || err.message?.includes('cancel'));
        const durationMs = Date.now() - startTime;

        if (isAbort) {
          const abortResult = partialText
            ? `[Aborted by user]\n\nPartial output:\n${partialText}`
            : '[Aborted by user]';

          emitEvent?.({ type: 'subagent_end', toolCallId, agentType, result: abortResult, isError: false, durationMs });

          return { content: abortResult, isError: false };
        }

        const message = err instanceof Error ? err.message : String(err);
        emitEvent?.({ type: 'subagent_end', toolCallId, agentType, result: message, isError: true, durationMs });

        return { content: `Subagent "${definition.name}" failed: ${message}`, isError: true };
      }
    },
  });
}

/**
 * Returns a copy of the parent's `subagent` tool with `execute` replaced by a
 * stub that refuses to dispatch a nested fork.
 *
 * Why patch instead of remove or replace wholesale:
 *  - Forked subagents reuse the parent Agent's `stream()` so the LLM request
 *    prefix (system prompt + tool list + tool schemas + tool descriptions)
 *    matches the parent byte-for-byte. This is what makes prompt-cache hits
 *    possible inside a fork, which is the whole reason forked mode exists.
 *  - Removing the `subagent` entry from the inherited toolset, or replacing
 *    its description / parameters with anything else, perturbs that prefix
 *    and invalidates the cache.
 *  - Replacing only `execute` is invisible to the LLM (execute lives in the
 *    runtime, not in the request payload) but lets us reject recursive
 *    invocations cleanly at runtime.
 *
 * The stub returns a tool-level error result with a clear human-readable
 * recovery instruction. This does not fail the outer subagent run; the model
 * receives the tool error and can continue with a direct answer.
 */
function patchSubagentToolForFork(tool: unknown): any {
  const stubExecute = async () => ({
    content: FORKED_SUBAGENT_NESTING_NOTICE,
    isError: true,
  });
  // Spread preserves id / description / inputSchema / parameters / outputSchema
  // / providerOptions / strict / requireApproval / etc. on whatever shape the
  // tool came in as (Mastra `Tool` instance, AI SDK v4/v5 `tool({ ... })`
  // object, provider-defined tool). `Object.assign` on a fresh object keeps
  // own enumerable props; that is enough for the toolset-merge layer to
  // serialize the same schema/description into the model request.
  return Object.assign({}, tool as Record<string, unknown>, { execute: stubExecute });
}

/**
 * Parse subagent metadata from a tool result string.
 *
 * Older persisted threads may have an internal `<subagent-meta />` tag
 * appended to the subagent tool result content (carrying modelId / durationMs
 * / sub-tool-call summary, used by history-render UIs to reconstruct the
 * subagent activity box when live events aren't available).
 *
 * New runs no longer append the tag — the metadata leaked into model context
 * and could be echoed back as visible assistant text — but this parser is
 * retained so existing threads continue to render cleanly. It also strips the
 * tag so callers never display it to users.
 *
 * Returns the cleaned text plus any parsed metadata.
 */
export function parseSubagentMeta(content: string): {
  text: string;
  modelId?: string;
  durationMs?: number;
  toolCalls?: Array<{ name: string; isError: boolean }>;
} {
  const match = content.match(/\n<subagent-meta modelId="([^"]*)" durationMs="(\d+)" tools="([^"]*)" \/>$/);
  if (!match) return { text: content };

  const text = content.slice(0, match.index!);
  const modelId = match[1];
  const durationMs = parseInt(match[2]!, 10);
  const toolCalls = match[3]
    ? match[3]
        .split(',')
        .filter(Boolean)
        .map(entry => {
          const [name, status] = entry.split(':');
          return { name: name!, isError: status === 'err' };
        })
    : [];

  return { text, modelId, durationMs, toolCalls };
}
