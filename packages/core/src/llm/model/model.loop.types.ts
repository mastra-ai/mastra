import type {
    generateObject,
    ModelMessage,
    TelemetrySettings,
    UIMessage,
    GenerateObjectResult as OriginalGenerateObjectResult,
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