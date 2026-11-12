import { backgroundProcessPid } from '../background/background-process';
import type { MessageMetadata, SuspendedToolMetadata, ToolApprovalMetadata } from '../messages/message-metadata';
import type { ToolPartFields } from '../messages/renderers/tool-part';
import { isRecord } from '../messages/signal-data';
import { KNOWLEDGE_TOOLS, knowledgeCard } from './badges/knowledge-tool-badge';
import { sandboxExit } from './badges/workspace-data-parts';
import { getCodeModeCall } from './code-mode';
import { CONNECT_PROMPT_TOOL_NAME } from './connect-prompt-tool-id';
import { suspendedMcpInputRequest } from './mcp-input-request';
import { SUBMIT_PLAN_TOOL_ID } from './submit-plan-tool-id';
import type { DataMessagePart } from './tool-card';
import { WORKSPACE_TOOLS } from './workspace-tool-constants';
import { isConnectPromptPayload } from '@/domains/connect/types';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import { exitedWithFailure, isTaskTool } from '@/ds/components/ai/tool-call';

/** Which card draws a call. Decided once, shared by the dispatcher and the fold. */
export type ToolCardKind =
  | 'hidden'
  | 'observation'
  | 'ask_user'
  | 'connect_prompt'
  | 'submit_plan'
  | 'mcp_input_request'
  | 'background'
  | 'agent'
  | 'workflow'
  | 'file_tree'
  | 'sandbox'
  | 'background_command'
  | 'code_mode'
  | 'mcp_app'
  | 'knowledge'
  | 'plain';

export interface ToolCardContext {
  metadata?: MessageMetadata;
  mcpAppTools?: Record<string, unknown>;
}

export interface ToolInteraction {
  approval?: ToolApprovalMetadata;
  suspended?: SuspendedToolMetadata;
}

const SANDBOX_TOOLS = new Set<string>([
  WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
  WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT,
  WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS,
]);

const hasSubmitPlanToolId = (value: unknown): boolean => isRecord(value) && value.toolId === SUBMIT_PLAN_TOOL_ID;

const isNetworkFrom = (metadata: MessageMetadata | undefined, from: string): boolean =>
  metadata?.mode === 'network' && metadata.from === from;

export const isAgentCall = (metadata: MessageMetadata | undefined, toolName: string): boolean =>
  isNetworkFrom(metadata, 'AGENT') || toolName.startsWith('agent-');

export const isWorkflowCall = (metadata: MessageMetadata | undefined, toolName: string): boolean =>
  isNetworkFrom(metadata, 'WORKFLOW') || toolName.startsWith('workflow-');

export const isSettledState = (state: string | undefined): boolean =>
  state === 'output-available' || state === 'result';

const BACKGROUND_TASK_ENDED: ReadonlySet<string | undefined> = new Set([
  'completed',
  'failed',
  'cancelled',
  'timed_out',
]);

/** A call running as a Mastra background task. An awaited call's part also names its task, but holds the final result. */
export const isDeferredCall = (backgroundTaskId: string | undefined, backgroundTaskStatus: string | undefined) =>
  backgroundTaskId !== undefined && !BACKGROUND_TASK_ENDED.has(backgroundTaskStatus);

/** A deferred call whose task was stopped before it returned: its part keeps the placeholder, never a result. */
export const isStoppedBackgroundCall = (
  backgroundTaskId: string | undefined,
  backgroundTaskStatus: string | undefined,
) => backgroundTaskId !== undefined && (backgroundTaskStatus === 'cancelled' || backgroundTaskStatus === 'timed_out');

interface StatusCall {
  toolName: string;
  toolCallId: string;
  state?: string;
}

/**
 * A call that threw, or a command that exited non-zero, failed. A call neither settled nor carried by a
 * live run reads as idle, so stale history never shimmers.
 */
export function badgeStatus(
  call: StatusCall,
  dataParts: ReadonlyArray<DataMessagePart> | undefined,
  chatRunning: boolean,
): ActivityStatus {
  if (call.state === 'output-error') return 'error';
  if (exitedWithFailure(call.toolName, sandboxExit(dataParts, call.toolCallId)?.exitCode)) return 'error';
  if (isSettledState(call.state) || !chatRunning) return 'idle';
  return 'running';
}

export const codeModeCall = (input: unknown, output: unknown) =>
  isRecord(input) || typeof input === 'string' ? getCodeModeCall(input, output) : null;

/** Approval and suspension land keyed by tool name on older runs and by call id on newer ones. */
export function toolInteraction(
  metadata: MessageMetadata | undefined,
  toolName: string,
  toolCallId: string,
): ToolInteraction {
  const approvals = metadata?.requireApprovalMetadata;
  const suspensions = metadata?.suspendedTools;
  const namedApproval = approvals?.[toolName];
  return {
    approval:
      metadata?.mode === 'network'
        ? namedApproval?.toolCallId === toolCallId
          ? namedApproval
          : approvals?.[toolCallId]
        : (approvals?.[toolCallId] ??
          Object.values(approvals ?? {}).find(approval => approval.toolCallId === toolCallId)),
    suspended: suspensions?.[toolName] ?? suspensions?.[toolCallId],
  };
}

/** Tools the transcript never draws: working memory updates and task tools (shown in the docked task list). */
export function isHiddenTool(toolName: string): boolean {
  return toolName === 'updateWorkingMemory' || isTaskTool(toolName);
}

export function toolCardKind(
  { toolName, toolCallId, input, output, state, backgroundTaskId, backgroundTaskStatus }: ToolPartFields,
  { metadata, mcpAppTools }: ToolCardContext,
): ToolCardKind {
  if (toolName === 'mastra-memory-om-observation') return 'observation';
  if (isHiddenTool(toolName)) return 'hidden';
  // A question read back in history draws as a plain badge, but it is still a question: never folded away.
  if (toolName === 'ask_user') return 'ask_user';
  // Built-in `request_connection` tool from `@mastra/connect`: the run pauses on it with
  // the prompt as its suspend payload, and the settled call keeps it as its result. Both
  // render the connect card; a call with neither falls back to a plain badge.
  const { suspended } = toolInteraction(metadata, toolName, toolCallId);
  if (
    toolName === CONNECT_PROMPT_TOOL_NAME &&
    (isConnectPromptPayload(output) || isConnectPromptPayload(suspended?.suspendPayload))
  ) {
    return 'connect_prompt';
  }
  if (
    toolName === SUBMIT_PLAN_TOOL_ID ||
    hasSubmitPlanToolId(suspended?.suspendPayload) ||
    hasSubmitPlanToolId(output)
  ) {
    return 'submit_plan';
  }
  // A foreground call parked on an MCP task's question: the run waits for the answer. A deferred
  // call's question lives on its background task instead, which the background card reads.
  if (!isDeferredCall(backgroundTaskId, backgroundTaskStatus) && suspendedMcpInputRequest(metadata, toolCallId)) {
    return 'mcp_input_request';
  }
  if (typeof output === 'string' && output.toLowerCase().includes('background task')) return 'background';
  if (isAgentCall(metadata, toolName)) return 'agent';
  if (isWorkflowCall(metadata, toolName)) return 'workflow';
  if (toolName === WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES) return 'file_tree';
  if (backgroundProcessPid(toolName, output)) return 'background_command';
  if (SANDBOX_TOOLS.has(toolName)) return 'sandbox';
  if (codeModeCall(input, output)) return 'code_mode';
  if (mcpAppTools?.[toolName]) return 'mcp_app';
  // A settled or failed Knowledge call draws as a readable card; while running it stays a plain badge.
  if (
    KNOWLEDGE_TOOLS.has(toolName) &&
    (state === 'output-error' || (isSettledState(state) && knowledgeCard(toolName, input, output)))
  ) {
    return 'knowledge';
  }
  return 'plain';
}
