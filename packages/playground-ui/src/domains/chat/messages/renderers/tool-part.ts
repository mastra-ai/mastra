import type { DynamicToolPart, MessageFactoryPart, ToolInvocationPart } from '@mastra/react';

export type ToolPart = ToolInvocationPart | DynamicToolPart;

/** One shape for a call whether it was persisted as a v4 `toolInvocation` or streamed as a v5 dynamic part. */
export interface ToolPartFields {
  toolName: string;
  toolCallId: string;
  input: unknown;
  output: unknown;
  state?: string;
}

export function isToolPart(part: MessageFactoryPart): part is ToolPart {
  return part.type === 'tool-invocation' || part.type === 'dynamic-tool' || part.type.startsWith('tool-');
}

export function readToolPart(part: ToolPart): ToolPartFields {
  if ('toolInvocation' in part) {
    const invocation = part.toolInvocation;
    return {
      toolName: invocation.toolName,
      toolCallId: invocation.toolCallId,
      input: 'args' in invocation ? invocation.args : undefined,
      output: 'result' in invocation ? invocation.result : undefined,
      state: invocation.state,
    };
  }
  return {
    toolName: part.toolName ?? part.type.replace(/^tool-/, ''),
    toolCallId: part.toolCallId ?? '',
    input: part.input,
    output: part.output,
    state: part.state,
  };
}
