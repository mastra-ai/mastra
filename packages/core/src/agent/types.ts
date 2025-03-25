import type {
  GenerateTextOnStepFinishCallback,
  LanguageModelV1,
  StreamObjectOnFinishCallback,
  StreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback,
  TelemetrySettings,
} from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';

import type { Metric } from '../eval';
import type {
  CoreMessage,
  DefaultLLMStreamOptions,
  DefaultLLMStreamObjectOptions,
  DefaultLLMTextObjectOptions,
  DefaultLLMTextOptions,
  OutputType,
} from '../llm';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig } from '../memory/types';
import type { ToolAction, VercelTool } from '../tools';
import type { CompositeVoice } from '../voice';

export type { Message as AiMessageType } from 'ai';

export type ToolsInput = Record<string, ToolAction<any, any, any> | VercelTool>;

export type ToolsetsInput = Record<string, ToolsInput>;

export type MastraLanguageModel = LanguageModelV1;

export interface AgentConfig<
  TTools extends ToolsInput = ToolsInput,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> {
  name: string;
  instructions: string;
  model: MastraLanguageModel;
  tools?: TTools;
  mastra?: Mastra;
  /** @deprecated This property is deprecated. Use evals instead to add evaluation metrics. */
  metrics?: TMetrics;
  evals?: TMetrics;
  memory?: MastraMemory;
  voice?: CompositeVoice;
}

export type AgentGenerateOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  instructions?: string;
  toolsets?: ToolsetsInput;
  context?: CoreMessage[];
  memoryOptions?: MemoryConfig;
  runId?: string;
  onStepFinish?: Z extends undefined ? GenerateTextOnStepFinishCallback<any> : never;
  maxSteps?: number;
  output?: OutputType | Z;
  experimental_output?: Z;
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  telemetry?: TelemetrySettings;
} & ({ resourceId?: undefined; threadId?: undefined } | { resourceId: string; threadId: string }) &
  (Z extends undefined ? DefaultLLMTextOptions : DefaultLLMTextObjectOptions);

export type AgentStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  instructions?: string;
  toolsets?: ToolsetsInput;
  context?: CoreMessage[];
  memoryOptions?: MemoryConfig;
  runId?: string;
  onFinish?: Z extends undefined
    ? StreamTextOnFinishCallback<any>
    : Z extends ZodSchema
      ? StreamObjectOnFinishCallback<z.infer<Z>>
      : StreamObjectOnFinishCallback<any>;
  onStepFinish?: Z extends undefined ? StreamTextOnStepFinishCallback<any> : never;
  maxSteps?: number;
  output?: OutputType | Z;
  temperature?: number;
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  experimental_output?: Z;
  telemetry?: TelemetrySettings;
} & ({ resourceId?: undefined; threadId?: undefined } | { resourceId: string; threadId: string }) &
  (Z extends undefined ? DefaultLLMStreamOptions : DefaultLLMStreamObjectOptions);
