import type { KnownAgentControllerEvent } from '@mastra/client-js';
import { stripAnsi } from '@mastra/playground-ui/components/ai/tool-call';

import type { PromptEntry, SubagentEntry, ToolCall } from './transcript';

type DisplayState = Extract<KnownAgentControllerEvent, { type: 'display_state_changed' }>['displayState'];

export function displayTools(displayState: DisplayState): ToolCall[] {
  return Object.entries(displayState.activeTools).map(([toolCallId, tool]) => {
    let status: ToolCall['status'] = 'running';
    if (tool.status === 'completed') status = 'done';
    if (tool.status === 'error') status = 'error';
    return {
      toolCallId,
      toolName: tool.name,
      args: tool.status === 'streaming_input' ? undefined : tool.args,
      argsText: displayState.toolInputBuffers[toolCallId]?.text ?? '',
      status,
      result: status === 'running' ? tool.partialResult : tool.result,
      output: stripAnsi(tool.shellOutput ?? ''),
    };
  });
}

export function displayPrompts(displayState: DisplayState): PromptEntry[] {
  const prompts: PromptEntry[] = Object.values(displayState.pendingSuspensions).map(suspension => ({
    kind: 'suspension',
    id: `suspension-${suspension.toolCallId}`,
    toolCallId: suspension.toolCallId,
    toolName: suspension.toolName,
    args: suspension.args,
    suspendPayload: suspension.suspendPayload,
  }));
  const approval = displayState.pendingApproval;
  if (approval) {
    prompts.push({ kind: 'approval', id: `approval-${approval.toolCallId}`, ...approval });
  }
  return prompts;
}

export function displaySubagents(displayState: DisplayState): SubagentEntry[] {
  return Object.entries(displayState.activeSubagents).map(([toolCallId, subagent]) => ({
    kind: 'subagent',
    id: `subagent-${toolCallId}`,
    toolCallId,
    agentType: subagent.agentType,
    task: subagent.task,
    modelId: subagent.modelId ?? '',
    done: subagent.status !== 'running',
  }));
}
