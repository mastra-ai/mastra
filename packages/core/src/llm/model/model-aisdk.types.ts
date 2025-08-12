import type {
    GenerateTextResult as OriginalGenerateTextResult,
    StreamTextResult as OriginalStreamTextResult,
    GenerateObjectResult as OriginalGenerateObjectResult,
    StreamObjectResult as OriginalStreamObjectResult,
    JSONSchema7,
    ToolSet,
    UIMessage,
    ModelMessage,
    generateText,
    DeepPartial,
    Tool,
    TelemetrySettings,
    GenerateTextOnStepFinishCallback as OriginalGenerateTextOnStepFinishCallback,
    StreamTextOnStepFinishCallback as OriginalStreamTextOnStepFinishCallback,
    StreamTextOnFinishCallback as OriginalStreamTextOnFinishCallback,
    StreamObjectOnFinishCallback as OriginalStreamObjectOnFinishCallback,
    generateObject,
    streamText,
    streamObject
} from "ai-v5";
import type { z, ZodSchema } from "zod";
import type { MastraCustomSharedLLMOptions, TripwireProperties } from "./shared.types";

export type inferOutput<Output extends ZodSchema | JSONSchema7 | undefined = undefined> = Output extends ZodSchema
    ? z.infer<Output>
    : Output extends JSONSchema7
    ? unknown
    : undefined;

export type OriginalGenerateTextOptions<
    TOOLS extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
> = Parameters<typeof generateText<TOOLS, inferOutput<Output>, DeepPartial<inferOutput<Output>>>>[0];


export type GenerateTextOnStepFinishCallback<Tools extends ToolSet> = (
    event: Parameters<OriginalGenerateTextOnStepFinishCallback<Tools>>[0] & { runId: string },
) => Promise<void> | void;

type MastraCustomV5LLMOptions = {
    tools?: Record<string, Tool>;
    telemetry?: TelemetrySettings;
} & MastraCustomSharedLLMOptions;

type MastraCustomV5LLMOptionsKeys = keyof MastraCustomV5LLMOptions;


type GenerateTextOptions<Tools extends ToolSet, Output extends ZodSchema | JSONSchema7 | undefined = undefined> = Omit<
    OriginalGenerateTextOptions<Tools, Output>,
    MastraCustomV5LLMOptionsKeys | 'model' | 'onStepFinish'
> &
    MastraCustomV5LLMOptions & {
        onStepFinish?: GenerateTextOnStepFinishCallback<inferOutput<Output>>;
        experimental_output?: Output;
    };

export type GenerateTextWithMessagesArgs<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
> = {
    messages: UIMessage[] | ModelMessage[];
    output?: never;
} & GenerateTextOptions<Tools, Output>;

export type GenerateTextResult<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
> = Omit<OriginalGenerateTextResult<Tools, inferOutput<Output>>, 'experimental_output'> & {
    object?: Output extends undefined ? never : inferOutput<Output>;
} & TripwireProperties;

export type OriginalGenerateObjectOptions<Output extends ZodSchema | JSONSchema7 | undefined = undefined> =
    | Parameters<typeof generateObject<inferOutput<Output>>>[0]
    | (Parameters<typeof generateObject<inferOutput<Output>>>[0] & { output: 'array' })
    | (Parameters<typeof generateObject<string>>[0] & { output: 'enum' })
    | (Parameters<typeof generateObject>[0] & { output: 'no-schema' });

type GenerateObjectOptions<Output extends ZodSchema | JSONSchema7 | undefined = undefined> = Omit<
    OriginalGenerateObjectOptions<Output>,
    MastraCustomV5LLMOptionsKeys | 'model' | 'output'
> &
    MastraCustomV5LLMOptions;

export type GenerateObjectWithMessagesArgs<Output extends ZodSchema | JSONSchema7> = {
    messages: UIMessage[] | ModelMessage[];
    structuredOutput: Output;
    output?: never;
} & GenerateObjectOptions<Output>;

export type GenerateObjectResult<Output extends ZodSchema | JSONSchema7 | undefined = undefined> =
    OriginalGenerateObjectResult<inferOutput<Output>> & {
        readonly reasoning?: never;
    } & TripwireProperties;

export type OriginalStreamTextOptions<
    TOOLS extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
> = Parameters<typeof streamText<TOOLS, inferOutput<Output>, DeepPartial<inferOutput<Output>>>>[0];

export type StreamTextOnStepFinishCallback<Tools extends ToolSet> = (
    event: Parameters<OriginalStreamTextOnStepFinishCallback<Tools>>[0] & { runId: string },
) => Promise<void> | void;

export type OriginalStreamTextOnFinishEventArg<Tools extends ToolSet> = Parameters<
    OriginalStreamTextOnFinishCallback<Tools>
>[0];

export type StreamTextOnFinishCallback<Tools extends ToolSet> = (
    event: OriginalStreamTextOnFinishEventArg<Tools> & { runId: string },
) => Promise<void> | void;

type StreamTextOptions<Tools extends ToolSet, Output extends ZodSchema | JSONSchema7 | undefined = undefined> = Omit<
    OriginalStreamTextOptions<Tools, Output>,
    MastraCustomV5LLMOptionsKeys | 'model' | 'onStepFinish' | 'onFinish'
> &
    MastraCustomV5LLMOptions & {
        onStepFinish?: StreamTextOnStepFinishCallback<inferOutput<Output>>;
        onFinish?: StreamTextOnFinishCallback<inferOutput<Output>>;
        experimental_output?: Output;
    };

export type StreamTextWithMessagesArgs<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
> = {
    messages: UIMessage[] | ModelMessage[];
    output?: never;
} & StreamTextOptions<Tools, Output>;

export type StreamTextResult<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
> = Omit<OriginalStreamTextResult<Tools, DeepPartial<inferOutput<Output>>>, 'experimental_output'> & {
    object?: inferOutput<Output>;
} & TripwireProperties;

export type OriginalStreamObjectOptions<Output extends ZodSchema | JSONSchema7> =
    | Parameters<typeof streamObject<inferOutput<Output>>>[0]
    | (Parameters<typeof streamObject<inferOutput<Output>>>[0] & { output: 'array' })
    | (Parameters<typeof streamObject<string>>[0] & { output: 'enum' })
    | (Parameters<typeof streamObject>[0] & { output: 'no-schema' });

export type OriginalStreamObjectOnFinishEventArg<RESULT> = Parameters<OriginalStreamObjectOnFinishCallback<RESULT>>[0];

export type StreamObjectOnFinishCallback<RESULT> = (
    event: OriginalStreamObjectOnFinishEventArg<RESULT> & { runId: string },
) => Promise<void> | void;

type StreamObjectOptions<Output extends ZodSchema | JSONSchema7> = Omit<
    OriginalStreamObjectOptions<Output>,
    MastraCustomV5LLMOptionsKeys | 'model' | 'output' | 'onFinish'
> &
    MastraCustomV5LLMOptions & {
        onFinish?: StreamObjectOnFinishCallback<inferOutput<Output>>;
    };

export type StreamObjectWithMessagesArgs<Output extends ZodSchema | JSONSchema7> = {
    messages: UIMessage[] | ModelMessage[];
    structuredOutput: Output;
    output?: never;
} & StreamObjectOptions<Output>;

export type StreamObjectResult<Output extends ZodSchema | JSONSchema7> = OriginalStreamObjectResult<
    DeepPartial<inferOutput<Output>>,
    inferOutput<Output>,
    any
> &
    TripwireProperties;