import type { DynamicToolPart, MessageFactoryPart, ToolInvocationPart } from '@mastra/react';

export type ToolPart = ToolInvocationPart | DynamicToolPart;

/** One shape for a call whether it was persisted as a v4 `toolInvocation` or streamed as a v5 dynamic part. */
export interface ToolPartFields {
  toolName: string;
  toolCallId: string;
  input: unknown;
  output: unknown;
  modelOutput?: unknown;
  state?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const readField = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

const readModelOutput = (part: ToolPart): unknown => {
  const providerMetadata = readField(part, 'resultProviderMetadata') ?? readField(part, 'providerMetadata');
  return readField(readField(providerMetadata, 'mastra'), 'modelOutput');
};

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
      modelOutput: readModelOutput(part),
      state: invocation.state,
    };
  }
  return {
    toolName: part.toolName ?? part.type.replace(/^tool-/, ''),
    toolCallId: part.toolCallId ?? '',
    input: part.input,
    output: part.output,
    modelOutput: readModelOutput(part),
    state: part.state,
  };
}
