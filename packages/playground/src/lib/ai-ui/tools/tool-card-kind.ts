import { isTaskTool } from '@mastra/playground-ui/components/ai/tool-call';
import type { ToolCallStatus } from '@mastra/playground-ui/components/ai/tool-call';

import { getCodeModeCall } from './badges/code-mode-badge';
import { SUBMIT_PLAN_TOOL_ID } from '@/domains/agents/hooks/use-agent-plan';
import { WORKSPACE_TOOLS } from '@/domains/workspace/constants';
import type {
  MessageMetadata,
  SuspendedToolMetadata,
  ToolApprovalMetadata,
} from '@/lib/ai-ui/messages/message-metadata';
import type { ToolPartFields } from '@/lib/ai-ui/messages/renderers/tool-part';
import { isRecord } from '@/lib/ai-ui/messages/signal-data';

/** Which card draws a call. Decided once, shared by the dispatcher and the fold. */
export type ToolCardKind =
  | 'hidden'
  | 'observation'
  | 'ask_user'
  | 'submit_plan'
  | 'background'
  | 'agent'
  | 'workflow'
  | 'file_tree'
  | 'sandbox'
  | 'code_mode'
  | 'mcp_app'
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

/** A call neither settled nor carried by a live run reads as idle, so stale history never shimmers. */
export function badgeStatus(state: string | undefined, chatRunning: boolean): ToolCallStatus {
  if (state === 'output-error') return 'error';
  if (isSettledState(state) || !chatRunning) return 'idle';
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
  return {
    approval: approvals?.[toolName] ?? approvals?.[toolCallId],
    suspended: suspensions?.[toolName] ?? suspensions?.[toolCallId],
  };
}

export function toolCardKind(
  { toolName, toolCallId, input, output }: ToolPartFields,
  { metadata, mcpAppTools }: ToolCardContext,
): ToolCardKind {
  if (toolName === 'mastra-memory-om-observation') return 'observation';
  if (toolName === 'updateWorkingMemory' || isTaskTool(toolName)) return 'hidden';
  // A question read back in history draws as a plain badge, but it is still a question: never folded away.
  if (toolName === 'ask_user') return 'ask_user';
  const { suspended } = toolInteraction(metadata, toolName, toolCallId);
  if (
    toolName === SUBMIT_PLAN_TOOL_ID ||
    hasSubmitPlanToolId(suspended?.suspendPayload) ||
    hasSubmitPlanToolId(output)
  ) {
    return 'submit_plan';
  }
  if (typeof output === 'string' && output.toLowerCase().includes('background task')) return 'background';
  if (isAgentCall(metadata, toolName)) return 'agent';
  if (isWorkflowCall(metadata, toolName)) return 'workflow';
  if (toolName === WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES) return 'file_tree';
  if (SANDBOX_TOOLS.has(toolName)) return 'sandbox';
  if (codeModeCall(input, output)) return 'code_mode';
  if (mcpAppTools?.[toolName]) return 'mcp_app';
  return 'plain';
}
