import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { IDGenerator, LanguageModelV1, LanguageModelV1Prompt, streamText, ToolChoice, ToolSet } from 'ai';
import type { ToolSet as ToolSetV5 } from 'ai-v5';
import type { MastraLogger } from '../../../logger';
import type { ChunkType } from '../../../stream/types';
import type { CoreTool, CoreToolV2 } from '../../../tools';

export type OnResult = (result: { warnings: any; request: any; rawResponse: any }) => void;

export type CreateStream = () =>
  | Promise<{
      stream: ReadableStream<any>;
      warnings: any;
      request: any;
      rawResponse: any;
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
};

export type ExecutionProps = {
  model: LanguageModelV1 | LanguageModelV2;
  inputMessages: LanguageModelV1Prompt;
  runId: string;
  providerMetadata?: Record<string, any>;
  providerOptions?: Record<string, any>;
  tools?: Record<string, CoreTool | CoreToolV2>;
  toolChoice?: ToolChoice<ToolSet> | undefined;
  activeTools?: Array<keyof ToolSet> | undefined;
  _internal?: StreamInternal;
  experimental_generateMessageId?: Pick<
    Parameters<typeof streamText>[0],
    'experimental_generateMessageId'
  >['experimental_generateMessageId'];
  toolCallStreaming?: boolean;
  options?: ExecuteOptions;
  logger?: MastraLogger;
  /**
   * HTTP headers to include in the model request
   */
  headers?: Record<string, string | undefined> | undefined;
};

export type AgentWorkflowProps = {
  messageId: string;
  controller: ReadableStreamDefaultController<ChunkType>;
} & ExecutionProps;

export type StreamExecutorProps = {
  maxSteps?: number;
  maxRetries?: number;
} & ExecutionProps;
