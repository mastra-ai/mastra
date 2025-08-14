import type {
    generateObject,
    ModelMessage,
    TelemetrySettings,
    UIMessage,
    GenerateTextResult as OriginalGenerateTextResult,
    StreamTextResult as OriginalStreamTextResult,
    GenerateObjectResult as OriginalGenerateObjectResult,
    StreamObjectResult as OriginalStreamObjectResult,
    StreamObjectOnFinishCallback as OriginalStreamObjectOnFinishCallback,
    GenerateTextOnStepFinishCallback as OriginalGenerateTextOnStepFinishCallback,
    ToolSet,
    DeepPartial,
    streamObject,
    generateText,
    streamText,
    StreamTextOnFinishCallback as OriginalStreamTextOnFinishCallback,
    StreamTextOnStepFinishCallback as OriginalStreamTextOnStepFinishCallback,
} from "ai-v5";
import type { JSONSchema7 } from "json-schema";
import type { ZodSchema } from "zod";
import type { RuntimeContext } from "../../runtime-context";
import type { ToolAction, VercelTool, VercelToolV5 } from "../../tools";
import type { inferOutput, TripwireProperties } from "./shared.types";

type ToolsInput = Record<string, ToolAction<any, any, any> | VercelTool | VercelToolV5>;

type MastraCustomLLMOptions = {
    tools?: ToolsInput
    telemetry?: TelemetrySettings;
    threadId?: string;
    resourceId?: string;
    runtimeContext: RuntimeContext;
    runId?: string;
};

type MastraCustomLLMOptionsKeys = keyof MastraCustomLLMOptions;


export type OriginalGenerateTextOptions<
    TOOLS extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
> = Parameters<typeof generateText<TOOLS, inferOutput<Output>, DeepPartial<inferOutput<Output>>>>[0];


export type GenerateTextOnStepFinishCallback<Tools extends ToolSet> = (
    event: Parameters<OriginalGenerateTextOnStepFinishCallback<Tools>>[0] & { runId: string },
) => Promise<void> | void;


type GenerateTextOptions<Tools extends ToolSet, Output extends ZodSchema | JSONSchema7 | undefined = undefined> = Omit<
    OriginalGenerateTextOptions<Tools, Output>,
    MastraCustomLLMOptionsKeys | 'model' | 'onStepFinish'
> &
    MastraCustomLLMOptions & {
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
    | (Parameters<typeof generateObject<any>>[0] & { output: 'enum' })
    | (Parameters<typeof generateObject>[0] & { output: 'no-schema' });

type GenerateObjectOptions<Output extends ZodSchema | JSONSchema7 | undefined = undefined> = Omit<
    OriginalGenerateObjectOptions<Output>,
    MastraCustomLLMOptionsKeys | 'model' | 'output'
> &
    MastraCustomLLMOptions;

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

export type OriginalStreamTextOnFinishEventArg<Tools extends ToolSet> = Parameters<OriginalStreamTextOnFinishCallback<Tools>>[0];

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
    output?: never;
} & StreamTextOptions<Tools, Output>;

export type StreamTextResult<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
> = Omit<OriginalStreamTextResult<Tools, DeepPartial<inferOutput<Output>>>, 'experimental_output'> & {
    object?: inferOutput<Output>;
} & TripwireProperties;

export type OriginalStreamObjectOnFinishEventArg<RESULT> = Parameters<OriginalStreamObjectOnFinishCallback<RESULT>>[0];

export type StreamObjectOnFinishCallback<RESULT> = (
    event: OriginalStreamObjectOnFinishEventArg<RESULT> & { runId: string },
) => Promise<void> | void;

export type OriginalStreamObjectOptions<Output extends ZodSchema | JSONSchema7> =
    | Parameters<typeof streamObject<inferOutput<Output>>>[0]
    | (Parameters<typeof streamObject<inferOutput<Output>>>[0] & { output: 'array' })
    | (Parameters<typeof streamObject<any>>[0] & { output: 'enum' })
    | (Parameters<typeof streamObject>[0] & { output: 'no-schema' });

type StreamObjectOptions<Output extends ZodSchema | JSONSchema7> = Omit<
    OriginalStreamObjectOptions<Output>,
    MastraCustomLLMOptionsKeys | 'model' | 'output' | 'onFinish'
> &
    MastraCustomLLMOptions & {
        onFinish?: StreamObjectOnFinishCallback<inferOutput<Output>>;
    };

export type StreamObjectResult<Output extends ZodSchema | JSONSchema7> = OriginalStreamObjectResult<
    DeepPartial<inferOutput<Output>>,
    inferOutput<Output>,
    any
> & TripwireProperties;

export type StreamObjectWithMessagesArgs<Output extends ZodSchema | JSONSchema7> = {
    messages: UIMessage[] | ModelMessage[];
    structuredOutput: Output;
    output?: never;
} & StreamObjectOptions<Output>;

export type StreamReturn<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
    StructuredOutput extends ZodSchema | JSONSchema7 | undefined = undefined,
> = StreamTextResult<Tools, StructuredOutput> | StreamObjectResult<NonNullable<Output>>;

export type GenerateReturn<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
    StructuredOutput extends ZodSchema | JSONSchema7 | undefined = undefined,
> = Output extends undefined ? GenerateTextResult<Tools, StructuredOutput> : GenerateObjectResult<Output>;