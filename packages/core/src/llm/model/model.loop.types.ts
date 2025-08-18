import type {
  ModelMessage,
  TelemetrySettings,
  UIMessage,
  ToolSet,
  DeepPartial,
  streamText,
  StreamTextResult as OriginalStreamTextResult,
  StreamTextOnFinishCallback as OriginalStreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback as OriginalStreamTextOnStepFinishCallback,
} from 'ai-v5';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
import type { ObjectOptions } from '../../loop/types';
import type { RuntimeContext } from '../../runtime-context';
import type { ToolAction, VercelTool, VercelToolV5 } from '../../tools';
import type { inferOutput, TripwireProperties } from './shared.types';

type ToolsInput = Record<string, ToolAction<any, any, any> | VercelTool | VercelToolV5>;

type MastraCustomLLMOptions = {
  tools?: ToolsInput;
  telemetry?: TelemetrySettings;
  threadId?: string;
  resourceId?: string;
  runtimeContext: RuntimeContext;
  runId?: string;
};

type MastraCustomLLMOptionsKeys = keyof MastraCustomLLMOptions;

export type OriginalStreamTextOptions<
  TOOLS extends ToolSet,
  Output extends ZodSchema | JSONSchema7 | undefined = undefined,
> = Parameters<typeof streamText<TOOLS, inferOutput<Output>, DeepPartial<inferOutput<Output>>>>[0];

export type OriginalStreamTextOnFinishEventArg<Tools extends ToolSet> = Parameters<
  OriginalStreamTextOnFinishCallback<Tools>
>[0];

export type StreamTextOnFinishCallback<Tools extends ToolSet> = (
  event: OriginalStreamTextOnFinishEventArg<Tools> & { runId: string },
) => Promise<void> | void;

export type StreamTextOnStepFinishCallback<Tools extends ToolSet> = (
  event: Parameters<OriginalStreamTextOnStepFinishCallback<Tools>>[0] & { runId: string },
) => Promise<void> | void;

type StreamTextOptions<Tools extends ToolSet, Output extends ZodSchema | JSONSchema7 | undefined = undefined> = Omit<
  OriginalStreamTextOptions<Tools, Output>,
  MastraCustomLLMOptionsKeys | 'model' | 'onStepFinish' | 'onFinish'
> &
  MastraCustomLLMOptions & {
    onStepFinish?: StreamTextOnStepFinishCallback<inferOutput<Output>>;
    onFinish?: StreamTextOnFinishCallback<inferOutput<Output>>;
    experimental_output?: Output;
  };

export type StreamTextWithMessagesArgs<
  Tools extends ToolSet,
  Output extends ZodSchema | JSONSchema7 | undefined = undefined,
> = {
  messages: UIMessage[] | ModelMessage[];
  objectOptions?: ObjectOptions;
} & StreamTextOptions<Tools, Output>;

export type StreamTextResult<
  Tools extends ToolSet,
  Output extends ZodSchema | JSONSchema7 | undefined = undefined,
> = Omit<OriginalStreamTextResult<Tools, DeepPartial<inferOutput<Output>>>, 'experimental_output'> & {
  object?: inferOutput<Output>;
} & TripwireProperties;
