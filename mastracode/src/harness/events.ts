import type { HarnessEvent } from '@mastra/core/harness';
import type { HarnessEvent as HarnessV1Event } from '@mastra/core/harness/v1';

export function projectSubagentEvent(event: HarnessV1Event): HarnessEvent | undefined {
  switch (event.type) {
    case 'subagent_start':
      return {
        type: 'subagent_start',
        toolCallId: event.toolCallId,
        agentType: event.agentType,
        task: event.task,
        modelId: event.modelId,
        forked: false,
      } as HarnessEvent;
    case 'subagent_text_delta':
      return {
        type: 'subagent_text_delta',
        toolCallId: event.toolCallId,
        agentType: event.agentType,
        textDelta: event.delta,
      } as HarnessEvent;
    case 'subagent_tool_start':
      return {
        type: 'subagent_tool_start',
        toolCallId: event.toolCallId,
        agentType: event.agentType,
        subToolName: event.toolName,
        subToolArgs: (event as { args?: unknown }).args,
      } as HarnessEvent;
    case 'subagent_tool_end':
      return {
        type: 'subagent_tool_end',
        toolCallId: event.toolCallId,
        agentType: event.agentType,
        subToolName: event.toolName,
        subToolArgs: (event as { args?: unknown }).args,
        subToolResult: event.output,
        isError: event.isError,
      } as HarnessEvent;
    case 'subagent_end':
      return {
        type: 'subagent_end',
        toolCallId: event.toolCallId,
        agentType: event.agentType,
        result: typeof event.output === 'string' ? event.output : JSON.stringify(event.output),
        isError: event.isError,
        durationMs: event.durationMs,
      } as HarnessEvent;
    default:
      return undefined;
  }
}
