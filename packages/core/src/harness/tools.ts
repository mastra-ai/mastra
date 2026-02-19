import { z } from 'zod';

import { Agent } from '../agent';
import type { ToolsInput } from '../agent/types';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import { createTool } from '../tools/tool';

import type { HarnessRequestContext, HarnessSubagent } from './types';

let questionCounter = 0;
let planCounter = 0;

/**
 * Built-in harness tool: ask the user a question and wait for their response.
 * Supports single-select options and free-text input.
 * The tool pauses execution while the UI shows the dialog.
 */
export const askUserTool = createTool({
  id: 'ask_user',
  description:
    'Ask the user a question and wait for their response. Use this when you need clarification, want to validate assumptions, or need the user to make a decision between options. Provide options for structured choices (2-4 options), or omit them for open-ended questions.',
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
  }),
  execute: async ({ question, options }, context) => {
    try {
      const harnessCtx = context?.requestContext?.get('harness') as HarnessRequestContext | undefined;

      if (!harnessCtx?.emitEvent || !harnessCtx?.registerQuestion) {
        return {
          content: `[Question for user]: ${question}${options ? '\nOptions: ' + options.map(o => o.label).join(', ') : ''}`,
          isError: false,
        };
      }

      const questionId = `q_${++questionCounter}_${Date.now()}`;

      const answer = await new Promise<string>((resolve, reject) => {
        const signal = harnessCtx.abortSignal;
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
        signal?.addEventListener('abort', onAbort, { once: true });

        harnessCtx.registerQuestion!(questionId, answer => {
          signal?.removeEventListener('abort', onAbort);
          resolve(answer);
        });

        harnessCtx.emitEvent!({
          type: 'ask_question',
          questionId,
          question,
          options,
        });
      });

      return { content: `User answered: ${answer}`, isError: false };
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

        harnessCtx.registerPlanApproval!(planId, res => {
          signal?.removeEventListener('abort', onAbort);
          resolve(res);
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
// Subagent Tool
// =============================================================================

export interface CreateSubagentToolOptions {
  subagents: HarnessSubagent[];
  resolveModel: (modelId: string) => MastraLanguageModel;
  /** Resolved harness tools (already evaluated from DynamicArgument) */
  harnessTools?: ToolsInput;
  /** Fallback model ID when subagent definition has no defaultModelId */
  fallbackModelId?: string;
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

The subagent runs in its own context — it does NOT see the parent conversation history. Write a clear, self-contained task description.

Use this tool when:
- You want to run multiple investigations in parallel
- The task is self-contained and can be delegated`,
    inputSchema: z.object({
      agentType: z.enum(subagentIds as [string, ...string[]]).describe('Type of subagent to spawn'),
      task: z
        .string()
        .describe(
          'Clear, self-contained description of what the subagent should do. Include all relevant context — the subagent cannot see the parent conversation.',
        ),
      modelId: z.string().optional().describe('Optional model ID override for this task.'),
    }),
    execute: async ({ agentType, task, modelId }, context) => {
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
      const harnessModelId = harnessCtx?.getSubagentModelId?.(agentType) ?? undefined;
      const resolvedModelId = modelId ?? harnessModelId ?? definition.defaultModelId ?? fallbackModelId;
      if (!resolvedModelId) {
        return { content: 'No model ID available for subagent. Configure defaultModelId.', isError: true };
      }

      let model: MastraLanguageModel;
      try {
        model = resolveModel(resolvedModelId);
      } catch (err) {
        return {
          content: `Failed to resolve model "${resolvedModelId}": ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
        };
      }

      const subagent = new Agent({
        id: `subagent-${definition.id}`,
        name: `${definition.name} Subagent`,
        instructions: definition.instructions,
        model,
        tools: mergedTools,
      });

      const startTime = Date.now();

      emitEvent?.({
        type: 'subagent_start',
        toolCallId,
        agentType,
        task,
        modelId: resolvedModelId,
      });

      let partialText = '';
      const toolCallLog: Array<{ name: string; toolCallId: string; isError?: boolean }> = [];

      try {
        const response = await subagent.stream(task, {
          maxSteps: 50,
          abortSignal,
          requireToolApproval: false,
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
              toolCallLog.push({ name: chunk.payload.toolName, toolCallId: chunk.payload.toolCallId });
              emitEvent?.({
                type: 'subagent_tool_start',
                toolCallId,
                agentType,
                subToolName: chunk.payload.toolName,
                subToolArgs: chunk.payload.args,
              });
              break;

            case 'tool-result': {
              const isErr = chunk.payload.isError ?? false;
              for (let i = toolCallLog.length - 1; i >= 0; i--) {
                if (toolCallLog[i]!.toolCallId === chunk.payload.toolCallId && toolCallLog[i]!.isError === undefined) {
                  toolCallLog[i]!.isError = isErr;
                  break;
                }
              }
              emitEvent?.({
                type: 'subagent_tool_end',
                toolCallId,
                agentType,
                subToolName: chunk.payload.toolName,
                subToolResult: chunk.payload.result,
                isError: isErr,
              });
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
          const meta = buildSubagentMeta(resolvedModelId, durationMs, toolCallLog);
          return { content: abortResult + meta, isError: false };
        }

        const fullOutput = await response.getFullOutput();
        const resultText = fullOutput.text || partialText;

        const durationMs = Date.now() - startTime;
        emitEvent?.({ type: 'subagent_end', toolCallId, agentType, result: resultText, isError: false, durationMs });

        const meta = buildSubagentMeta(resolvedModelId, durationMs, toolCallLog);
        return { content: resultText + meta, isError: false };
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

          const meta = buildSubagentMeta(resolvedModelId, durationMs, toolCallLog);
          return { content: abortResult + meta, isError: false };
        }

        const message = err instanceof Error ? err.message : String(err);
        emitEvent?.({ type: 'subagent_end', toolCallId, agentType, result: message, isError: true, durationMs });

        const meta = buildSubagentMeta(resolvedModelId, durationMs, toolCallLog);
        return { content: `Subagent "${definition.name}" failed: ${message}` + meta, isError: true };
      }
    },
  });
}

/**
 * Build a metadata tag appended to subagent results.
 * UIs can parse this to display model ID, duration, and tool calls
 * when loading from history (where live events aren't available).
 */
function buildSubagentMeta(
  modelId: string,
  durationMs: number,
  toolCalls: Array<{ name: string; isError?: boolean }>,
): string {
  const tools = toolCalls.map(tc => `${tc.name}:${tc.isError ? 'err' : 'ok'}`).join(',');
  return `\n<subagent-meta modelId="${modelId}" durationMs="${durationMs}" tools="${tools}" />`;
}

/**
 * Parse subagent metadata from a tool result string.
 * Returns the metadata and the cleaned result text (without the tag).
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
