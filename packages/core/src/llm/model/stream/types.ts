import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { Span } from '@opentelemetry/api';
import type { IDGenerator, LanguageModelV1, LanguageModelV1Prompt, streamText, ToolChoice, ToolSet } from 'ai';
import type { CallSettings, TelemetrySettings, ToolSet as ToolSetV5, StopCondition, asSchema } from 'ai-v5';
import type z3 from 'zod';
import type z4 from 'zod/v4';
import type { MastraLogger } from '../../../logger';
import type { ChunkType } from '../../../stream/types';
import type { CoreTool, CoreToolV2, ToolsForExecution } from '../../../tools';

export type OnResult = (result: { warnings: any; request: any; rawResponse: any }) => void;

export type CreateStream = () =>
  | Promise<{
      stream: ReadableStream<any>;
      warnings?: any;
      request?: any;
      rawResponse?: any;
    }>
  | ReadableStream<any>;

export type StreamInternal = {
  now?: () => number;
  generateId?: IDGenerator;
  currentDate?: () => Date;
};

export type ExecuteOptions = {
  onChunk?: (chunk: ChunkType) => Promise<void> | void;
  onError?: ({ error }: { error: Error | string }) => Promise<void> | void;
  onFinish?: (event: any) => Promise<void> | void;
  onStepFinish?: (event: any) => Promise<void> | void;
  activeTools?: Array<keyof ToolSet> | undefined;
  abortSignal?: AbortSignal;

  mode?: 'regular' | 'object-json' | 'object-tool';
  /**
   * The expected structure of the output.
   *
   * - 'object': Generate a single object that conforms to the schema.
   * - 'array': Generate an array of objects that conform to the schema.
   * - 'no-schema': Generate any JSON object. No schema is specified.
   *
   * Default is 'object' if not specified.
   */
  output?: 'object' | 'array' | 'no-schema';
  schema?: Parameters<typeof asSchema>[0];
  schemaName?: string;
  schemaDescription?: string;
};

export type ExecutionProps = {
  model: LanguageModelV1 | LanguageModelV2;
  inputMessages: LanguageModelV1Prompt;
  runId: string;
  providerMetadata?: Record<string, any>;
  providerOptions?: Record<string, any>;
  tools?: Record<string, ToolsForExecution>;
  toolChoice?: ToolChoice<ToolSet> | undefined;
  _internal?: StreamInternal;
  experimental_generateMessageId?: Pick<
    Parameters<typeof streamText>[0],
    'experimental_generateMessageId'
  >['experimental_generateMessageId'];
  toolCallStreaming?: boolean;
  options?: ExecuteOptions;
  modelSettings?: Omit<CallSettings, 'abortSignal' | 'headers'>;
  /**
   * HTTP headers to include in the model request
   */
  headers?: Record<string, string | undefined> | undefined;
  logger?: MastraLogger;
  experimental_telemetry?: TelemetrySettings;
  doStreamSpan?: Span;
};

export type AgentWorkflowProps = {
  messageId: string;
  controller: ReadableStreamDefaultController<ChunkType>;
} & ExecutionProps;

export type StreamExecutorProps = {
  maxSteps?: number;
  stopWhen?: StopCondition<ToolSetV5> | StopCondition<ToolSetV5>[];
  maxRetries?: number;
  startTimestamp: number;
} & ExecutionProps;
