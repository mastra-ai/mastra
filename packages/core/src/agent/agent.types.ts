import type { JSONSchema7 } from '@ai-sdk/provider';
import type { TelemetrySettings } from 'ai';
import type { ModelMessage, ToolChoice } from 'ai-v5';
import type { z, ZodSchema } from 'zod';
import type { StreamTextOnFinishCallback, StreamTextOnStepFinishCallback } from '../llm/model/base.types';
import type { LoopConfig, LoopOptions } from '../loop/types';
import type { InputProcessor, OutputProcessor } from '../processors';
import type { RuntimeContext } from '../runtime-context';
import type { MastraScorers } from '../scores';
import type { ChunkType } from '../stream/types';
import type { MessageListInput } from './message-list';
import type { AgentMemoryOption, ToolsetsInput, ToolsInput, StructuredOutputOptions } from './types';

export type AgentExecutionOptions<
  OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  STRUCTURED_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  FORMAT extends 'mastra' | 'aisdk' = 'mastra' | 'aisdk',
> = {
  instructions?: string;
  context?: ModelMessage[];

  memory?: AgentMemoryOption;

  runId?: string;

  savePerStep?: boolean;
  runtimeContext?: RuntimeContext;
  format?: FORMAT;
  output?: OUTPUT;

  resourceId?: string;
  threadId?: string;

  telemetry?: TelemetrySettings;

  stopWhen?: LoopOptions['stopWhen'];

  providerOptions?: LoopOptions['providerOptions'];

  options?: Omit<LoopConfig, 'onStepFinish' | 'onFinish'>;

  onStepFinish?: FORMAT extends 'aisdk' ? StreamTextOnStepFinishCallback<any> : LoopConfig['onStepFinish'];

  onFinish?: FORMAT extends 'aisdk' ? StreamTextOnFinishCallback<any> : LoopConfig['onFinish'];

  /** Input processors to use for this stream call (overrides agent's default) */
  inputProcessors?: InputProcessor[];
  /** Output processors to use for this stream call (overrides agent's default) */
  outputProcessors?: OutputProcessor[];
  structuredOutput?: STRUCTURED_OUTPUT extends z.ZodTypeAny ? StructuredOutputOptions<STRUCTURED_OUTPUT> : never;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput;
  clientTools?: ToolsInput;
  toolChoice?: ToolChoice<any>;

  modelSettings?: LoopOptions['modelSettings'];

  scorers?: MastraScorers;
  returnScorerData?: boolean;
};

export type InnerAgentExecutionOptions = AgentExecutionOptions & {
  writableStream?: WritableStream<ChunkType>;
  messages: MessageListInput;
};
