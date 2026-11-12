import type { ToolSet } from '@internal/ai-sdk-v5';
import type { IMastraLogger } from '../../../logger';
import type { RequestContext } from '../../../request-context';
import type { RequireToolApproval } from '../../../tools';
import { findProviderToolByName } from '../../../tools/provider-tool-utils';
import { getNeedsApprovalFn } from '../../../tools/toolchecks';
import type { ToolApprovalContext } from '../../../tools/types';
import type { ToolCallConcurrency, ToolCallConcurrencyStrategy } from '../../types';
import { buildToolApprovalContext, resolveToolApprovalVerdict } from './tool-approval-verdict';

export type ToolCallForeachOptions = {
  concurrency: number;
};

const DEFAULT_TOOL_CALL_CONCURRENCY = 10;

/**
 * Normalize the public `toolCallConcurrency` option (a number or an object with
 * `limit`/`strategy`) into a resolved `{ limit, strategy }` pair.
 */
export function normalizeToolCallConcurrency(toolCallConcurrency: ToolCallConcurrency | undefined): {
  limit: number;
  strategy: ToolCallConcurrencyStrategy;
} {
  if (typeof toolCallConcurrency === 'object' && toolCallConcurrency !== null) {
    const limit = toolCallConcurrency.limit;
    return {
      limit: typeof limit === 'number' && limit > 0 ? limit : DEFAULT_TOOL_CALL_CONCURRENCY,
      strategy: toolCallConcurrency.strategy ?? 'available',
    };
  }
  return {
    limit: toolCallConcurrency && toolCallConcurrency > 0 ? toolCallConcurrency : DEFAULT_TOOL_CALL_CONCURRENCY,
    strategy: 'available',
  };
}

export function resolveConfiguredToolCallConcurrency(toolCallConcurrency: ToolCallConcurrency | undefined): number {
  return normalizeToolCallConcurrency(toolCallConcurrency).limit;
}

/**
 * Whether a step's tool calls must run one at a time.
 *
 * Only suspend-capable tools force sequential execution. Approval never does: an approval-gated
 * call parks before it executes, so every gated call in a step can reach its gate at once and be
 * resumed by its `toolCallId` while the others stay parked (#30152).
 *
 * The exception is a delegated sub-agent run (`serializeApprovals`): its delegation surfaces one
 * pause at a time and resumes it without a target, so there any approval source (run-wide
 * `requireToolApproval`, a static `requireApproval` or a `needsApprovalFn`) still forces
 * sequential execution.
 */
export function effectiveToolSetRequiresSequentialExecution({
  tools,
  activeTools,
  strategy = 'available',
  calledToolNames,
  serializeApprovals = false,
  requireToolApproval,
}: {
  tools?: ToolSet;
  serializeApprovals?: boolean;
  requireToolApproval?: RequireToolApproval;
  activeTools?: readonly string[];
  strategy?: ToolCallConcurrencyStrategy;
  // The tool names the model actually called this step. Only consulted under the
  // `'called'` strategy; when omitted there, nothing forces sequential (a batch
  // that called no suspend-capable tool cannot suspend this step).
  calledToolNames?: readonly string[];
}): boolean {
  if (serializeApprovals && requireToolApproval) {
    return true;
  }
  if (!tools) {
    return false;
  }

  const consideredToolEntries =
    strategy === 'called'
      ? (calledToolNames ?? []).flatMap(toolName => {
          // Mirror the tool-call step's lookup (key, provider name, then tool id).
          const tool =
            tools[toolName] ||
            findProviderToolByName(tools, toolName) ||
            Object.values(tools).find(t => 'id' in t && t.id === toolName);
          return tool ? ([[toolName, tool]] as const) : [];
        })
      : activeTools === undefined
        ? Object.entries(tools)
        : activeTools.flatMap(toolName => {
            const tool = tools[toolName];
            return tool ? ([[toolName, tool]] as const) : [];
          });

  return consideredToolEntries.some(
    ([, tool]) =>
      Boolean((tool as { hasSuspendSchema?: unknown }).hasSuspendSchema) ||
      (serializeApprovals &&
        (Boolean((tool as { requireApproval?: unknown }).requireApproval) || Boolean(getNeedsApprovalFn(tool)))),
  );
}

export function resolveToolCallConcurrency({
  tools,
  activeTools,
  configuredConcurrency,
  strategy,
  calledToolNames,
  serializeApprovals,
  requireToolApproval,
}: {
  tools?: ToolSet;
  activeTools?: readonly string[];
  configuredConcurrency: number;
  strategy?: ToolCallConcurrencyStrategy;
  calledToolNames?: readonly string[];
  serializeApprovals?: boolean;
  requireToolApproval?: RequireToolApproval;
}): number {
  return effectiveToolSetRequiresSequentialExecution({
    tools,
    activeTools,
    strategy,
    calledToolNames,
    serializeApprovals,
    requireToolApproval,
  })
    ? 1
    : configuredConcurrency;
}

export function updateToolCallForeachConcurrency(
  options: ToolCallForeachOptions,
  args: Parameters<typeof resolveToolCallConcurrency>[0],
) {
  options.concurrency = resolveToolCallConcurrency(args);
}

/**
 * Resolves concurrency for a step once the model's tool calls are known.
 *
 * Each called tool's approval verdict is evaluated with the call's actual arguments (the same rule
 * the tool-call step applies) and cached in `approvalVerdicts`, so a stateful policy runs once per
 * call. Verdicts do not affect concurrency: gated calls park side by side (#30152). A called tool
 * that cannot be resolved or has a suspend schema forces sequential execution, and under
 * `'available'` so does any active suspend-capable tool. In a delegated sub-agent run
 * (`serializeApprovals`) a call whose verdict requires approval also forces sequential execution.
 */
export async function resolveEmittedToolCallConcurrency({
  toolCalls,
  approvalVerdicts,
  requireToolApproval,
  requestContext,
  workspace,
  logger,
  serializeApprovals = false,
  ...args
}: Omit<Parameters<typeof resolveToolCallConcurrency>[0], 'requireToolApproval' | 'serializeApprovals'> & {
  serializeApprovals?: boolean;
  toolCalls: readonly { toolCallId?: string; toolName: string; args?: unknown }[];
  approvalVerdicts?: Map<string, boolean>;
  requireToolApproval?: RequireToolApproval;
  requestContext?: RequestContext;
  workspace?: ToolApprovalContext['workspace'];
  logger?: IMastraLogger;
}): Promise<number> {
  const forcesSequential = await Promise.all(
    toolCalls.map(async toolCall => {
      // Mirror the tool-call step's lookup (key, provider name, then tool id).
      const tool =
        args.tools?.[toolCall.toolName] ||
        findProviderToolByName(args.tools, toolCall.toolName) ||
        Object.values(args.tools || {}).find(t => 'id' in t && t.id === toolCall.toolName);
      if (!tool) {
        return true;
      }
      if ((tool as { hasSuspendSchema?: unknown }).hasSuspendSchema) {
        return true;
      }
      const toolArgs =
        typeof toolCall.args === 'object' && toolCall.args !== null
          ? (({ resumeData: _resumeData, ...rest }) => rest)(toolCall.args as Record<string, unknown>)
          : (toolCall.args as ToolApprovalContext['args']);
      const verdict = await resolveToolApprovalVerdict({
        tool,
        requireToolApproval,
        context: buildToolApprovalContext({
          toolName: toolCall.toolName,
          args: toolArgs,
          requestContext,
          workspace,
        }),
        logger,
      });
      if (toolCall.toolCallId) {
        approvalVerdicts?.set(toolCall.toolCallId, verdict);
      }
      return serializeApprovals && verdict;
    }),
  );

  if (forcesSequential.some(Boolean)) {
    return 1;
  }
  return args.strategy !== 'called' && effectiveToolSetRequiresSequentialExecution(args)
    ? 1
    : args.configuredConcurrency;
}
