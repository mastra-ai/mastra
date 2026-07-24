import { z } from 'zod/v4';

import { Agent } from '../agent';
import type { ToolsInput, ToolsetsInput } from '../agent/types';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '../channels/output-processor';
import type { MastraModelConfig } from '../llm/model/shared.types';
import type { Mastra } from '../mastra';
import { RequestContext } from '../request-context';
import { askUserTool } from '../tools/builtin/ask-user';
import { submitPlanTool } from '../tools/builtin/submit-plan';
import { summarizeTaskCheck } from '../tools/builtin/task-tools';
import { createTool } from '../tools/tool';
import { createWorkspaceTools } from '../workspace/tools/tools';

import type { AgentControllerRequestContext, AgentControllerSubagent } from './types';

// `ask_user` is an agent-agnostic built-in tool. It is defined in
// `../tools/builtin/ask-user` and re-exported here so the AgentController toolset and
// existing imports keep referencing the same tool object (preserving toolset
// identity and the prompt-cache prefix). It pauses via the native tool
// suspension primitive rather than any controller-specific request context.
export { askUserTool };

const FORKED_SUBAGENT_NESTING_NOTICE =
  'Do not call the `subagent` tool. You are currently running inside a forked subagent, and this is the maximum allowed subagent nesting level. Further subagent calls will return an error. Answer the task directly using the conversation history and the other tools available to you.';

const FORKED_SUBAGENT_TASK_NOTICE =
  'Do not call `task_write`, `task_update`, `task_complete`, or `task_check` inside a forked subagent. Forked subagents keep the parent task-tool schemas for prompt-cache stability, but the parent agent owns the visible task list. Track forked subagent work in your final answer instead.';

// `submit_plan` is an agent-agnostic built-in tool. It is defined in
// `../tools/builtin/submit-plan` and re-exported here so the AgentController toolset and
// existing imports keep referencing the same tool object (preserving toolset
// identity and the prompt-cache prefix). It pauses via the native tool
// suspension primitive rather than any controller-specific request context; the
// AgentController layers its plan→default mode switch on top of the approval in its own
// `respondToToolSuspension` handling.
export { submitPlanTool };

// =============================================================================
// Task Tools
// =============================================================================
//
// The four task tools are agent-agnostic built-ins defined in
// `../tools/builtin/task-tools`. They persist the task list through the agent
// state-signal lane (see `../tools/builtin/task-state-processor`) and no longer
// depend on the AgentController request context. They are re-exported here so the
// AgentController toolset and existing imports keep referencing the same tool objects
// (preserving toolset identity and the prompt-cache prefix).
export {
  taskWriteTool,
  taskUpdateTool,
  taskCompleteTool,
  taskCheckTool,
  assignTaskIds,
  summarizeTaskCheck,
} from '../tools/builtin/task-tools';
export type {
  TaskItem,
  TaskItemInput,
  TaskItemSnapshot,
  TaskCheckResult,
  TaskCheckSummary,
} from '../tools/builtin/task-tools';
export { TaskStateProcessor } from '../tools/builtin/task-state-processor';

// =============================================================================
// Subagent Tool
// =============================================================================

export interface CreateSubagentToolOptions {
  subagents: AgentControllerSubagent[];
  resolveModel: (modelId: string) => MastraModelConfig;
  /** Resolved controller tools (already evaluated from DynamicArgument) */
  controllerTools?: ToolsInput;
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
   * `AgentController.cloneThread`. Returns the new thread metadata.
   */
  cloneThreadForFork?: (opts: {
    sourceThreadId: string;
    resourceId?: string;
    title?: string;
  }) => Promise<{ id: string; resourceId: string }>;
  /**
   * Resolves the toolsets the parent agent runs with for the current request.
   * When set, forked subagents inherit the parent's toolsets so controller-injected
   * tools like `ask_user` / `submit_plan` / user-configured controller tools remain
   * available inside the fork. The `subagent` entry is preserved for prompt-cache
   * stability, but its runtime execute function is patched to block recursion.
   */
  getParentToolsets?: (requestContext?: RequestContext) => Promise<ToolsetsInput | undefined>;
  /**
   * Internal Mastra instance passed to each subagent Agent constructor so the
   * bare model id resolves through the same gateways as the parent and the
   * agent inherits pubsub/observability.
   */
  mastra?: Mastra;
}

/**
 * Creates a `subagent` tool from registered subagent definitions.
 * The tool spawns a fresh Agent per invocation with constrained tools,
 * streams the response, and forwards events to the controller.
 */
export function createSubagentTool(opts: CreateSubagentToolOptions) {
  const { subagents, resolveModel, controllerTools, fallbackModelId, mastra } = opts;

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
          "If true, fork the parent conversation: clone the parent thread and run with the parent agent's instructions/tools so prompt cache is preserved. Requires memory to be configured on the AgentController. Defaults to the subagent definition's `forked` setting.",
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

      const controllerCtx = context?.requestContext?.get('controller') as AgentControllerRequestContext | undefined;
      const emitEvent = controllerCtx?.emitEvent;
      const abortSignal = controllerCtx?.abortSignal;
      const toolCallId = context?.agent?.toolCallId ?? 'unknown';
      const workspace = context?.workspace;

      const runAsForked = forked ?? definition.forked ?? false;

      // Per-invocation state produced by either the forked or non-forked setup path.
      let subagentToRun: Agent;
      let resolvedModelId: string;
      let subagentRequestContext: RequestContext | undefined;
      let streamMemory: { thread: string; resource?: string } | undefined;
      let streamMaxSteps: number | undefined;
      let streamStopWhen: AgentControllerSubagent['stopWhen'];
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
            content: 'Forked subagent requires a parent agent. None is configured on this AgentController.',
            isError: true,
          };
        }
        const parentThreadId = controllerCtx?.threadId;
        if (!parentThreadId) {
          return {
            content: 'Forked subagent requires an active parent thread; none is set on the AgentController.',
            isError: true,
          };
        }
        if (!opts.cloneThreadForFork) {
          return {
            content:
              'Forked subagent requires memory to be configured on the AgentController so the parent thread can be cloned.',
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
            resourceId: controllerCtx?.resourceId,
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
        task = `${task}\n\n${FORKED_SUBAGENT_NESTING_NOTICE}\n\n${FORKED_SUBAGENT_TASK_NOTICE}`;
        streamMemory = { thread: forkedThread.id, resource: forkedThread.resourceId };
        // Allow a recovery step if the forked model accidentally calls the
        // inherited-but-disabled `subagent` tool. Without this, the single-step
        // default can return only the stub tool result instead of the answer.
        streamMaxSteps = 1000;
        streamStopWhen = undefined;
        streamPrepareStep = undefined;

        if (context?.requestContext) {
          subagentRequestContext = new RequestContext(context.requestContext.entries());
          if (controllerCtx) {
            // Point at the fork so inherited tools (recall, browser, OM, memory writes, etc.)
            // operate on the cloned thread instead of the active parent thread.
            subagentRequestContext.set('controller', {
              ...controllerCtx,
              threadId: forkedThread.id,
              resourceId: forkedThread.resourceId,
            });
          }
          // The fork runs on the channel-bearing parent agent instance, so the
          // ChatChannelOutputProcessor is attached. Clear the inherited render
          // key so the subagent's stream never renders back to the chat
          // platform — without this the fork would post to Slack.
          subagentRequestContext.delete(CHAT_CHANNEL_RENDER_CONTEXT_KEY);
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
              } else if (isForkedTaskToolId(toolId)) {
                patched[toolId] = patchTaskToolForFork(tool, toolId);
              } else {
                patched[toolId] = tool;
              }
            }
            forkedToolsets[setName] = patched;
          }
        }
      } else {
        // Non-forked path: fresh Agent with the subagent's own instructions/tools/model.
        // Merge tools: subagent's own tools + filtered controller tools
        const mergedTools: ToolsInput = { ...definition.tools };
        if (definition.allowedControllerTools && controllerTools) {
          for (const toolId of definition.allowedControllerTools) {
            if (controllerTools[toolId] && !mergedTools[toolId]) {
              mergedTools[toolId] = controllerTools[toolId];
            }
          }
        }

        // Resolve model: explicit arg → controller setting → subagent default → fallback
        const controllerModelId = controllerCtx?.getSubagentModelId?.({ agentType }) ?? undefined;
        const maybeModelId = modelId ?? controllerModelId ?? definition.defaultModelId ?? fallbackModelId;
        if (!maybeModelId) {
          return { content: 'No model ID available for subagent. Configure defaultModelId.', isError: true };
        }
        resolvedModelId = maybeModelId;

        let model: MastraModelConfig;
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
          mastra,
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
        // and controller state but strips threadId/resourceId so the subagent
        // doesn't trigger OM enrichment on the parent's memory thread. This
        // subagent runs on a fresh Agent with no channels, so no output
        // processor attaches and it never renders to the chat platform.
        if (context?.requestContext) {
          subagentRequestContext = new RequestContext(context.requestContext.entries());
          if (controllerCtx) {
            subagentRequestContext.set('controller', {
              ...controllerCtx,
              threadId: null,
              resourceId: '',
            });
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

function isForkedTaskToolId(toolId: string): boolean {
  return toolId === 'task_write' || toolId === 'task_update' || toolId === 'task_complete' || toolId === 'task_check';
}

function patchTaskToolForFork(tool: unknown, toolId: string): any {
  const stubExecute = async () => {
    const baseResult = {
      content: FORKED_SUBAGENT_TASK_NOTICE,
      tasks: [],
      isError: true,
    };

    if (toolId === 'task_check') {
      const taskCheck = summarizeTaskCheck([]);
      return {
        ...baseResult,
        summary: taskCheck.summary,
        incompleteTasks: taskCheck.incompleteTasks,
      };
    }

    return baseResult;
  };

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
