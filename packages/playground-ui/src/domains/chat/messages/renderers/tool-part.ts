import type { DynamicToolPart, MessageFactoryPart, ToolInvocationPart } from '@mastra/react/ui';

export type ToolPart = ToolInvocationPart | DynamicToolPart;

/** One shape for a call whether it was persisted as a v4 `toolInvocation` or streamed as a v5 dynamic part. */
export interface ToolPartFields {
  toolName: string;
  toolCallId: string;
  input: unknown;
  output: unknown;
  modelOutput?: unknown;
  /** The Mastra background task running the call, when it was deferred. */
  backgroundTaskId?: string;
  state?: string;
  errorText?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const readField = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

const readModelOutput = (part: ToolPart): unknown => {
  const providerMetadata = readField(part, 'resultProviderMetadata') ?? readField(part, 'providerMetadata');
  return readField(readField(providerMetadata, 'mastra'), 'modelOutput');
};

const readBackgroundTaskId = (part: ToolPart): string | undefined => {
  for (const key of ['resultProviderMetadata', 'callProviderMetadata', 'providerMetadata']) {
    const taskId = readField(readField(readField(readField(part, key), 'mastra'), 'backgroundTask'), 'taskId');
    if (typeof taskId === 'string') return taskId;
  }
  return undefined;
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
      backgroundTaskId: readBackgroundTaskId(part),
      state:
        invocation.state === 'result' && 'isError' in invocation && invocation.isError === true
          ? 'output-error'
          : invocation.state,
      errorText: 'errorText' in invocation ? invocation.errorText : undefined,
    };
  }
  return {
    toolName: part.toolName ?? part.type.replace(/^tool-/, ''),
    toolCallId: part.toolCallId ?? '',
    input: part.input,
    output: part.output,
    modelOutput: readModelOutput(part),
    backgroundTaskId: readBackgroundTaskId(part),
    state: part.state,
    errorText: part.errorText,
  };
}
