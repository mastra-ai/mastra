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
  /** `running` while a deferred call's part holds a placeholder; `completed`/`failed` once it holds the result. */
  backgroundTaskStatus?: string;
  state?: string;
  errorText?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const readField = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

const readModelOutput = (part: ToolPart): unknown => {
  const providerMetadata = readField(part, 'resultProviderMetadata') ?? readField(part, 'providerMetadata');
  return readField(readField(providerMetadata, 'mastra'), 'modelOutput');
};

const readBackgroundTask = (part: ToolPart): Pick<ToolPartFields, 'backgroundTaskId' | 'backgroundTaskStatus'> => {
  for (const key of ['resultProviderMetadata', 'callProviderMetadata', 'providerMetadata']) {
    const backgroundTask = readField(readField(readField(part, key), 'mastra'), 'backgroundTask');
    const taskId = readField(backgroundTask, 'taskId');
    const status = readField(backgroundTask, 'status');
    if (typeof taskId === 'string') {
      return { backgroundTaskId: taskId, backgroundTaskStatus: typeof status === 'string' ? status : undefined };
    }
  }
  return {};
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
      ...readBackgroundTask(part),
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
    ...readBackgroundTask(part),
    state: part.state,
    errorText: part.errorText,
  };
}
